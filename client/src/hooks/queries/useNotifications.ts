import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '../../api/notificationApi';
import { keys } from './keys';

/** Live unread count; SocketContext invalidates `notifications` when a notification arrives. */
export const useUnreadCount = (enabled = true) =>
  useQuery({ queryKey: keys.notifications.unread, queryFn: notificationApi.getUnreadCount, enabled, select: (d) => d.count });

export const useNotifications = (params: { page?: number; limit?: number; unread?: boolean }, enabled = true) =>
  useQuery({
    queryKey: keys.notifications.list(params),
    queryFn: () => notificationApi.getNotifications(params),
    enabled,
    placeholderData: keepPreviousData,
  });

const useInvalidate = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: keys.notifications.all });
};

export const useMarkNotificationRead = () => {
  const onSuccess = useInvalidate();
  return useMutation({ mutationFn: (id: string) => notificationApi.markAsRead(id), onSuccess });
};

export const useMarkAllNotificationsRead = () => {
  const onSuccess = useInvalidate();
  return useMutation({ mutationFn: () => notificationApi.markAllAsRead(), onSuccess });
};

export const useDeleteNotification = () => {
  const onSuccess = useInvalidate();
  return useMutation({ mutationFn: (id: string) => notificationApi.delete(id), onSuccess });
};
