import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '../../api/aiApi';
import { gigApi } from '../../api/gigApi';
import { searchApi } from '../../api/searchApi';
import type { GigFilters } from '../../types';
import { keys } from './keys';

/** Public marketplace listing with server-side filters; keeps the previous page while loading the next. */
export const useGigs = (filters: GigFilters) =>
  useQuery({
    queryKey: keys.gigs.list(filters),
    queryFn: () => gigApi.getGigs(filters),
    placeholderData: keepPreviousData,
  });

export const useGig = (id: string | undefined) =>
  useQuery({
    queryKey: keys.gigs.detail(id ?? ''),
    queryFn: () => gigApi.getGig(id!),
    enabled: Boolean(id),
  });

export const useCategories = () =>
  useQuery({ queryKey: keys.search.categories, queryFn: searchApi.getCategories, staleTime: 5 * 60_000 });

export const useTrendingSkills = () =>
  useQuery({ queryKey: keys.search.trending, queryFn: () => searchApi.getTrendingSkills({ limit: 20 }), staleTime: 10 * 60_000 });

/** Client: AI-ranked freelancers for one of their gigs. */
export const useGigMatches = (gigId: string | undefined, enabled = true, limit = 10) =>
  useQuery({ queryKey: [...keys.ai.matches(gigId ?? ''), limit], queryFn: () => aiApi.getGigMatches(gigId!, limit), enabled: Boolean(gigId) && enabled, retry: false });

export const useMyInvitations = (enabled = true) => useQuery({ queryKey: keys.gigs.invitations, queryFn: gigApi.getInvitations, enabled });

/** Mutations on one gig refresh it (and lists) on success. */
const useGigMutation = <TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.gigs.all }) });
};

export const useInviteFreelancer = () =>
  useGigMutation(({ gigId, freelancerId, message }: { gigId: string; freelancerId: string; message?: string }) => gigApi.invite(gigId, freelancerId, message));

export const useDeclineInvitation = () => useGigMutation((gigId: string) => gigApi.declineInvitation(gigId));

export const useAddAttachments = () => useGigMutation(({ gigId, files }: { gigId: string; files: File[] }) => gigApi.addAttachments(gigId, files));

export const useRemoveAttachment = () =>
  useGigMutation(({ gigId, attachmentId }: { gigId: string; attachmentId: string }) => gigApi.removeAttachment(gigId, attachmentId));
