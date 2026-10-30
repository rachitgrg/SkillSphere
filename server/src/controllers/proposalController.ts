import { Response, NextFunction } from 'express';
import Proposal from '../models/Proposal';
import Gig from '../models/Gig';
import FreelancerProfile from '../models/FreelancerProfile';
import ClientProfile from '../models/ClientProfile';
import notificationService from '../services/notificationService';
import { isInvited, toStringList } from '../services/gigQuery';
import { buildPaginationResponse, parsePaginationParams } from '../utils/helpers';
import { AuthRequest, UserRole, ProposalStatus, IGig, GigStatus, MilestoneStatus, NotificationType } from '../types';

export const createProposal = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const freelancer = req.user!;
    const { gigId, coverLetter, proposedAmount, estimatedDuration, milestones, attachments } = req.body;

    const gig = await Gig.findById(gigId);
    if (!gig) {
      res.status(404).json({ success: false, message: 'Gig not found' });
      return;
    }
    if (gig.status !== GigStatus.OPEN) {
      res.status(409).json({ success: false, message: 'This gig is not accepting proposals' });
      return;
    }
    if (gig.client.toString() === freelancer._id.toString()) {
      res.status(403).json({ success: false, message: 'You cannot apply to your own gig' });
      return;
    }
    if (gig.visibility !== 'public' && !isInvited(gig, freelancer._id)) {
      res.status(404).json({ success: false, message: 'Gig not found' });
      return;
    }

    let proposal;
    try {
      proposal = await Proposal.create({
        gig: gig._id,
        freelancer: freelancer._id,
        coverLetter,
        proposedAmount,
        estimatedDuration,
        milestones,
        attachments,
        status: ProposalStatus.PENDING,
        submittedAt: new Date()
      });
    } catch (error) {
      // Unique index on { gig, freelancer } makes duplicate submissions race-safe.
      if ((error as { code?: number }).code === 11000) {
        res.status(409).json({ success: false, message: 'You have already submitted a proposal for this gig' });
        return;
      }
      throw error;
    }

    await Gig.updateOne({ _id: gig._id }, { $push: { proposals: proposal._id }, $inc: { totalProposals: 1 } });
    await Gig.updateOne(
      { _id: gig._id, 'invitations.freelancer': freelancer._id },
      { $set: { 'invitations.$.status': 'accepted', 'invitations.$.respondedAt': new Date() } }
    );
    await notificationService.notifyProposalReceived(
      gig.client.toString(), freelancer._id.toString(), gig.title, gig._id.toString()
    );

    res.status(201).json({ success: true, message: 'Proposal submitted', data: proposal });
  } catch (error) {
    next(error);
  }
};

export const getProposalsForGig = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const gig = await Gig.findById(req.params.gigId);
    if (!gig) {
      res.status(404).json({ success: false, message: 'Gig not found' });
      return;
    }

    if (gig.client.toString() !== req.user?._id.toString() && req.user?.role !== UserRole.ADMIN) {
      res.status(403).json({ success: false, message: 'Not authorized to view proposals for this gig' });
      return;
    }

    const proposals = await Proposal.find({ gig: req.params.gigId })
      .populate('freelancer', 'firstName lastName avatar address')
      .sort({ submittedAt: -1 });

    // Attach each freelancer's headline stats so the client can compare applicants.
    const profiles = await FreelancerProfile.find({ user: { $in: proposals.map((p) => p.freelancer._id) } })
      .select('user title averageRating totalReviews completedGigs hourlyRate skills')
      .lean();
    const byUser = new Map(profiles.map((p) => [p.user.toString(), p]));
    const data = proposals.map((p) => ({ ...p.toJSON(), freelancerProfile: byUser.get(p.freelancer._id.toString()) ?? null }));

    res.status(200).json({ success: true, message: 'Proposals retrieved', data });
  } catch (error) {
    next(error);
  }
};

