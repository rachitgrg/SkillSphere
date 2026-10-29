import { QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

/** Retry network errors and 5xx once more; a 4xx (not found, forbidden, invalid) won't change on retry. */
export const shouldRetry = (failureCount: number, error: unknown) => {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  return failureCount < 2 && !(status !== undefined && status >= 400 && status < 500);
};

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      // Data stays fresh for 30 s; socket events and mutations invalidate what they change anyway.
      queries: { staleTime: 30_000, retry: shouldRetry },
    },
  });
