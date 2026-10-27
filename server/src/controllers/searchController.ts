import { Request, Response, NextFunction } from 'express';
import Gig from '../models/Gig';
import searchService from '../services/searchService';
import { buildPublicGigFilter, gigSort } from '../services/gigQuery';
import { buildPaginationResponse, parsePaginationParams } from '../utils/helpers';
import { env } from '../config/env';
import cacheService from '../services/cacheService';

/** Public search results are cached briefly; approvals and profile edits invalidate them. */
const SEARCH_TTL_S = 60;

/** Same filters in any order → same key. */
const queryKey = (scope: string, query: Record<string, unknown>) =>
  `search:${scope}:${JSON.stringify(Object.keys(query).sort().map((k) => [k, query[k]]))}`;

export const searchGigs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as Record<string, unknown>;
    const { page, limit } = parsePaginationParams(query);
    const filter = buildPublicGigFilter(query);
    const q = typeof query.q === 'string' ? query.q.trim() : '';

    const { gigs, total } = await cacheService.wrap(queryKey('gigs', query), SEARCH_TTL_S, async () => {
      if (env.USE_ATLAS_SEARCH && q) return searchService.searchGigsAtlas(q, filter as Record<string, unknown>, gigSort(query), page, limit);
      const [found, count] = await Promise.all([
        Gig.find(filter)
          .populate('client', 'firstName lastName avatar')
          .sort(gigSort(query))
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Gig.countDocuments(filter),
      ]);
      return { gigs: found, total: count };
    });

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
    const { freelancers, total } = await cacheService.wrap(queryKey('freelancers', query), SEARCH_TTL_S, () => searchService.searchFreelancers(query, page, limit));
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
