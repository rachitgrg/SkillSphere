import { Response, NextFunction } from 'express';
import Gig from '../models/Gig';
import ClientProfile from '../models/ClientProfile';
import { Types } from 'mongoose';
import Payment from '../models/Payment';
import Proposal from '../models/Proposal';
import notificationService from '../services/notificationService';
import { AuthRequest, UserRole, GigStatus, IGig, PaymentStatus, ProposalStatus } from '../types';
import { buildPaginationResponse, parsePaginationParams, pick } from '../utils/helpers';
import { buildPublicGigFilter, gigSort, toStringList } from '../services/gigQuery';

/** Fields a client may set on a gig; status, views, proposals and the hired freelancer are server-controlled. */
export const GIG_EDITABLE = [
  'title', 'description', 'category', 'subCategory', 'skills', 'budgetType', 'budgetMin', 'budgetMax',
  'duration', 'experienceLevel', 'milestones', 'attachments', 'location', 'locationType', 'visibility', 'tags', 'deadline',
] as const;

/** A gig can only be edited before work starts. */
const EDITABLE_STATUSES: GigStatus[] = [GigStatus.DRAFT, GigStatus.PENDING_APPROVAL, GigStatus.OPEN];

/**
 * Open public gigs are visible to everyone; anything else only to its owner, the hired
 * freelancer and admins (invitees are added with invitations in plan 4.4).
 */
const canViewGig = (
  gig: Pick<IGig, 'client' | 'selectedFreelancer' | 'status' | 'visibility'>,
  user?: { _id: Types.ObjectId; role: string }
): boolean => {
  if (gig.status === GigStatus.OPEN && (gig.visibility ?? 'public') === 'public') return true;
  if (!user) return false;
  const id = user._id.toString();
  return user.role === UserRole.ADMIN || gig.client.toString() === id || gig.selectedFreelancer?.toString() === id;
};

/** A gig can only be deleted before anyone is hired; afterwards it must be cancelled. */
const DELETABLE_STATUSES: GigStatus[] = [GigStatus.DRAFT, GigStatus.PENDING_APPROVAL, GigStatus.REJECTED, GigStatus.OPEN];

/** True when the gig has money in escrow or frozen by a dispute. */
const hasHeldMoney = async (gigId: Types.ObjectId): Promise<boolean> =>
  Boolean(await Payment.exists({ gig: gigId, status: { $in: [PaymentStatus.ESCROW, PaymentStatus.DISPUTED] } }));

/** New gigs wait in the admin approval queue (pending_approval) before they are public. */
export const createGig = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const gig = await new Gig({
      ...pick(req.body, GIG_EDITABLE),
      client: req.user!._id,
      status: GigStatus.PENDING_APPROVAL,
    }).save();
    await ClientProfile.updateOne({ user: req.user!._id }, { $inc: { postedGigs: 1 } });
    res.status(201).json({ success: true, message: 'Gig submitted for approval', data: gig });
  } catch (error) {
    next(error);
  }
};

/** GET /gigs/mine — the client's own gigs in every status, optionally filtered by status. */
export const getMyGigs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as Record<string, unknown>;
    const { page, limit } = parsePaginationParams(query);
    const filter: Record<string, unknown> = { client: req.user!._id };
    const statuses = toStringList(query.status).filter((s) => (Object.values(GigStatus) as string[]).includes(s));
    if (statuses.length) filter.status = { $in: statuses };

    const [gigs, total] = await Promise.all([
      Gig.find(filter)
        .populate('selectedFreelancer', 'firstName lastName avatar')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Gig.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, message: 'Gigs retrieved', data: gigs, pagination: buildPaginationResponse(total, page, limit) });
  } catch (error) {
    next(error);
  }
};

/** Public marketplace: open, public gigs only, with server-side filters, sort and pagination. */
export const getGigs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as Record<string, unknown>;
    const { page, limit } = parsePaginationParams(query);
    const filter = buildPublicGigFilter(query);

    const [gigs, total] = await Promise.all([
      Gig.find(filter)
        .populate('client', 'firstName lastName avatar address')
        .sort(gigSort(query))
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Gig.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: 'Gigs retrieved',
      data: gigs,
      pagination: buildPaginationResponse(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

export const getGigById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing = await Gig.findById(req.params.id).select('client selectedFreelancer status visibility').lean();
    if (!existing || !canViewGig(existing, req.user)) {
      // 404 (not 403) so private gigs don't reveal that they exist.
      res.status(404).json({ success: false, message: 'Gig not found' });
      return;
    }

    // Atomic increment: never re-validates (or rewrites) the whole document.
    await Gig.updateOne({ _id: req.params.id }, { $inc: { views: 1 } });

    const gig = await Gig.findById(req.params.id)
      .populate('client', 'firstName lastName avatar address')
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

    const wasActive = gig.status === GigStatus.IN_PROGRESS;
    gig.status = GigStatus.CANCELLED;
    await gig.save();
    if (wasActive) await ClientProfile.updateOne({ user: gig.client, activeGigs: { $gt: 0 } }, { $inc: { activeGigs: -1 } });

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
