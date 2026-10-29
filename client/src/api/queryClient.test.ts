import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import { createQueryClient, shouldRetry } from './queryClient';

const httpError = (status: number) =>
  new AxiosError('failed', String(status), undefined, undefined, { status, statusText: '', data: {}, headers: {}, config: { headers: new AxiosHeaders() } });

describe('query client defaults', () => {
  it('never retries 4xx responses', () => {
    for (const status of [400, 401, 403, 404, 409, 429]) expect(shouldRetry(0, httpError(status))).toBe(false);
  });

  it('retries 5xx and network errors at most twice', () => {
    expect(shouldRetry(0, httpError(503))).toBe(true);
    expect(shouldRetry(1, new AxiosError('Network Error'))).toBe(true);
    expect(shouldRetry(2, httpError(500))).toBe(false);
  });

  it('keeps data fresh for 30 seconds', () => {
    expect(createQueryClient().getDefaultOptions().queries?.staleTime).toBe(30_000);
  });
});
