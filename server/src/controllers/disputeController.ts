import { Response, NextFunction } from 'express';
import { QueryFilter } from 'mongoose';
import Dispute from '../models/Dispute';
import Gig from '../models/Gig';
import Payment from '../models/Payment';
import paymentService from '../services/paymentService';
import notificationService from '../services/notificationService';
import { AdminAction, AuthRequest, DisputeStatus, IDispute, PaymentStatus, UserRole } from '../types';
import { logAdminAction } from '../utils/adminLog';
import { buildPaginationResponse, parsePaginationParams } from '../utils/helpers';

const ACTIVE_DISPUTE_STATUSES = [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW];

/**
 * Only the gig's client or hired freelancer can open a dispute; `against` is the other party.
 * An attached payment must belong to the gig and be held in escrow; it is frozen as `disputed`.
 */
export const createDispute = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { gigId, paymentId, title, description } = req.body;
    const userId = req.user!._id.toString();

    const gig = await Gig.findById(gigId);
    if (!gig) {
      res.status(404).json({ success: false, message: 'Gig not found' });
      return;
    }

    const clientId = gig.client.toString();
    const freelancerId = gig.selectedFreelancer?.toString();
    if (!freelancerId || (userId !== clientId && userId !== freelancerId)) {
      res.status(403).json({ success: false, message: 'Only the client and the hired freelancer can open a dispute' });
      return;
    }
    const againstId = userId === clientId ? freelancerId : clientId;

    if (paymentId) {
      const payment = await Payment.findOne({ _id: paymentId, gig: gig._id });
      if (!payment) {
        res.status(400).json({ success: false, message: 'Payment does not belong to this gig' });
        return;
      }
      if (payment.status !== PaymentStatus.ESCROW) {
        res.status(409).json({ success: false, message: 'Only payments held in escrow can be disputed' });
        return;
      }
    }

    if (await Dispute.exists({ gig: gig._id, status: { $in: ACTIVE_DISPUTE_STATUSES }, ...(paymentId ? { payment: paymentId } : {}) })) {
      res.status(409).json({ success: false, message: 'A dispute is already open for this gig' });
      return;
    }

    const dispute = await Dispute.create({
      gig: gig._id,
      payment: paymentId,
      raisedBy: userId,
      against: againstId,
      title,
      description,
      status: DisputeStatus.OPEN,
    });

    if (paymentId) {
      await Payment.updateOne({ _id: paymentId, status: PaymentStatus.ESCROW }, { status: PaymentStatus.DISPUTED });
    }

    await notificationService.notifyDisputeOpened(againstId, title, dispute._id.toString());

    res.status(201).json({ success: true, message: 'Dispute opened successfully', data: dispute });
  } catch (error) {
    next(error);
  }
};

/** Admins see every dispute (filterable by status/gig); users see the ones they are part of. */
export const getDisputes = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
    const filter: QueryFilter<IDispute> = {};

    if (req.user!.role !== UserRole.ADMIN) {
      filter.$or = [{ raisedBy: req.user!._id }, { against: req.user!._id }];
    }
    if (typeof req.query.status === 'string' && (Object.values(DisputeStatus) as string[]).includes(req.query.status)) {
      filter.status = req.query.status as DisputeStatus;
    }
    if (typeof req.query.gig === 'string') filter.gig = req.query.gig;

    const [disputes, total] = await Promise.all([
      Dispute.find(filter)
        .populate('gig', 'title')
        .populate('raisedBy', 'firstName lastName avatar')
        .populate('against', 'firstName lastName avatar')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Dispute.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: 'Disputes retrieved',
      data: disputes,
      pagination: buildPaginationResponse(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

export const getDisputeById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const dispute = await Dispute.findById(req.params.id)
      .populate('gig', 'title client selectedFreelancer')
      .populate('payment')
      .populate('raisedBy', 'firstName lastName avatar')
      .populate('against', 'firstName lastName avatar');
    if (!dispute) {
      res.status(404).json({ success: false, message: 'Dispute not found' });
      return;
    }

    const me = req.user!._id.toString();
    const isParty = [dispute.raisedBy, dispute.against].some((u) => (u as unknown as { _id: unknown })._id?.toString() === me);
    if (!isParty && req.user!.role !== UserRole.ADMIN) {
      res.status(403).json({ success: false, message: 'Not authorized to view this dispute' });
      return;
    }

    res.status(200).json({ success: true, message: 'Dispute retrieved', data: dispute });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin resolution. The payment action runs first (real Razorpay test refund when captured), so a
 * gateway failure leaves the dispute open. Writes an AdminLog entry and notifies both parties.
 */
export const resolveDispute = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { resolution, adminNotes, paymentAction, refundAmount } = req.body as {
      resolution: string;
      adminNotes?: string;
      paymentAction?: 'refund' | 'release' | 'split';
      refundAmount?: number;
    };

    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) {
      res.status(404).json({ success: false, message: 'Dispute not found' });
      return;
    }
    if (!ACTIVE_DISPUTE_STATUSES.includes(dispute.status)) {
      res.status(409).json({ success: false, message: `Dispute is already ${dispute.status}` });
      return;
    }
    if (paymentAction && !dispute.payment) {
      res.status(400).json({ success: false, message: 'This dispute has no payment to act on' });
      return;
    }

    const reason = `Dispute resolution: ${resolution}`;
    if (paymentAction && dispute.payment) {
      const paymentId = dispute.payment.toString();
      if (paymentAction === 'refund') await paymentService.refundPayment(paymentId, reason);
      if (paymentAction === 'release') await paymentService.releasePayment(paymentId, { allowDisputed: true });
      if (paymentAction === 'split') await paymentService.splitPayment(paymentId, refundAmount!, reason);
    }

    dispute.status = DisputeStatus.RESOLVED;
    dispute.resolution = resolution;
    dispute.adminNotes = adminNotes;
    dispute.resolvedBy = req.user!._id;
    dispute.resolvedAt = new Date();
    await dispute.save();

    await logAdminAction(req, {
      action: AdminAction.DISPUTE_RESOLVE,
      targetType: 'dispute',
      targetId: dispute._id,
      details: resolution,
      metadata: { paymentAction, refundAmount, paymentId: dispute.payment?.toString() },
    });

    await Promise.all(
      [dispute.raisedBy, dispute.against].map((userId) =>
        notificationService.notifyDisputeResolved(userId.toString(), dispute.title, dispute._id.toString(), resolution)
      )
    );

    res.status(200).json({ success: true, message: 'Dispute resolved', data: dispute });
  } catch (error) {
    next(error);
  }
};
