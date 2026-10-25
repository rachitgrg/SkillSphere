import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

let io: Server;

export const initializeSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware for socket connections
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as JwtPayload;
      socket.data.userId = decoded.id;
      socket.data.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};
