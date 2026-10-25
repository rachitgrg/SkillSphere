import { QueryFilter, SortOrder } from 'mongoose';
import { GigStatus, IGig } from '../types';

/** Accepts `?skills=a,b`, `?skills=a&skills=b` or a JSON-less array and returns trimmed, non-empty values. */
export const toStringList = (value: unknown): string[] => {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return raw.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean);
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const pickEnum = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

/**
 * Builds the filter for the public marketplace: only open, public gigs, plus optional
 * text, category, skills, budget-range overlap, budget type, experience and location type.
 * Budget overlap: a gig [budgetMin, budgetMax] matches the requested [min, max] when
 * gig.budgetMin <= max && gig.budgetMax >= min.
 */
export const buildPublicGigFilter = (query: Record<string, unknown>): QueryFilter<IGig> => {
  const filter: QueryFilter<IGig> = { status: GigStatus.OPEN, visibility: 'public' };

  const q = typeof query.q === 'string' ? query.q.trim() : '';
  if (q) filter.$text = { $search: q };

  if (typeof query.category === 'string' && query.category) filter.category = query.category;

  const skills = toStringList(query.skills);
  if (skills.length) filter.skills = { $in: skills };

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
