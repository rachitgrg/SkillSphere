import { QueryFilter, SortOrder, Types } from 'mongoose';
import { GigStatus, IGig } from '../types';
import { exactRegex } from '../utils/helpers';

/** Accepts `?skills=a,b`, `?skills=a&skills=b` or a JSON-less array and returns trimmed, non-empty values. */
export const toStringList = (value: unknown): string[] => {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return raw.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean);
};

/** True when `userId` has been invited to the gig. */
export const isInvited = (gig: Pick<IGig, 'invitations'>, userId: Types.ObjectId | string): boolean =>
  (gig.invitations ?? []).some((i) => i.freelancer.toString() === userId.toString());

const toNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const pickEnum = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

/**
 * Builds the filter for the public marketplace: only open, public gigs, plus optional
 * text, category, skills, budget-range overlap, budget type, experience, location type and
 * near-me (lat, lng, radiusKm).
 * Budget overlap: a gig [budgetMin, budgetMax] matches the requested [min, max] when
 * gig.budgetMin <= max && gig.budgetMax >= min.
 */
export const buildPublicGigFilter = (query: Record<string, unknown>): QueryFilter<IGig> => {
  const filter: QueryFilter<IGig> = { status: GigStatus.OPEN, visibility: 'public' };

  const q = typeof query.q === 'string' ? query.q.trim() : '';
  if (q) filter.$text = { $search: q };

  if (typeof query.category === 'string' && query.category) filter.category = query.category;

  const skills = toStringList(query.skills);
  if (skills.length) filter.skills = { $in: skills.map(exactRegex) }; // case-insensitive, like freelancer search

  const min = toNumber(query.budgetMin ?? query.minBudget);
  const max = toNumber(query.budgetMax ?? query.maxBudget);
  if (max !== undefined) filter.budgetMin = { $lte: max };
  if (min !== undefined) filter.budgetMax = { $gte: min };

  const budgetType = pickEnum(query.budgetType, ['fixed', 'hourly'] as const);
  if (budgetType) filter.budgetType = budgetType;

  const experienceLevel = pickEnum(query.experienceLevel, ['entry', 'intermediate', 'expert'] as const);
  if (experienceLevel) filter.experienceLevel = experienceLevel;

  const locationType = pickEnum(query.locationType, ['remote', 'onsite', 'hybrid'] as const);
  if (locationType) filter.locationType = locationType;

  // "Near me": gigs whose location lies within radiusKm (default 25) of lat/lng. $geoWithin (unlike
  // $near) combines with $text and countDocuments; remote gigs have no location and drop out.
  const lat = toNumber(query.lat);
  const lng = toNumber(query.lng);
  if (lat !== undefined && lng !== undefined && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    const radiusKm = Math.min(Math.max(toNumber(query.radiusKm) ?? 25, 1), 500);
    filter.location = { $geoWithin: { $centerSphere: [[lng, lat], radiusKm / 6371] } };
  }

  return filter;
};

const SORTS: Record<string, Record<string, SortOrder>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  budget_high: { budgetMax: -1, createdAt: -1 },
  budget_low: { budgetMin: 1, createdAt: -1 },
  popular: { totalProposals: -1, views: -1 },
};

export const gigSort = (query: Record<string, unknown>): Record<string, SortOrder | { $meta: 'textScore' }> => {
  const key = typeof query.sort === 'string' ? query.sort : '';
  if (SORTS[key]) return SORTS[key];
  return typeof query.q === 'string' && query.q.trim() ? { score: { $meta: 'textScore' } } : SORTS.newest;
};
