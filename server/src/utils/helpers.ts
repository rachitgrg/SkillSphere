import crypto from 'crypto';
import { Types } from 'mongoose';
import { PaginationOptions } from '../types';

export const generateRandomToken = (bytes: number = 32): string => {
  return crypto.randomBytes(bytes).toString('hex');
};

export const isValidObjectId = (id: string): boolean => {
  return Types.ObjectId.isValid(id);
};

export const parsePaginationParams = (
  query: Record<string, unknown>
): PaginationOptions => {
  const page = Math.max(1, parseInt(query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string, 10) || 10));

  let sort: Record<string, 1 | -1> = { createdAt: -1 };
  if (query.sortBy) {
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    sort = { [query.sortBy as string]: sortOrder };
  }

  return { page, limit, sort };
};

export const buildPaginationResponse = (
  total: number,
  page: number,
  limit: number
) => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit),
});

export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
};

export const sanitizeInput = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

export const calculatePercentageChange = (
  current: number,
  previous: number
): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 100) / 100;
};

export const formatCurrency = (
  amount: number,
  currency: string = 'INR'
): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const getDateRange = (
  period: 'today' | 'week' | 'month' | 'year'
): { start: Date; end: Date } => {
  const now = new Date();
  const start = new Date();
  const end = new Date(now);

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start.setMonth(now.getMonth() - 1);
      break;
    case 'year':
      start.setFullYear(now.getFullYear() - 1);
      break;
  }

  return { start, end };
};

export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/** Copies only `keys` that are present on `obj` (undefined values are skipped). Guards against mass assignment. */
export const pick = <K extends string>(
  obj: Record<string, unknown> | null | undefined,
  keys: readonly K[]
): Partial<Record<K, unknown>> => {
  const out: Partial<Record<K, unknown>> = {};
  if (!obj) return out;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
};
