import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { proposalApi } from '../../api/proposalApi';
import type { Proposal } from '../../types';
import { useAcceptOffer } from './offers';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

describe('useAcceptOffer (P2-4)', () => {
  it("accepts through the accept-offer endpoint instead of echoing the client's counter", async () => {
    const accept = vi.spyOn(proposalApi, 'acceptOffer').mockResolvedValue({} as Proposal);
    const negotiate = vi.spyOn(proposalApi, 'negotiate');
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useAcceptOffer(), { wrapper });

    await act(() => result.current.accept({ _id: 'p1', proposedAmount: 9000, finalAmount: 7000, negotiationHistory: [] } as unknown as Proposal));

    expect(accept).toHaveBeenCalledWith('p1');
    expect(negotiate).not.toHaveBeenCalled();
  });
});
