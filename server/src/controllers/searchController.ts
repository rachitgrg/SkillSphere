import { Request, Response, NextFunction } from 'express';
import Gig from '../models/Gig';
import FreelancerProfile from '../models/FreelancerProfile';
import aiMatchingService from '../services/aiMatchingService';
import { QueryFilter } from 'mongoose';
import { IFreelancerProfile } from '../types';
import { buildPublicGigFilter, gigSort, toStringList } from '../services/gigQuery';
import { buildPaginationResponse, parsePaginationParams } from '../utils/helpers';

export const searchGigs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as Record<string, unknown>;
    const { page, limit } = parsePaginationParams(query);
    const filter = buildPublicGigFilter(query);

    const [gigs, total] = await Promise.all([
      Gig.find(filter)
        .populate('client', 'firstName lastName avatar')
        .sort(gigSort(query))
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Gig.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: 'Gigs found',
      data: gigs,
      pagination: buildPaginationResponse(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

export const searchFreelancers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { q, skills, minRate, maxRate } = req.query;

    const query: QueryFilter<IFreelancerProfile> = {};
    if (q) {
      query.$text = { $search: q as string };
    }
    if (skills) {
      query['skills.name'] = { $in: toStringList(skills) };
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
  } catch (error) {
    next(error);
  }
};

export const getMatchesForGig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { gigId } = req.params;
    const gig = await Gig.findById(gigId);
    
    if (!gig) {
      res.status(404).json({ success: false, message: 'Gig not found' });
      return;
    }

    // Using AI Service
    const matches = await aiMatchingService.matchFreelancersToGig(gig);

    res.status(200).json({ success: true, message: 'Matches generated', data: matches });
  } catch (error) {
    next(error);
  }
};
