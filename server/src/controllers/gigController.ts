import { Response, NextFunction } from 'express';
import Gig from '../models/Gig';
import ClientProfile from '../models/ClientProfile';
import { Types } from 'mongoose';
import Payment from '../models/Payment';
import Proposal from '../models/Proposal';
import User from '../models/User';
import notificationService from '../services/notificationService';
import uploadService from '../services/uploadService';
import { uploadedFiles } from '../middleware/upload';
import embeddingService from '../services/embeddingService';
import { AuthRequest, UserRole, GigStatus, IGig, NotificationType, PaymentStatus, ProposalStatus } from '../types';
import { buildPaginationResponse, parsePaginationParams, pick } from '../utils/helpers';
import { buildPublicGigFilter, gigSort, isInvited, toStringList } from '../services/gigQuery';

/** Fields a client may set on a gig; status, views, proposals and the hired freelancer are server-controlled. */
export const GIG_EDITABLE = [
  'title', 'description', 'category', 'subCategory', 'skills', 'budgetType', 'budgetMin', 'budgetMax',
  'duration', 'experienceLevel', 'milestones', 'location', 'locationType', 'visibility', 'tags', 'deadline',
] as const;

/** A gig can only be edited before work starts. */
const EDITABLE_STATUSES: GigStatus[] = [GigStatus.DRAFT, GigStatus.PENDING_APPROVAL, GigStatus.OPEN];

const MAX_ATTACHMENTS = 10;

/**
 * Open public gigs are visible to everyone; open invite-only gigs to their invitees; anything
 * else only to its owner, the hired freelancer and admins.
 */
const canViewGig = (
  gig: Pick<IGig, 'client' | 'selectedFreelancer' | 'status' | 'visibility' | 'invitations'>,
  user?: { _id: Types.ObjectId; role: string }
): boolean => {
  if (gig.status === GigStatus.OPEN && (gig.visibility ?? 'public') === 'public') return true;
  if (!user) return false;
  const id = user._id.toString();
  if (gig.status === GigStatus.OPEN && isInvited(gig, id)) return true;
  return user.role === UserRole.ADMIN || gig.client.toString() === id || gig.selectedFreelancer?.toString() === id;
};

