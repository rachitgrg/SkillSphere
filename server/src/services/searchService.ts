import { PipelineStage } from 'mongoose';
import Gig from '../models/Gig';
import FreelancerProfile from '../models/FreelancerProfile';
import { GigStatus } from '../types';
import { containsRegex, escapeRegex } from '../utils/helpers';
import { toStringList } from './gigQuery';

const toNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

/** `experience` accepts a level (entry/intermediate/expert) or a minimum number of years. */
const EXPERIENCE_YEARS: Record<string, number> = { entry: 0, intermediate: 2, expert: 5 };

const FREELANCER_SORTS: Record<string, Record<string, 1 | -1>> = {
  rating: { averageRating: -1, totalReviews: -1 },
  rate_low: { hourlyRate: 1 },
  rate_high: { hourlyRate: -1 },
  experience: { completedGigs: -1 },
  newest: { createdAt: -1 },
};

const TRENDING_TTL_MS = 60 * 60 * 1000;

export interface TrendingSkill {
  skill: string;
  count: number;
  previousCount: number;
  growth: number; // % change vs the previous window
}

let trendingCache: { at: number; days: number; data: TrendingSkill[] } | null = null;

class SearchService {
  /**
   * Freelancer search over profiles joined with their (active, non-banned) users.
   * Filters: q (text), skills, minRate/maxRate, minRating, experience.
   * Sort: relevance (default with q) | rating | rate_low | rate_high | experience | newest.
   */
  async searchFreelancers(query: Record<string, unknown>, page: number, limit: number) {
    const match: Record<string, unknown> = {};
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    if (q) match.$text = { $search: q };

    const skills = toStringList(query.skills);
    if (skills.length) match['skills.name'] = { $in: skills.map((s) => new RegExp(`^${escapeRegex(s)}$`, 'i')) };

    const minRate = toNumber(query.minRate);
    const maxRate = toNumber(query.maxRate);
    if (minRate !== undefined || maxRate !== undefined) {
      match.hourlyRate = {
        ...(minRate !== undefined && { $gte: minRate }),
        ...(maxRate !== undefined && { $lte: maxRate }),
      };
    }

    const minRating = toNumber(query.minRating);
    if (minRating !== undefined) match.averageRating = { $gte: minRating };

    const experience = typeof query.experience === 'string' ? query.experience : '';
    const minYears = EXPERIENCE_YEARS[experience] ?? toNumber(experience);
    if (minYears) match.skills = { $elemMatch: { yearsOfExperience: { $gte: minYears } } };

    const sortKey = typeof query.sort === 'string' ? query.sort : '';
    const sort: Record<string, 1 | -1> = FREELANCER_SORTS[sortKey] ?? (q ? { score: -1 } : FREELANCER_SORTS.rating);

    const pipeline: PipelineStage[] = [
      { $match: match },
      ...(q ? [{ $addFields: { score: { $meta: 'textScore' } } } as PipelineStage] : []),
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $match: { 'user.isActive': true, 'user.isBanned': false } },
      {
        $project: {
          'user.password': 0,
          'user.refreshToken': 0,
          'user.email': 0,
          'user.phone': 0,
          'user.twoFactorSecret': 0,
          'user.passwordResetToken': 0,
          'user.passwordResetExpires': 0,
          'user.emailVerificationToken': 0,
          'user.emailVerificationExpires': 0,
          'user.googleId': 0,
          'user.__v': 0,
          __v: 0,
        },
      },
      { $sort: sort },
      { $facet: { data: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: 'count' }] } },
    ];

    const [result] = await FreelancerProfile.aggregate<{ data: unknown[]; total: { count: number }[] }>(pipeline);
    return { freelancers: result.data, total: result.total[0]?.count ?? 0 };
  }

  /** Gig title and skill suggestions for the search box. */
  async getSuggestions(q: string): Promise<{ titles: string[]; skills: string[] }> {
    if (!q || q.trim().length < 2) return { titles: [], skills: [] };
    const pattern = containsRegex(q.trim());

    const [titles, skills] = await Promise.all([
      Gig.find({ title: pattern, status: GigStatus.OPEN, visibility: 'public' }).select('title').limit(8).lean(),
      Gig.aggregate<{ _id: string }>([
        { $match: { status: GigStatus.OPEN } },
        { $unwind: '$skills' },
        { $match: { skills: pattern } },
        { $group: { _id: '$skills', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
    ]);
    return { titles: titles.map((g) => g.title), skills: skills.map((s) => s._id) };
  }

  /**
   * Skills on gigs posted in the last `days` days vs the `days` before that, with growth %.
   * Cached in memory for an hour.
   */
  async getTrendingSkills(days = 30, limit = 15): Promise<TrendingSkill[]> {
    if (trendingCache && trendingCache.days === days && Date.now() - trendingCache.at < TRENDING_TTL_MS) {
      return trendingCache.data.slice(0, limit);
    }

    const now = Date.now();
    const start = new Date(now - days * 86_400_000);
    const prevStart = new Date(now - 2 * days * 86_400_000);

    const rows = await Gig.aggregate<{ _id: string; count: number; previousCount: number }>([
      { $match: { createdAt: { $gte: prevStart } } },
      { $unwind: '$skills' },
      {
        $group: {
          _id: '$skills',
          count: { $sum: { $cond: [{ $gte: ['$createdAt', start] }, 1, 0] } },
          previousCount: { $sum: { $cond: [{ $lt: ['$createdAt', start] }, 1, 0] } },
        },
      },
      { $match: { count: { $gt: 0 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 50 },
    ]);

    const data = rows.map((r) => ({
      skill: r._id,
      count: r.count,
      previousCount: r.previousCount,
      growth: r.previousCount ? Math.round(((r.count - r.previousCount) / r.previousCount) * 100) : 100,
    }));
    trendingCache = { at: now, days, data };
    return data.slice(0, limit);
  }

  /** Categories of open public gigs with counts, for marketplace filters. */
  async getCategories(): Promise<{ category: string; count: number }[]> {
    return Gig.aggregate([
      { $match: { status: GigStatus.OPEN, visibility: 'public' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $project: { _id: 0, category: '$_id', count: 1 } },
    ]);
  }

  /** Test helper. */
  clearCache(): void {
    trendingCache = null;
  }
}

export default new SearchService();
