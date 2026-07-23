import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { JwtPayload } from '../types';

export const notificationSocket = (io: Server) => {
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error'));
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error('User not found'));
      
      socket.data.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.user._id.toString();
    socket.join(userId);

    socket.on('disconnect', () => {
      socket.leave(userId);
    });
  });
};
