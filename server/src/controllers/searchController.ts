import { Request, Response } from 'express';
import Gig from '../models/Gig';
import FreelancerProfile from '../models/FreelancerProfile';
import aiMatchingService from '../services/aiMatchingService';

export const searchGigs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, category, skills, minBudget, maxBudget } = req.query;
    
    let query: any = { status: 'open' };

    if (q) {
      query.$text = { $search: q as string };
    }
    if (category) {
      query.category = category;
    }
    if (skills) {
      const skillsArray = (skills as string).split(',').map(s => s.trim());
      query.skills = { $in: skillsArray };
    }
    if (minBudget || maxBudget) {
      query.budgetMin = {};
      if (minBudget) query.budgetMin.$gte = Number(minBudget);
      if (maxBudget) query.budgetMin.$lte = Number(maxBudget);
    }

    const gigs = await Gig.find(query)
      .populate('client', 'firstName lastName')
      .sort(q ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, message: 'Gigs found', data: gigs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const searchFreelancers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, skills, minRate, maxRate } = req.query;

    let query: any = {};
    if (q) {
      query.$text = { $search: q as string };
    }
    if (skills) {
      const skillsArray = (skills as string).split(',').map(s => s.trim());
      query['skills.name'] = { $in: skillsArray };
    }
    if (minRate || maxRate) {
      query.hourlyRate = {};
      if (minRate) query.hourlyRate.$gte = Number(minRate);
      if (maxRate) query.hourlyRate.$lte = Number(maxRate);
    }

    const freelancers = await FreelancerProfile.find(query)
      .populate('user', 'firstName lastName avatar')
      .sort(q ? { score: { $meta: 'textScore' } } : { averageRating: -1 })
      .limit(50);

    res.status(200).json({ success: true, message: 'Freelancers found', data: freelancers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMatchesForGig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gigId } = req.params;
    const gig = await Gig.findById(gigId);
    
    if (!gig) {
      res.status(404).json({ success: false, message: 'Gig not found' });
      return;
    }

    // Using AI Service
    const matches = await aiMatchingService.matchFreelancersToGig(gig as any);

    res.status(200).json({ success: true, message: 'Matches generated', data: matches });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
