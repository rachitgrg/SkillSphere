import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { RedisClient } from './redis';
import User from '../models/User';
import { env } from './env';
import { verifyAccessToken } from '../utils/generateToken';
import { isSuspended } from '../utils/suspension';

let io: Server | null = null;

/** Connected socket count per user id, for presence. */
const onlineCounts = new Map<string, number>();

export const isUserOnline = (userId: string): boolean => (onlineCounts.get(userId) ?? 0) > 0;

/**
 * Creates the single Socket.IO server. One auth middleware verifies the access token and
 * rejects banned/inactive users; each socket joins only its own `user:<id>` room here.
 * Feature handlers (chat, …) are registered per connection.
 */
export const initializeSocket = (
  httpServer: HttpServer,
  handlers: ((io: Server, socket: Socket) => void)[] = []
): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use(async (socket, next) => {
    try {
      const token: unknown = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) return next(new Error('Authentication required'));

      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error('User not found'));
      if (!user.isActive || (await isSuspended(user))) return next(new Error('Account is not active'));

      socket.data.userId = user._id.toString();
      socket.data.role = user.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId: string = socket.data.userId;
    socket.join(`user:${userId}`);

    const count = (onlineCounts.get(userId) ?? 0) + 1;
    onlineCounts.set(userId, count);
    if (count === 1) io!.emit('presence', { userId, online: true });
    socket.emit('presence:list', { online: [...onlineCounts.keys()] });

    socket.on('disconnect', () => {
      const remaining = (onlineCounts.get(userId) ?? 1) - 1;
      if (remaining > 0) {
        onlineCounts.set(userId, remaining);
      } else {
        onlineCounts.delete(userId);
        io?.emit('presence', { userId, online: false });
      }
    });

    for (const register of handlers) register(io!, socket);
  });

  return io;
};

/**
 * With Redis, room emits (`user:<id>`, conversations) reach sockets on every API instance.
 * Presence counts stay per instance, so run a single instance or use sticky sessions for exact presence.
 */
export const attachRedisAdapter = async (redis: RedisClient): Promise<void> => {
  if (!io) return;
  const pub = redis.duplicate();
  const sub = redis.duplicate();
  try {
    await Promise.all([pub.connect(), sub.connect()]);
    io.adapter(createAdapter(pub, sub));
    console.log('Socket.IO using the Redis adapter');
  } catch (error) {
    console.warn(`⚠️  Socket.IO Redis adapter unavailable (${(error as Error).message}); events stay on this instance.`);
    await Promise.all([pub.disconnect().catch(() => undefined), sub.disconnect().catch(() => undefined)]);
  }
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

/** For services that emit opportunistically (e.g. under tests there is no socket server). */
export const getIOOrNull = (): Server | null => io;

/** Test helper: forget the server and presence state. */
export const resetSocketState = (): void => {
  io = null;
  onlineCounts.clear();
};
