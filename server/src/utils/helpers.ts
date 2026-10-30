import { PaginationOptions } from '../types';

export const parsePaginationParams = (
  query: Record<string, unknown>
): PaginationOptions => {
  const page = Math.max(1, parseInt(query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit as string, 10) || 10));
  return { page, limit };
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

export const formatCurrency = (
  amount: number,
  currency: string = 'INR'
): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
  }).format(amount);
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

/** Escapes RegExp metacharacters so user input matches literally (e.g. "C++", "Node.js"). */
export const escapeRegex = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Case-insensitive "contains" matcher for untrusted input. */
export const containsRegex = (input: string): RegExp => new RegExp(escapeRegex(String(input)), 'i');

/** Case-insensitive whole-value matcher for untrusted input ("react" matches "React", not "React Native"). */
export const exactRegex = (input: string): RegExp => new RegExp(`^${escapeRegex(String(input))}$`, 'i');
