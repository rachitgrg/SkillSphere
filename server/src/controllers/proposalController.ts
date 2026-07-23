import { Response } from 'express';
import Proposal from '../models/Proposal';
import Gig from '../models/Gig';
import { AuthRequest, UserRole, ProposalStatus } from '../types';

export const createProposal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== UserRole.FREELANCER) {
      res.status(403).json({ success: false, message: 'Only freelancers can submit proposals' });
      return;
    }

    const { gigId, coverLetter, proposedAmount, estimatedDuration, milestones, attachments } = req.body;

    const gig = await Gig.findById(gigId);
    if (!gig) {
      res.status(404).json({ success: false, message: 'Gig not found' });
      return;
    }

    const existingProposal = await Proposal.findOne({ gig: gigId, freelancer: req.user._id });
    if (existingProposal) {
      res.status(400).json({ success: false, message: 'You have already submitted a proposal for this gig' });
      return;
    }

    const proposal = new Proposal({
      gig: gigId,
      freelancer: req.user._id,
      coverLetter,
      proposedAmount,
      estimatedDuration,
      milestones,
      attachments,
      status: ProposalStatus.PENDING,
      isBookmarked: false,
      submittedAt: new Date()
    });

    await proposal.save();

    gig.proposals.push(proposal._id);
    gig.totalProposals += 1;
    await gig.save();

    res.status(201).json({ success: true, message: 'Proposal submitted', data: proposal });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProposalsForGig = async (req: AuthRequest, res: Response): Promise<void> => {
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProposalById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const proposal = await Proposal.findById(req.params.id)
      .populate('freelancer', 'firstName lastName avatar')
      .populate('gig');

    if (!proposal) {
      res.status(404).json({ success: false, message: 'Proposal not found' });
      return;
    }

    const gig = proposal.gig as any;
    if (gig.client.toString() !== req.user?._id.toString() && proposal.freelancer._id.toString() !== req.user?._id.toString()) {
      res.status(403).json({ success: false, message: 'Not authorized to view this proposal' });
      return;
    }

    res.status(200).json({ success: true, message: 'Proposal retrieved', data: proposal });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProposalStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, clientNotes } = req.body;
    const proposal = await Proposal.findById(req.params.id).populate('gig');

    if (!proposal) {
      res.status(404).json({ success: false, message: 'Proposal not found' });
      return;
    }

    const gig = proposal.gig as any;
    if (gig.client.toString() !== req.user?._id.toString()) {
      res.status(403).json({ success: false, message: 'Only the gig client can update proposal status' });
      return;
    }

    proposal.status = status;
    if (clientNotes) proposal.clientNotes = clientNotes;
    proposal.respondedAt = new Date();
    await proposal.save();

    if (status === ProposalStatus.ACCEPTED) {
      await Gig.findByIdAndUpdate(gig._id, { selectedFreelancer: proposal.freelancer, status: 'in_progress' });
    }

    res.status(200).json({ success: true, message: 'Proposal status updated', data: proposal });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
