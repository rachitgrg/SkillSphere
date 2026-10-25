import { Response, NextFunction } from 'express';
import Proposal from '../models/Proposal';
import Gig from '../models/Gig';
import notificationService from '../services/notificationService';
import { AuthRequest, UserRole, ProposalStatus, IGig, GigStatus, MilestoneStatus } from '../types';

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
      .populate('freelancer', 'firstName lastName avatar')
      .sort({ submittedAt: -1 });

    res.status(200).json({ success: true, message: 'Proposals retrieved', data: proposals });
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
      // Guarded claim: only one proposal can ever win the gig, even under concurrent accepts.
      const claimed = await Gig.findOneAndUpdate(
        { _id: gig._id, status: GigStatus.OPEN, selectedFreelancer: null },
        { $set: { selectedFreelancer: proposal.freelancer, status: GigStatus.IN_PROGRESS } },
        { returnDocument: 'after' }
      );
      if (!claimed) {
        res.status(409).json({ success: false, message: 'A freelancer has already been hired for this gig' });
        return;
      }

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
        await claimed.save();
      }

      proposal.finalAmount = proposal.finalAmount ?? proposal.proposedAmount;

      const others = await Proposal.find({
        gig: gig._id,
        _id: { $ne: proposal._id },
        status: { $in: OPEN_PROPOSAL_STATUSES },
      }).select('freelancer');
      await Proposal.updateMany(
        { _id: { $in: others.map((o) => o._id) } },
        { $set: { status: ProposalStatus.REJECTED, respondedAt: new Date() } }
      );

      const ids = [gig._id.toString(), gig.client.toString()] as const;
      await notificationService.notifyProposalAccepted(proposal.freelancer.toString(), ids[1], gig.title, ids[0]);
      await Promise.all(
        others.map((o) => notificationService.notifyProposalRejected(o.freelancer.toString(), ids[1], gig.title, ids[0]))
      );
    } else if (status === ProposalStatus.REJECTED) {
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