export const getProposalById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const proposal = await Proposal.findById(req.params.id)
      .populate('freelancer', 'firstName lastName avatar')
      .populate('gig');

    if (!proposal) {
      res.status(404).json({ success: false, message: 'Proposal not found' });
      return;
    }

    const gig = proposal.gig as unknown as IGig;
    if (gig.client.toString() !== req.user?._id.toString() && proposal.freelancer._id.toString() !== req.user?._id.toString()) {
      res.status(403).json({ success: false, message: 'Not authorized to view this proposal' });
      return;
    }

    res.status(200).json({ success: true, message: 'Proposal retrieved', data: proposal });
  } catch (error) {
    next(error);
  }
};

/**
 * Rescales amounts proportionally so they add up to `total`, rounded to 2 dp (computed in paise);
 * the rounding remainder goes on the last one.
 */
export const scaleAmounts = (amounts: number[], total: number): number[] => {
  const current = amounts.reduce((sum, a) => sum + a, 0);
  if (amounts.length === 0 || current <= 0) return amounts;
  const totalPaise = Math.round(total * 100);
  const paise = amounts.map((a) => Math.round((a * totalPaise) / current));
  paise[paise.length - 1] = totalPaise - paise.slice(0, -1).reduce((sum, p) => sum + p, 0);
  return paise.map((p) => p / 100);
};

/** Statuses a client can still act on. */
const OPEN_PROPOSAL_STATUSES = [ProposalStatus.PENDING, ProposalStatus.NEGOTIATING];

export const updateProposalStatus = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = req.body.status as ProposalStatus;
    const { clientNotes } = req.body;
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) {
      res.status(404).json({ success: false, message: 'Proposal not found' });
      return;
    }

    const gig = await Gig.findById(proposal.gig);
    if (!gig) {
      res.status(404).json({ success: false, message: 'Gig not found' });
      return;
    }
    if (gig.client.toString() !== req.user!._id.toString()) {
      res.status(403).json({ success: false, message: 'Only the gig client can update proposal status' });
      return;
    }
    if (!OPEN_PROPOSAL_STATUSES.includes(proposal.status)) {
      res.status(409).json({ success: false, message: `This proposal is already ${proposal.status}` });
      return;
    }

    if (status === ProposalStatus.ACCEPTED) {
      // Hiring runs as steps ordered so that a failure part-way is finished by clicking Hire again:
      // claim → milestones (idempotent) → reject the others → accept this one → counters/notify.
      // Guarded claim: only one proposal can ever win the gig, even under concurrent accepts. The
      // second branch resumes a hire of this same freelancer that stopped before step 4.
      const claimed = await Gig.findOneAndUpdate(
        {
          _id: gig._id,
          $or: [
            { status: GigStatus.OPEN, selectedFreelancer: null },
            { status: GigStatus.IN_PROGRESS, selectedFreelancer: proposal.freelancer },
          ],
        },
        { $set: { selectedFreelancer: proposal.freelancer, status: GigStatus.IN_PROGRESS } },
        { returnDocument: 'after' }
      );
      if (!claimed) {
        res.status(409).json({ success: false, message: 'A freelancer has already been hired for this gig' });
        return;
      }

      const agreed = proposal.finalAmount ?? proposal.proposedAmount;
      if (claimed.milestones.length === 0 && proposal.milestones.length > 0) {
        claimed.milestones.push(
          ...proposal.milestones.map((m) => ({
            title: m.title,
            description: m.description,
            amount: m.amount,
            dueDate: m.dueDate,
            status: MilestoneStatus.PENDING,
          }))
        );
      }
      // The agreed price is what the client pays. When the bid or a counter-offer moved it away from
      // the milestone plan, scale the milestones to add up to it. (Hourly bids are a rate, not a total.)
      const planned = claimed.milestones.reduce((sum, m) => sum + m.amount, 0);
      if (claimed.budgetType === 'fixed' && claimed.milestones.length > 0 && Math.abs(planned - agreed) >= 0.01) {
        const scaled = scaleAmounts(claimed.milestones.map((m) => m.amount), agreed);
        claimed.milestones.forEach((m, i) => (m.amount = scaled[i]));
      }
      if (claimed.isModified('milestones')) await claimed.save();

      const ids = [gig._id.toString(), gig.client.toString()] as const;
      const others = await Proposal.find({
        gig: gig._id,
        _id: { $ne: proposal._id },
        status: { $in: OPEN_PROPOSAL_STATUSES },
      }).select('freelancer');
      await Proposal.updateMany(
        { _id: { $in: others.map((o) => o._id) } },
        { $set: { status: ProposalStatus.REJECTED, respondedAt: new Date() } }
      );
      await Promise.all(
        others.map((o) => notificationService.notifyProposalRejected(o.freelancer.toString(), ids[1], gig.title, ids[0]))
      );

      const accepted = await Proposal.findOneAndUpdate(
        { _id: proposal._id, status: { $in: OPEN_PROPOSAL_STATUSES } },
        {
          $set: {
            status: ProposalStatus.ACCEPTED,
            finalAmount: agreed,
            respondedAt: new Date(),
            ...(clientNotes && { clientNotes }),
          },
        },
        { returnDocument: 'after' }
      );
      if (!accepted) {
        res.status(409).json({ success: false, message: 'This proposal was already handled' });
        return;
      }

      await ClientProfile.updateOne({ user: gig.client }, { $inc: { activeGigs: 1 } });
      await notificationService.notifyProposalAccepted(proposal.freelancer.toString(), ids[1], gig.title, ids[0]);
      res.status(200).json({ success: true, message: 'Proposal status updated', data: accepted });
      return;
    }

    if (status === ProposalStatus.REJECTED) {
      await notificationService.notifyProposalRejected(
        proposal.freelancer.toString(), gig.client.toString(), gig.title, gig._id.toString()
      );
    }

    proposal.status = status;
    if (clientNotes) proposal.clientNotes = clientNotes;
    proposal.respondedAt = new Date();
    await proposal.save();

    res.status(200).json({ success: true, message: 'Proposal status updated', data: proposal });
  } catch (error) {
    next(error);
  }
};

