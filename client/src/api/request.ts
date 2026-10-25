import type { AxiosResponse } from 'axios';
import type { ApiResponse, Paginated } from '../types';

/** Resolves to the `data` field of an API response. */
export const data = <T>(request: Promise<AxiosResponse<ApiResponse<T>>>): Promise<T> =>
  request.then((res) => res.data.data);

/** Resolves to `{ items, pagination }` for paginated list endpoints. */
export const paginated = <T>(request: Promise<AxiosResponse<ApiResponse<T>>>): Promise<Paginated<T>> =>
  request.then((res) => ({
    items: res.data.data,
    pagination: res.data.pagination ?? { page: 1, limit: 0, total: 0, pages: 0 },
  }));

/**
 * Converts filter objects to query params: drops empty values and joins arrays with commas
 * (the server accepts `skills=a,b`).
 */
export const toParams = (filters?: object): Record<string, string | number | boolean> => {
  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(filters ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) params[key] = value.join(',');
    } else {
      params[key] = value as string | number | boolean;
    }
  }
  return params;
};
