import { PipelineStage } from 'mongoose';
import Gig from '../models/Gig';
import FreelancerProfile from '../models/FreelancerProfile';
import { GigStatus } from '../types';
import { containsRegex, escapeRegex } from '../utils/helpers';
import { env } from '../config/env';
import { toStringList } from './gigQuery';

const toNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

/** `experience` accepts a level (entry/intermediate/expert) or a minimum number of years. */
const EXPERIENCE_YEARS: Record<string, number> = { entry: 0, intermediate: 2, expert: 5 };

const FREELANCER_SORTS: Record<string, Record<string, 1 | -1>> = {
  rating: { rank: -1, totalReviews: -1 },
  rate_low: { hourlyRate: 1 },
  rate_high: { hourlyRate: -1 },
  experience: { completedGigs: -1 },
  newest: { createdAt: -1 },
};

const TRENDING_TTL_MS = 60 * 60 * 1000;

/** Haversine distance in metres from `[lng, lat]` to the document's `location` (Atlas path, after $search). */
const geoDistanceExpr = ([lng, lat]: [number, number]) => {
  const rad = (v: unknown) => ({ $degreesToRadians: v });
  const docLng = { $arrayElemAt: ['$location.coordinates', 0] };
  const docLat = { $arrayElemAt: ['$location.coordinates', 1] };
  const dLat = { $subtract: [rad(docLat), rad(lat)] };
  const dLng = { $subtract: [rad(docLng), rad(lng)] };
  const h = {
    $add: [
      { $pow: [{ $sin: { $divide: [dLat, 2] } }, 2] },
      { $multiply: [{ $cos: rad(lat) }, { $cos: rad(docLat) }, { $pow: [{ $sin: { $divide: [dLng, 2] } }, 2] }] },
    ],
  };
  return { $multiply: [2 * 6_371_000, { $asin: { $sqrt: h } }] };
};

export interface TrendingSkill {
  skill: string;
  count: number;
  previousCount: number;
  growth: number; // % change vs the previous window
}

let trendingCache: { at: number; days: number; data: TrendingSkill[] } | null = null;

