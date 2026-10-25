import axiosInstance from './axiosInstance';
import { data, paginated, toParams } from './request';
import type {
  AdminAnalytics,
  AdminLog,
  AdminPayments,
  AdminStats,
  AdminUserDetails,
  AnalyticsPeriod,
  ApiResponse,
  FraudReport,
  Gig,
  PaymentStatus,
  Review,
  User,
  UserRole,
} from '../types';

export const adminApi = {
  getStats: () => data(axiosInstance.get<ApiResponse<AdminStats>>('/admin/stats')),

  getAnalytics: (period: AnalyticsPeriod = '12m') =>
    data(axiosInstance.get<ApiResponse<AdminAnalytics>>('/admin/analytics', { params: { period } })),

  getUsers: (params?: { search?: string; role?: UserRole; status?: 'active' | 'suspended' | 'inactive'; page?: number; limit?: number }) =>
    paginated(axiosInstance.get<ApiResponse<User[]>>('/admin/users', { params: toParams(params) })),

  getUser: (id: string) => data(axiosInstance.get<ApiResponse<AdminUserDetails>>(`/admin/users/${id}`)),

  /** Omit `durationDays` for an indefinite suspension. */
  suspendUser: (id: string, input: { reason: string; durationDays?: number }) =>
    data(axiosInstance.put<ApiResponse<User>>(`/admin/users/${id}/suspend`, input)),

  unsuspendUser: (id: string) => data(axiosInstance.put<ApiResponse<User>>(`/admin/users/${id}/unsuspend`)),

  getPendingGigs: (params?: { page?: number; limit?: number }) =>
    paginated(axiosInstance.get<ApiResponse<Gig[]>>('/admin/gigs/pending', { params: toParams(params) })),

  approveGig: (id: string) => data(axiosInstance.put<ApiResponse<Gig>>(`/admin/gigs/${id}/approve`)),

  rejectGig: (id: string, reason: string) =>
    data(axiosInstance.put<ApiResponse<Gig>>(`/admin/gigs/${id}/reject`, { reason })),

  getPayments: (params?: { status?: PaymentStatus; page?: number; limit?: number }) =>
    paginated(axiosInstance.get<ApiResponse<AdminPayments>>('/admin/payments', { params: toParams(params) })),

  getFraudReport: () => data(axiosInstance.get<ApiResponse<FraudReport>>('/admin/fraud')),

  setReviewVisibility: (reviewId: string, isVisible: boolean) =>
    data(axiosInstance.put<ApiResponse<Review>>(`/admin/reviews/${reviewId}/visibility`, { isVisible })),

  getLogs: (params?: { action?: string; page?: number; limit?: number }) =>
    paginated(axiosInstance.get<ApiResponse<AdminLog[]>>('/admin/logs', { params: toParams(params) })),
};