/** GET /proposals/mine — the freelancer's proposals with their gigs, optionally filtered by status. */
export const getMyProposals = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as Record<string, unknown>;
    const { page, limit } = parsePaginationParams(query);
    const filter: Record<string, unknown> = { freelancer: req.user!._id };
    const statuses = toStringList(query.status).filter((s) => (Object.values(ProposalStatus) as string[]).includes(s));
    if (statuses.length) filter.status = { $in: statuses };

    const [proposals, total] = await Promise.all([
      Proposal.find(filter)
        .populate({ path: 'gig', select: 'title status budgetType budgetMin budgetMax client', populate: { path: 'client', select: 'firstName lastName avatar' } })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Proposal.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, message: 'Proposals retrieved', data: proposals, pagination: buildPaginationResponse(total, page, limit) });
  } catch (error) {
    next(error);
  }
};

/** PUT /proposals/:id/withdraw — the freelancer withdraws a proposal that is still pending or negotiating. */
export const withdrawProposal = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const proposal = await Proposal.findOneAndUpdate(
      { _id: req.params.id, freelancer: req.user!._id, status: { $in: OPEN_PROPOSAL_STATUSES } },
      { $set: { status: ProposalStatus.WITHDRAWN } },
      { returnDocument: 'after' }
    );
    if (!proposal) {
      const exists = await Proposal.exists({ _id: req.params.id, freelancer: req.user!._id });
      res.status(exists ? 409 : 404).json({
        success: false,
        message: exists ? 'Only pending or negotiating proposals can be withdrawn' : 'Proposal not found',
      });
      return;
    }
    await Gig.updateOne({ _id: proposal.gig }, { $inc: { totalProposals: -1 } });
    res.status(200).json({ success: true, message: 'Proposal withdrawn', data: proposal });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /proposals/:id/negotiate { amount, message } — either the gig client or the proposal's
 * freelancer counters. The latest offer becomes `finalAmount`, which accepting the proposal hires at.
 */