class SearchService {
  /**
   * Builds the freelancer search pipeline over profiles joined with their (active, non-banned) users.
   *
   * Filters: q (text), skills, minRate/maxRate, minRating, experience (level or min years),
   * availability (available|busy), verified=true, lat+lng+radiusKm (default 25 km).
   * Sort: relevance (default with q) | rating | rate_low | rate_high | experience | newest | distance.
   *
   * Geo uses `$geoNear` (must be the first stage, and can't be combined with `$text`), so a text
   * query next to a location falls back to an escaped regex. With USE_ATLAS_SEARCH=true a text query
   * uses an Atlas `$search` stage (fuzzy text, optional geoWithin circle) instead — see
   * docs/atlas-search-index.json.
   */
  buildFreelancerPipeline(query: Record<string, unknown>, page: number, limit: number): PipelineStage[] {
    const match: Record<string, unknown> = {};
    const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';

    const lat = toNumber(query.lat);
    const lng = toNumber(query.lng);
    const geo = lat !== undefined && lng !== undefined && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? ([lng, lat] as [number, number]) : null;
    const radiusKm = Math.min(Math.max(toNumber(query.radiusKm) ?? 25, 1), 500);
    const atlas = env.USE_ATLAS_SEARCH && Boolean(q);

    if (q && !atlas) {
      if (geo) {
        const pattern = containsRegex(q);
        match.$or = [{ title: pattern }, { headline: pattern }, { 'skills.name': pattern }];
      } else {
        match.$text = { $search: q };
      }
    }

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

    if (query.verified === 'true') match['verification.status'] = 'verified';

    const availability = toStringList(query.availability).filter((a) => ['available', 'busy'].includes(a));
    if (availability.length) match.availability = { $in: availability };

    // Relevance and rating sorts give verified freelancers a small boost (10% relevance, +0.25 stars).
    const sortKey = typeof query.sort === 'string' ? query.sort : '';
    const textRanked = Boolean(q) && (atlas || !geo);
    const sort: Record<string, 1 | -1> =
      sortKey === 'distance' && geo ? { distanceKm: 1 } : FREELANCER_SORTS[sortKey] ?? (textRanked ? { rank: -1 } : { rank: -1, totalReviews: -1 });
    const isVerified = { $eq: ['$verification.status', 'verified'] };
    const relevance = atlas ? { $meta: 'searchScore' } : { $meta: 'textScore' };
    const rank = textRanked
      ? { $multiply: [relevance, { $cond: [isVerified, 1.1, 1] }] }
      : { $add: ['$averageRating', { $cond: [isVerified, 0.25, 0] }] };

    const first: PipelineStage[] = atlas
      ? [
          {
            $search: {
              index: 'freelancers',
              compound: {
                must: [{ text: { query: q, path: ['title', 'headline', 'skills.name'], fuzzy: { maxEdits: 1 } } }],
                ...(geo && { filter: [{ geoWithin: { circle: { center: { type: 'Point', coordinates: geo }, radius: radiusKm * 1000 }, path: 'location' } }] }),
              },
            },
          } as PipelineStage,
          ...(geo ? [{ $addFields: { distanceMeters: geoDistanceExpr(geo) } } as PipelineStage] : []),
          { $match: match },
        ]
      : geo
        ? [
            {
              $geoNear: {
                near: { type: 'Point', coordinates: geo },
                distanceField: 'distanceMeters',
                maxDistance: radiusKm * 1000,
                spherical: true,
                query: match,
              },
            },
          ]
        : [{ $match: match }];

    return [
      ...first,
      { $addFields: { rank, ...(geo && { distanceKm: { $round: [{ $divide: ['$distanceMeters', 1000] }, 1] } }) } },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
          // Public user fields only.
          pipeline: [{ $project: { firstName: 1, lastName: 1, avatar: 1, bio: 1, address: 1, role: 1, isVerified: 1, isActive: 1, isBanned: 1, createdAt: 1, lastLogin: 1 } }],
        },
      },
      { $unwind: '$user' },
      { $match: { 'user.isActive': true, 'user.isBanned': false } },
      // Aggregations ignore select:false, so private profile fields are dropped explicitly.
      { $project: { embedding: 0, 'verification.documents': 0, 'portfolio.imagePublicIds': 0, distanceMeters: 0, __v: 0 } },
      { $sort: sort },
      { $facet: { data: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: 'count' }] } },
    ];
  }

  async searchFreelancers(query: Record<string, unknown>, page: number, limit: number) {
    const [result] = await FreelancerProfile.aggregate<{ data: unknown[]; total: { count: number }[] }>(this.buildFreelancerPipeline(query, page, limit));
    return { freelancers: result.data, total: result.total[0]?.count ?? 0 };
  }

  /**
   * Atlas Search variant of the gig search (USE_ATLAS_SEARCH=true with a text query): fuzzy `$search`
   * on title/description/skills/tags, then the usual marketplace filter (without `$text`).
   */
  async searchGigsAtlas(q: string, filter: Record<string, unknown>, sort: Record<string, unknown>, page: number, limit: number) {
    const { $text: _text, ...rest } = filter;
    const textSort = Object.values(sort).some((v) => typeof v === 'object');
    const [result] = await Gig.aggregate<{ data: unknown[]; total: { count: number }[] }>([
      { $search: { index: 'gigs', text: { query: q.slice(0, 100), path: ['title', 'description', 'skills', 'tags'], fuzzy: { maxEdits: 1 } } } } as PipelineStage,
      { $match: rest },
      { $addFields: { score: { $meta: 'searchScore' } } },
      { $sort: (textSort ? { score: -1 } : sort) as Record<string, 1 | -1> },
      { $project: { embedding: 0 } },
      { $facet: { data: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: 'count' }] } },
    ]);
    const gigs = await Gig.populate(result.data, { path: 'client', select: 'firstName lastName avatar' });
    return { gigs, total: result.total[0]?.count ?? 0 };
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
