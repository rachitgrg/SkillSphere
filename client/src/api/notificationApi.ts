import axiosInstance from './axiosInstance';

export const notificationApi = {
  getNotifications: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
    axiosInstance.get('/notifications', { params }),

  markAsRead: (id: string) =>
    axiosInstance.put(`/notifications/${id}/read`),

  markAllAsRead: () =>
    axiosInstance.put('/notifications/read-all'),

  deleteNotification: (id: string) =>
    axiosInstance.delete(`/notifications/${id}`),

  getUnreadCount: () =>
    axiosInstance.get('/notifications/unread-count'),

  updatePreferences: (data: Record<string, boolean>) =>
    axiosInstance.put('/notifications/preferences', data),
};
