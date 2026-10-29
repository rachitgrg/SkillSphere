import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import { useAppSelector } from '../hooks/useRedux';
import { store } from '../store/store';
import { logout } from '../store/slices/authSlice';
import { refreshAccessToken } from '../api/axiosInstance';
import { keys } from '../hooks/queries/keys';
import type { Notification } from '../types';
import { SOCKET_URL } from '../config';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Set<string>;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  onlineUsers: new Set(),
});

// eslint-disable-next-line react-refresh/only-export-components -- hook is colocated with its provider
export const useSocket = () => useContext(SocketContext);

/** Handshake rejections from the server's auth middleware that a fresh access token fixes. */
const TOKEN_ERRORS = new Set(['Invalid token', 'Authentication required']);
const MAX_TOKEN_RETRIES = 3;

/**
 * One Socket.IO connection per signed-in user. The access token is read at handshake time
 * (including reconnects), so refreshing it doesn't require a new connection. Socket.IO does not
 * retry a handshake the server rejected, so after the token expires (a reconnect after sleep or a
 * server restart) we refresh it and connect again ourselves.
 */
export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const userId = useAppSelector((state) => state.auth.user?._id);
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    const s = io(SOCKET_URL, {
      auth: (cb) => cb({ token: store.getState().auth.token }),
      transports: ['websocket', 'polling'],
    });

    let tokenRetries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    s.on('connect', () => {
      tokenRetries = 0;
      setIsConnected(true);
    });
    s.on('connect_error', async (error: Error) => {
      if (!TOKEN_ERRORS.has(error.message) || tokenRetries >= MAX_TOKEN_RETRIES) return;
      tokenRetries += 1;
      try {
        await refreshAccessToken();
        s.connect();
      } catch (refreshError) {
        const status = isAxiosError(refreshError) ? refreshError.response?.status : undefined;
        if (status === 401 || status === 403) {
          // The session itself is gone: sign out like any other failed refresh.
          store.dispatch(logout());
          queryClient.clear();
        } else {
          retryTimer = setTimeout(() => s.connect(), 2000 * tokenRetries); // network/server trouble
        }
      }
    });
    s.on('disconnect', () => setIsConnected(false));
    s.on('presence:list', ({ online }: { online: string[] }) => setOnlineUsers(new Set(online)));
    s.on('presence', ({ userId: id, online }: { userId: string; online: boolean }) =>
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (online) next.add(id);
        else next.delete(id);
        return next;
      })
    );

    // A message arrived in one of my conversations (possibly not the open one).
    s.on('conversation:updated', () => queryClient.invalidateQueries({ queryKey: keys.chat.conversations }));

    // Real-time notifications: refresh lists/counters and show a toast.
    s.on('notification', ({ notification }: { notification: Notification }) => {
      queryClient.invalidateQueries({ queryKey: keys.notifications.all });
      toast(notification.title, { icon: '🔔' });
    });

    setSocket(s);
    return () => {
      clearTimeout(retryTimer);
      s.close();
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers(new Set());
    };
  }, [userId, queryClient]);

  return <SocketContext.Provider value={{ socket, isConnected, onlineUsers }}>{children}</SocketContext.Provider>;
};
