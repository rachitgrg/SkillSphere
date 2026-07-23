import { Response } from 'express';
import Gig from '../models/Gig';
import { AuthRequest, UserRole, GigStatus } from '../types';

export const createGig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== UserRole.CLIENT) {
      res.status(403).json({ success: false, message: 'Only clients can create gigs' });
      return;
    }

    const gig = new Gig({
      ...req.body,
      client: req.user._id,
      status: GigStatus.OPEN,
      totalProposals: 0,
      views: 0,
      proposals: []
    });

    await gig.save();
    res.status(201).json({ success: true, message: 'Gig created successfully', data: gig });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getGigs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, category, status } = req.query;
    const query: any = {};
    if (category) query.category = category;
    if (status) query.status = status;

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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getGigById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gig = await Gig.findById(req.params.id)
      .populate('client', 'firstName lastName avatar')
      .populate('selectedFreelancer', 'firstName lastName avatar');
      
    if (!gig) {
      res.status(404).json({ success: false, message: 'Gig not found' });
      return;
    }

    gig.views += 1;
    await gig.save();

    res.status(200).json({ success: true, message: 'Gig retrieved', data: gig });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateGig = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const updatedGig = await Gig.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.status(200).json({ success: true, message: 'Gig updated', data: updatedGig });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteGig = async (req: AuthRequest, res: Response): Promise<void> => {
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

    await Gig.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Gig deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
