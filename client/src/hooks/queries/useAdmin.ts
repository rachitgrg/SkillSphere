import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { disputeApi } from '../../api/disputeApi';
import type { AnalyticsPeriod, DisputeStatus, PaymentStatus, ResolveDisputeInput, UserRole } from '../../types';
import { keys } from './keys';

export const useAdminStats = () => useQuery({ queryKey: keys.admin.stats, queryFn: adminApi.getStats });

export const useAdminAnalytics = (period: AnalyticsPeriod) =>
  useQuery({ queryKey: keys.admin.analytics(period), queryFn: () => adminApi.getAnalytics(period) });

export const useAdminUsers = (params: { search?: string; role?: UserRole; status?: 'active' | 'suspended' | 'inactive'; page?: number }) =>
  useQuery({ queryKey: keys.admin.users(params), queryFn: () => adminApi.getUsers({ ...params, limit: 15 }), placeholderData: keepPreviousData });

export const useAdminUser = (id: string | null) =>
  useQuery({ queryKey: keys.admin.user(id ?? ''), queryFn: () => adminApi.getUser(id!), enabled: Boolean(id) });

export const usePendingGigs = (page: number) =>
  useQuery({ queryKey: keys.admin.pendingGigs({ page }), queryFn: () => adminApi.getPendingGigs({ page, limit: 10 }), placeholderData: keepPreviousData });

export const useAdminPayments = (params: { status?: PaymentStatus; page?: number }) =>
  useQuery({ queryKey: keys.admin.payments(params), queryFn: () => adminApi.getPayments({ ...params, limit: 15 }), placeholderData: keepPreviousData });

export const useFraudReport = () => useQuery({ queryKey: keys.admin.fraud, queryFn: adminApi.getFraudReport });

export const useAdminLogs = (params: { action?: string; page?: number }) =>
  useQuery({ queryKey: keys.admin.logs(params), queryFn: () => adminApi.getLogs({ ...params, limit: 20 }), placeholderData: keepPreviousData });

export const useDisputes = (params: { status?: DisputeStatus; page?: number }) =>
  useQuery({ queryKey: keys.disputes.list(params), queryFn: () => disputeApi.list({ ...params, limit: 15 }), placeholderData: keepPreviousData });

export const useDispute = (id: string | undefined) =>
  useQuery({ queryKey: keys.disputes.detail(id ?? ''), queryFn: () => disputeApi.get(id!), enabled: Boolean(id) });

/** Every admin mutation refreshes all admin views (and gigs/disputes they touch). */
const useAdminMutation = <TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.admin.all }),
        queryClient.invalidateQueries({ queryKey: keys.gigs.all }),
        queryClient.invalidateQueries({ queryKey: keys.disputes.all }),
      ]),
  });
};

export const useSuspendUser = () =>
  useAdminMutation(({ id, reason, durationDays }: { id: string; reason: string; durationDays?: number }) =>
    adminApi.suspendUser(id, { reason, durationDays })
  );
export const useUnsuspendUser = () => useAdminMutation((id: string) => adminApi.unsuspendUser(id));
export const useApproveGig = () => useAdminMutation((id: string) => adminApi.approveGig(id));
export const useRejectGig = () => useAdminMutation(({ id, reason }: { id: string; reason: string }) => adminApi.rejectGig(id, reason));
export const useSetReviewVisibility = () =>
  useAdminMutation(({ id, isVisible }: { id: string; isVisible: boolean }) => adminApi.setReviewVisibility(id, isVisible));
export const useResolveDispute = () =>
  useAdminMutation(({ id, input }: { id: string; input: ResolveDisputeInput }) => disputeApi.resolve(id, input));

export const useVerifications = (params: { status?: 'pending' | 'verified' | 'rejected'; page?: number }) =>
  useQuery({ queryKey: keys.admin.verifications(params), queryFn: () => adminApi.getVerifications({ ...params, limit: 10 }), placeholderData: keepPreviousData });

/** Approve (`reason` omitted) or reject a verification request. */
export const useReviewVerification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      reason === undefined ? adminApi.verifyFreelancer(userId) : adminApi.rejectVerification(userId, reason),
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: keys.admin.all }), queryClient.invalidateQueries({ queryKey: ['users'] })]),
  });
};
export const useSetDisputeStatus = () =>
  useAdminMutation(({ id, status, note }: { id: string; status: 'under_review' | 'closed'; note?: string }) => disputeApi.setStatus(id, { status, note }));

/** Party/admin dispute actions: only the dispute views need refreshing. */
const useDisputeMutation = <TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.disputes.all }) });
};

export const useAddDisputeMessage = () =>
  useDisputeMutation(({ id, content, files }: { id: string; content: string; files?: File[] }) => disputeApi.addMessage(id, { content, files }));
export const useAddDisputeEvidence = () =>
  useDisputeMutation(({ id, files, description }: { id: string; files: File[]; description?: string }) => disputeApi.addEvidence(id, files, description));
