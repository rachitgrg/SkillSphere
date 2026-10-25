import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAppSelector } from '../hooks/useRedux';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: string[];
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  onlineUsers: [],
});

// eslint-disable-next-line react-refresh/only-export-components -- hook is colocated with its provider
export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const { token, isAuthenticated } = useAppSelector((state) => state.auth);

  const connectSocket = useCallback(() => {
    if (!token || !isAuthenticated) return;

    const newSocket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('onlineUsers', (users: string[]) => {
      setOnlineUsers(users);
    });

    newSocket.on('userOnline', (userId: string) => {
      setOnlineUsers((prev) => [...new Set([...prev, userId])]);
    });

    newSocket.on('userOffline', (userId: string) => {
      setOnlineUsers((prev) => prev.filter((id) => id !== userId));
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token, isAuthenticated]);

  useEffect(() => {
    const cleanup = connectSocket();
    return () => {
      cleanup?.();
    };
  }, [connectSocket]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};
