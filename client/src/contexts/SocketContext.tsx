import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAppSelector } from '../hooks/useRedux';
import { store } from '../store/store';
import { keys } from '../hooks/queries/keys';
import type { Notification } from '../types';

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

/**
 * One Socket.IO connection per signed-in user. The access token is read at handshake time
 * (including reconnects), so refreshing it doesn't require a new connection.
 */
export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const userId = useAppSelector((state) => state.auth.user?._id);
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    const s = io(window.location.origin, {
      auth: (cb) => cb({ token: store.getState().auth.token }),
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => setIsConnected(true));
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
      s.close();
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers(new Set());
    };
  }, [userId, queryClient]);

  return <SocketContext.Provider value={{ socket, isConnected, onlineUsers }}>{children}</SocketContext.Provider>;
};