export const negotiateProposal = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { amount, message } = req.body as { amount: number; message: string };
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) {
      res.status(404).json({ success: false, message: 'Proposal not found' });
      return;
    }
    const gig = await Gig.findById(proposal.gig).select('client title status');
    const me = req.user!._id.toString();
    const isClient = gig?.client.toString() === me;
    const isFreelancer = proposal.freelancer.toString() === me;
    if (!gig || (!isClient && !isFreelancer)) {
      res.status(403).json({ success: false, message: 'Only the client and the freelancer can negotiate' });
      return;
    }
    if (!OPEN_PROPOSAL_STATUSES.includes(proposal.status) || gig.status !== GigStatus.OPEN) {
      res.status(409).json({ success: false, message: 'This proposal can no longer be negotiated' });
      return;
    }

    proposal.negotiationHistory.push({ proposedBy: req.user!._id, amount, message, createdAt: new Date() });
    proposal.finalAmount = amount;
    proposal.status = ProposalStatus.NEGOTIATING;
    proposal.agreedAt = undefined; // a new offer replaces any earlier agreement
    await proposal.save();

    const recipient = isClient ? proposal.freelancer.toString() : gig.client.toString();
    await notificationService.create({
      recipient,
      sender: me,
      type: NotificationType.PROPOSAL_COUNTERED,
      title: 'New counter-offer',
      message: `${isClient ? 'The client' : 'The freelancer'} proposed ₹${amount.toLocaleString('en-IN')} for "${gig.title}"`,
      data: { proposalId: proposal._id.toString(), gigId: gig._id.toString(), amount },
      link: isClient ? '/freelancer/proposals' : `/client/gigs/${gig._id}/proposals`,
    });

    res.status(200).json({ success: true, message: 'Offer sent', data: proposal });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /proposals/:id/accept-offer — the freelancer agrees to the client's last counter-offer.
 * Records agreedAt (the client still decides when to hire); the status stays "negotiating".
 */
export const acceptOffer = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal || proposal.freelancer.toString() !== req.user!._id.toString()) {
      res.status(404).json({ success: false, message: 'Proposal not found' });
      return;
    }
    const gig = await Gig.findById(proposal.gig).select('client title status');
    const last = proposal.negotiationHistory.at(-1);
    if (!gig || gig.status !== GigStatus.OPEN || proposal.status !== ProposalStatus.NEGOTIATING || !last) {
      res.status(409).json({ success: false, message: 'There is no offer to accept on this proposal' });
      return;
    }
    if (last.proposedBy.toString() !== gig.client.toString()) {
      res.status(409).json({ success: false, message: 'The last offer is yours; wait for the client to respond' });
      return;
    }
    if (proposal.agreedAt) {
      res.status(200).json({ success: true, message: 'Offer already accepted', data: proposal });
      return;
    }

    proposal.agreedAt = new Date();
    await proposal.save();

    await notificationService.create({
      recipient: gig.client.toString(),
      sender: req.user!._id.toString(),
      type: NotificationType.PROPOSAL_COUNTERED,
      title: 'Offer accepted',
      message: `The freelancer agreed to ₹${last.amount.toLocaleString('en-IN')} for "${gig.title}". You can hire them now.`,
      data: { proposalId: proposal._id.toString(), gigId: gig._id.toString(), amount: last.amount },
      link: `/client/gigs/${gig._id}/proposals`,
    });

    res.status(200).json({ success: true, message: 'Offer accepted', data: proposal });
  } catch (error) {
    next(error);
  }
};
