import axiosInstance from './axiosInstance';

export const adminApi = {
  getDashboardStats: () =>
    axiosInstance.get('/admin/stats'),

  getUsers: (params?: { page?: number; limit?: number; role?: string; search?: string; status?: string }) =>
    axiosInstance.get('/admin/users', { params }),

  getUserById: (id: string) =>
    axiosInstance.get(`/admin/users/${id}`),

  updateUserStatus: (id: string, data: { isActive?: boolean; isVerified?: boolean }) =>
    axiosInstance.put(`/admin/users/${id}/status`, data),

  deleteUser: (id: string) =>
    axiosInstance.delete(`/admin/users/${id}`),

  getPendingGigs: (params?: { page?: number; limit?: number }) =>
    axiosInstance.get('/admin/gigs/pending', { params }),

  approveGig: (id: string) =>
    axiosInstance.put(`/admin/gigs/${id}/approve`),

  rejectGig: (id: string, reason: string) =>
    axiosInstance.put(`/admin/gigs/${id}/reject`, { reason }),

  getTransactions: (params?: { page?: number; limit?: number; status?: string }) =>
    axiosInstance.get('/admin/transactions', { params }),

  getDisputes: (params?: { page?: number; limit?: number; status?: string }) =>
    axiosInstance.get('/admin/disputes', { params }),

  resolveDispute: (id: string, data: { decision: string; refundAmount?: number }) =>
    axiosInstance.put(`/admin/disputes/${id}/resolve`, data),

  getAnalytics: (params?: { period?: string; type?: string }) =>
    axiosInstance.get('/admin/analytics', { params }),

  getRevenueChart: (period?: string) =>
    axiosInstance.get('/admin/analytics/revenue', { params: { period } }),

  getUserGrowthChart: (period?: string) =>
    axiosInstance.get('/admin/analytics/user-growth', { params: { period } }),

  getCategoryStats: () =>
    axiosInstance.get('/admin/analytics/categories'),

  manageCategory: (data: { name: string; description?: string }) =>
    axiosInstance.post('/admin/categories', data),
};