/** Loads a gig the caller owns, or answers 404/403 and returns null. */
const loadOwnGig = async (req: AuthRequest, res: Response) => {
  const gig = await Gig.findById(req.params.id);
  if (!gig) {
    res.status(404).json({ success: false, message: 'Gig not found' });
    return null;
  }
  if (gig.client.toString() !== req.user!._id.toString()) {
    res.status(403).json({ success: false, message: 'Only the gig owner can do this' });
    return null;
  }
  return gig;
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
    embeddingService.queue(() => embeddingService.refreshGig(gig._id));
    res.status(201).json({ success: true, message: 'Gig submitted for approval', data: gig });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /gigs/mine — clients: gigs they posted (every status); freelancers: gigs they were hired on.
 * Optionally filtered by status.
 */
export const getMyGigs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as Record<string, unknown>;
    const { page, limit } = parsePaginationParams(query);
    const isFreelancer = req.user!.role === UserRole.FREELANCER;
    const filter: Record<string, unknown> = isFreelancer ? { selectedFreelancer: req.user!._id } : { client: req.user!._id };
    const statuses = toStringList(query.status).filter((s) => (Object.values(GigStatus) as string[]).includes(s));
    if (statuses.length) filter.status = { $in: statuses };

    const [gigs, total] = await Promise.all([
      Gig.find(filter)
        .populate('selectedFreelancer', 'firstName lastName avatar')
        .populate('client', 'firstName lastName avatar')
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
    const existing = await Gig.findById(req.params.id).select('client selectedFreelancer status visibility invitations').lean();
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

    // Only the owner and admins see who else was invited; an invitee sees their own invitation.
    const viewer = req.user?._id.toString();
    if (gig && viewer !== gig.client._id.toString() && req.user?.role !== UserRole.ADMIN) {
      gig.invitations = (gig.invitations ?? []).filter((i) => i.freelancer.toString() === viewer);
    }

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
    const textChanged = ['title', 'description', 'skills', 'category'].some((f) => gig.isModified(f));
    await gig.save();
    if (textChanged) embeddingService.queue(() => embeddingService.refreshGig(gig._id));
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

/** POST /gigs/:id/attachments — `files` (up to 5 per request, 10 in total): images, PDF, DOC, TXT, ZIP. */
export const addAttachments = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const gig = await loadOwnGig(req, res);
    if (!gig) return;
    const files = uploadedFiles(req);
    if (gig.attachments.length + files.length > MAX_ATTACHMENTS) {
      res.status(400).json({ success: false, message: `A gig can have at most ${MAX_ATTACHMENTS} attachments` });
      return;
    }
    const stored = await uploadService.uploadFiles(files, 'gig-attachments');
    const updated = await Gig.findByIdAndUpdate(
      gig._id,
      { $push: { attachments: { $each: stored.map(({ url, publicId, name, size, mimeType }) => ({ url, publicId, name, size, mimeType })) } } },
      { returnDocument: 'after' }
    );
    res.status(201).json({ success: true, message: 'Attachments added', data: updated });
  } catch (error) {
    next(error);
  }
};

/** DELETE /gigs/:id/attachments/:attachmentId */
export const removeAttachment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const gig = await loadOwnGig(req, res);
    if (!gig) return;
    const attachment = gig.attachments.find((a) => a._id?.toString() === req.params.attachmentId);
    if (!attachment) {
      res.status(404).json({ success: false, message: 'Attachment not found' });
      return;
    }
    const updated = await Gig.findByIdAndUpdate(gig._id, { $pull: { attachments: { _id: attachment._id } } }, { returnDocument: 'after' });
    const isImage = attachment.mimeType?.startsWith('image/');
    await uploadService.deleteFile(attachment.publicId, isImage ? 'image' : 'raw');
    res.status(200).json({ success: true, message: 'Attachment removed', data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /gigs/:id/invite { freelancerId, message? } — invites a freelancer to an open gig
 * (in-app + email). Invite-only gigs are visible to invitees only.
 */
export const inviteFreelancer = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const gig = await loadOwnGig(req, res);
    if (!gig) return;
    if (gig.status !== GigStatus.OPEN) {
      res.status(409).json({ success: false, message: 'Freelancers can be invited once the gig is approved and open' });
      return;
    }
    const { freelancerId, message } = req.body as { freelancerId: string; message?: string };
    const freelancer = await User.findOne({ _id: freelancerId, role: UserRole.FREELANCER, isActive: true, isBanned: false }).select('_id');
    if (!freelancer) {
      res.status(404).json({ success: false, message: 'Freelancer not found' });
      return;
    }
    if (await Proposal.exists({ gig: gig._id, freelancer: freelancer._id })) {
      res.status(409).json({ success: false, message: 'This freelancer has already applied' });
      return;
    }
    // Guarded push: the invite is recorded at most once even under concurrent requests.
    const updated = await Gig.findOneAndUpdate(
      { _id: gig._id, 'invitations.freelancer': { $ne: freelancer._id } },
      { $push: { invitations: { freelancer: freelancer._id, invitedAt: new Date(), status: 'pending' } } },
      { returnDocument: 'after' }
    );
    if (!updated) {
      res.status(409).json({ success: false, message: 'This freelancer is already invited' });
      return;
    }

    const client = req.user!;
    await notificationService.create({
      recipient: freelancer._id.toString(),
      sender: client._id.toString(),
      type: NotificationType.GIG_INVITATION,
      title: 'You are invited to a gig',
      message: `${client.firstName} ${client.lastName} invited you to apply to "${gig.title}"${message ? `: ${message}` : ''}`,
      data: { gigId: gig._id.toString() },
      link: `/gigs/${gig._id}`,
      category: 'gigs',
    });

    res.status(200).json({ success: true, message: 'Freelancer invited', data: updated.invitations });
  } catch (error) {
    next(error);
  }
};

/** GET /gigs/invitations — freelancer: open gigs they were invited to, newest first. */
export const getMyInvitations = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const me = req.user!._id;
    const gigs = await Gig.find({ status: GigStatus.OPEN, 'invitations.freelancer': me })
      .populate('client', 'firstName lastName avatar address')
      .sort({ 'invitations.invitedAt': -1 })
      .limit(50)
      .lean();
    const data = gigs.map(({ invitations, ...gig }) => ({ gig, invitation: invitations.find((i) => i.freelancer.toString() === me.toString()) }));
    res.status(200).json({ success: true, message: 'Invitations', data });
  } catch (error) {
    next(error);
  }
};

/** PUT /gigs/:id/invitation { status: 'declined' } — freelancer declines an invitation (applying accepts it). */
export const respondToInvitation = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const gig = await Gig.findOneAndUpdate(
      { _id: req.params.id, invitations: { $elemMatch: { freelancer: req.user!._id, status: 'pending' } } },
      { $set: { 'invitations.$.status': 'declined', 'invitations.$.respondedAt': new Date() } },
      { returnDocument: 'after' }
    );
    if (!gig) {
      res.status(404).json({ success: false, message: 'No pending invitation for this gig' });
      return;
    }
    res.status(200).json({ success: true, message: 'Invitation declined' });
  } catch (error) {
    next(error);
  }
};
