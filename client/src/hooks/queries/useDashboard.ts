import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { analyticsApi } from '../../api/analyticsApi';
import { gigApi } from '../../api/gigApi';
import { paymentApi } from '../../api/paymentApi';
import { notificationApi } from '../../api/notificationApi';
import { aiApi } from '../../api/aiApi';
import type { AnalyticsPeriod, GigInput, GigStatus, PaymentStatus } from '../../types';
import { keys } from './keys';

export const useClientAnalytics = (period: AnalyticsPeriod = '12m') =>
  useQuery({ queryKey: keys.analytics.client(period), queryFn: () => analyticsApi.getClient(period) });

export const useFreelancerAnalytics = (period: AnalyticsPeriod = '12m') =>
  useQuery({ queryKey: keys.analytics.freelancer(period), queryFn: () => analyticsApi.getFreelancer(period) });

export const useMyGigs = (params: { status?: GigStatus[]; page?: number; limit?: number } = {}) =>
  useQuery({ queryKey: keys.gigs.mine(params), queryFn: () => gigApi.getMyGigs(params), placeholderData: keepPreviousData });

export const useRecommendations = (enabled = true) =>
  useQuery({ queryKey: keys.ai.recommendations, queryFn: () => aiApi.getRecommendations(6), enabled });

export const usePaymentHistory = (params: { status?: PaymentStatus; page?: number; limit?: number } = {}) =>
  useQuery({ queryKey: keys.payments.history(params), queryFn: () => paymentApi.getHistory(params), placeholderData: keepPreviousData });

export const usePaymentSummary = () => useQuery({ queryKey: keys.payments.summary, queryFn: paymentApi.getSummary });

export const useRecentNotifications = (limit = 5) =>
  useQuery({ queryKey: keys.notifications.list({ limit }), queryFn: () => notificationApi.getNotifications({ limit }) });

export const useCreateGig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GigInput) => gigApi.createGig(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.gigs.all }),
  });
};

export const useCancelGig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gigApi.cancelGig(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.gigs.all }),
  });
};

export const useDeleteGig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gigApi.deleteGig(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.gigs.all }),
  });
};
