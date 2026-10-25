import axiosInstance from './axiosInstance';
import { paginated, data, toParams } from './request';
import type { ApiResponse, Notification, NotificationPage } from '../types';

export const notificationApi = {
  getNotifications: (params?: { page?: number; limit?: number; unread?: boolean }) =>
    paginated(axiosInstance.get<ApiResponse<NotificationPage>>('/notifications', { params: toParams(params) })),

  getUnreadCount: () => data(axiosInstance.get<ApiResponse<{ count: number }>>('/notifications/unread-count')),

  markAsRead: (id: string) => data(axiosInstance.put<ApiResponse<Notification>>(`/notifications/${id}/read`)),

  markAllAsRead: () => axiosInstance.put('/notifications/read-all'),

  delete: (id: string) => axiosInstance.delete(`/notifications/${id}`),
};
