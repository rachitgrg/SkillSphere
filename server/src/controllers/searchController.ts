import { Request, Response, NextFunction } from 'express';
import Gig from '../models/Gig';
import searchService from '../services/searchService';
import { buildPublicGigFilter, gigSort } from '../services/gigQuery';
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
    const query = req.query as Record<string, unknown>;
    const { page, limit } = parsePaginationParams(query);
    const { freelancers, total } = await searchService.searchFreelancers(query, page, limit);
    res.status(200).json({
      success: true,
      message: 'Freelancers found',
      data: freelancers,
      pagination: buildPaginationResponse(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

export const getTrendingSkills = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const limit = Math.min(Math.max(Number(req.query.limit) || 15, 1), 50);
    const skills = await searchService.getTrendingSkills(days, limit);
    res.status(200).json({ success: true, message: 'Trending skills', data: skills });
  } catch (error) {
    next(error);
  }
};

export const getCategories = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(200).json({ success: true, message: 'Categories', data: await searchService.getCategories() });
  } catch (error) {
    next(error);
  }
};

export const getSuggestions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const suggestions = await searchService.getSuggestions(q);
    res.status(200).json({ success: true, message: 'Suggestions', data: suggestions });
  } catch (error) {
    next(error);
  }
};
