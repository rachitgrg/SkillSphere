import { Response, NextFunction } from 'express';
import Gig from '../models/Gig';
import aiMatchingService from '../services/aiMatchingService';
import { QueryFilter, Types } from 'mongoose';
import Payment from '../models/Payment';
import Proposal from '../models/Proposal';
import notificationService from '../services/notificationService';
import { AuthRequest, UserRole, GigStatus, IGig, PaymentStatus, ProposalStatus } from '../types';
import { pick } from '../utils/helpers';

/** Fields a client may set on a gig; status, views, proposals and the hired freelancer are server-controlled. */
export const GIG_EDITABLE = [
  'title', 'description', 'category', 'subCategory', 'skills', 'budgetType', 'budgetMin', 'budgetMax',
  'duration', 'experienceLevel', 'milestones', 'attachments', 'location', 'locationType', 'visibility', 'tags', 'deadline',
] as const;

/** A gig can only be edited before work starts. */
const EDITABLE_STATUSES: GigStatus[] = [GigStatus.DRAFT, GigStatus.PENDING_APPROVAL, GigStatus.OPEN];

/** A gig can only be deleted before anyone is hired; afterwards it must be cancelled. */
const DELETABLE_STATUSES: GigStatus[] = [GigStatus.DRAFT, GigStatus.PENDING_APPROVAL, GigStatus.REJECTED, GigStatus.OPEN];

/** True when the gig has money in escrow or frozen by a dispute. */
const hasHeldMoney = async (gigId: Types.ObjectId): Promise<boolean> =>
  Boolean(await Payment.exists({ gig: gigId, status: { $in: [PaymentStatus.ESCROW, PaymentStatus.DISPUTED] } }));

export const createGig = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user?.role !== UserRole.CLIENT) {
      res.status(403).json({ success: false, message: 'Only clients can create gigs' });
      return;
    }

    const gig = new Gig({
      ...pick(req.body, GIG_EDITABLE),
      client: req.user._id,
      status: GigStatus.OPEN,
      totalProposals: 0,
      views: 0,
      proposals: []
    });

    await gig.save();
    res.status(201).json({ success: true, message: 'Gig created successfully', data: gig });
  } catch (error) {
    next(error);
  }
};

export const getGigs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, category, status } = req.query;
    const query: QueryFilter<IGig> = {};
    if (category) query.category = String(category);
    if (status) query.status = String(status) as GigStatus;

    const gigs = await Gig.find(query)
      .populate('client', 'firstName lastName avatar')
      .skip((+page - 1) * +limit)
      .limit(+limit)
      .sort({ createdAt: -1 });

    const total = await Gig.countDocuments(query);

    res.status(200).json({
      success: true,
      message: 'Gigs retrieved',
      data: gigs,
      pagination: {
        page: +page,
        limit: +limit,
        total,
        pages: Math.ceil(total / +limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const analyzeCareer = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { resumeText } = req.body;
    if (!resumeText) {
      res.status(400).json({ success: false, message: 'resumeText is required' });
      return;
    }

    const report = await aiMatchingService.analyzeCareerFromResume(resumeText);

    res.status(200).json({
      success: true,
      message: 'Career analysis complete',
      data: report
    });
  } catch (error) {
    next(error);
  }
};

export const getGigById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Atomic increment: never re-validates (or rewrites) the whole document.
    const { matchedCount } = await Gig.updateOne({ _id: req.params.id }, { $inc: { views: 1 } });
    if (!matchedCount) {
      res.status(404).json({ success: false, message: 'Gig not found' });
      return;
    }

    const gig = await Gig.findById(req.params.id)
      .populate('client', 'firstName lastName avatar')
      .populate('selectedFreelancer', 'firstName lastName avatar')
      .lean();

    res.status(200).json({ success: true, message: 'Gig retrieved', data: gig });
  } catch (error) {
    next(error);
  }
};

export const updateGig = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) {
      res.status(404).json({ success: false, message: 'Gig not found' });
      return;
    }

    if (gig.client.toString() !== req.user?._id.toString()) {
      res.status(403).json({ success: false, message: 'Not authorized to update this gig' });
      return;
    }

    if (!EDITABLE_STATUSES.includes(gig.status)) {
      res.status(409).json({ success: false, message: `A gig cannot be edited once it is ${gig.status}` });
      return;
    }

    // Saving the document (not findByIdAndUpdate) runs the budget pre-validate hook.
    gig.set(pick(req.body, GIG_EDITABLE));
    await gig.save();
    res.status(200).json({ success: true, message: 'Gig updated', data: gig });
  } catch (error) {
    next(error);
  }
};

export const deleteGig = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) {
      res.status(404).json({ success: false, message: 'Gig not found' });
      return;
    }

    if (gig.client.toString() !== req.user?._id.toString() && req.user?.role !== UserRole.ADMIN) {
      res.status(403).json({ success: false, message: 'Not authorized to delete this gig' });
      return;
    }

    if (!DELETABLE_STATUSES.includes(gig.status) || (await hasHeldMoney(gig._id))) {
      res.status(409).json({
        success: false,
        message: 'Only gigs that have not started and hold no escrowed payments can be deleted. Cancel this gig instead.',
      });
      return;
    }

    await Proposal.deleteMany({ gig: gig._id });
    await Gig.deleteOne({ _id: gig._id });
    res.status(200).json({ success: true, message: 'Gig deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancels a gig that hasn't finished. Money held in escrow must be refunded (or disputed) first;
 * open proposals are rejected and their freelancers notified.
 */
export const cancelGig = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) {
      res.status(404).json({ success: false, message: 'Gig not found' });
      return;
    }
    if (gig.client.toString() !== req.user!._id.toString()) {
      res.status(403).json({ success: false, message: 'Not authorized to cancel this gig' });
      return;
    }
    if ([GigStatus.COMPLETED, GigStatus.CANCELLED].includes(gig.status)) {
      res.status(409).json({ success: false, message: `Gig is already ${gig.status}` });
      return;
    }
    if (await hasHeldMoney(gig._id)) {
      res.status(409).json({
        success: false,
        message: 'Refund or release the escrowed payments (or open a dispute) before cancelling',
      });
      return;
    }

    gig.status = GigStatus.CANCELLED;
    await gig.save();

    const open = await Proposal.find({ gig: gig._id, status: { $in: [ProposalStatus.PENDING, ProposalStatus.NEGOTIATING] } });
    await Proposal.updateMany(
      { _id: { $in: open.map((p) => p._id) } },
      { $set: { status: ProposalStatus.REJECTED, respondedAt: new Date() } }
    );
    await Promise.all(
      open.map((p) =>
        notificationService.notifyProposalRejected(p.freelancer.toString(), gig.client.toString(), gig.title, gig._id.toString())
      )
    );

    res.status(200).json({ success: true, message: 'Gig cancelled', data: gig });
  } catch (error) {
    next(error);
  }
};
