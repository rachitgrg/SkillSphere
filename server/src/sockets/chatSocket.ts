import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { JwtPayload } from '../types';

export const chatSocket = (io: Server) => {
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

    socket.on('join_conversation', (conversationId: string) => {
      socket.join(conversationId);
    });

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(conversationId);
    });

    socket.on('send_message', (data) => {
      const { conversationId, recipientId, message } = data;
      io.to(conversationId).emit('receive_message', message);
      // Optionally notify recipient specifically if they are not in the room
      io.to(recipientId).emit('new_message_notification', {
        conversationId,
        message: 'You have a new message'
      });
    });

    socket.on('typing', (data) => {
      socket.to(data.conversationId).emit('user_typing', { userId });
    });

    socket.on('stop_typing', (data) => {
      socket.to(data.conversationId).emit('user_stopped_typing', { userId });
    });

    socket.on('disconnect', () => {
      socket.leave(userId);
    });
  });
};
