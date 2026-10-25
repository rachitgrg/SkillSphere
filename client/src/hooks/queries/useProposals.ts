import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { proposalApi } from '../../api/proposalApi';
import type { ProposalInput, ProposalStatus } from '../../types';
import { keys } from './keys';

export const useMyProposals = (params: { status?: ProposalStatus[]; page?: number; limit?: number } = {}, enabled = true) =>
  useQuery({ queryKey: keys.proposals.mine(params), queryFn: () => proposalApi.getMine(params), enabled });

export const useGigProposals = (gigId: string | undefined) =>
  useQuery({ queryKey: keys.proposals.forGig(gigId ?? ''), queryFn: () => proposalApi.getForGig(gigId!), enabled: Boolean(gigId) });

/** Refreshes everything a proposal change can affect (lists, gig counters). */
const useInvalidateProposals = () => {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.proposals.all }),
      queryClient.invalidateQueries({ queryKey: keys.gigs.all }),
    ]);
};

export const useSubmitProposal = () => {
  const invalidate = useInvalidateProposals();
  return useMutation({ mutationFn: (input: ProposalInput) => proposalApi.submit(input), onSuccess: invalidate });
};

export const useWithdrawProposal = () => {
  const invalidate = useInvalidateProposals();
  return useMutation({ mutationFn: (id: string) => proposalApi.withdraw(id), onSuccess: invalidate });
};

export const useNegotiateProposal = () => {
  const invalidate = useInvalidateProposals();
  return useMutation({
    mutationFn: ({ id, amount, message }: { id: string; amount: number; message: string }) => proposalApi.negotiate(id, amount, message),
    onSuccess: invalidate,
  });
};

export const useUpdateProposalStatus = () => {
  const invalidate = useInvalidateProposals();
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: 'accepted' | 'rejected' | 'negotiating'; notes?: string }) =>
      proposalApi.updateStatus(id, status, notes),
    onSuccess: invalidate,
  });
};
