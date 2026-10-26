import { Types } from 'mongoose';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import { IMessage, MessageType } from '../types';
import { HttpError } from '../utils/httpError';
import { getIOOrNull, isUserOnline } from '../config/socket';
import notificationService from './notificationService';

export const conversationRoom = (conversationId: string) => `conv:${conversationId}`;
export const userRoom = (userId: string) => `user:${userId}`;

export interface SendMessageInput {
  conversationId: string;
  content: string;
  type?: MessageType;
  fileUrl?: string;
  fileName?: string;
}

class ChatService {
  isParticipant(conversationId: string, userId: string | Types.ObjectId): Promise<boolean> {
    if (!Types.ObjectId.isValid(conversationId)) return Promise.resolve(false);
    return Conversation.exists({ _id: conversationId, participants: userId }).then(Boolean);
  }

  /**
   * Persists a message from `senderId`, updates the conversation and broadcasts the saved
   * document to the conversation room and to the other participants' personal rooms.
   * The sender always comes from the authenticated user, never from the payload.
   */
  async sendMessage(senderId: string, input: SendMessageInput): Promise<IMessage> {
    const conversation = await Conversation.findOne({ _id: input.conversationId, participants: senderId });
    if (!conversation) throw new HttpError(404, 'Conversation not found or not a participant');

    const message = await Message.create({
      conversation: conversation._id,
      sender: senderId,
      content: input.content,
      type: input.type ?? MessageType.TEXT,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      readBy: [{ user: senderId, readAt: new Date() }],
    });

    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.createdAt;
    await conversation.save();

    await message.populate('sender', 'firstName lastName avatar');

    const io = getIOOrNull();
    if (io) {
      const payload = message.toJSON();
      io.to(conversationRoom(conversation._id.toString())).emit('message:new', payload);
      for (const participant of conversation.participants) {
        if (participant.toString() === senderId) continue;
        io.to(userRoom(participant.toString())).emit('conversation:updated', {
          conversationId: conversation._id.toString(),
          message: payload,
        });
      }
    }

    // People who are offline hear about it in-app (and by email if they opted in); online ones see it live.
    const sender = message.sender as unknown as { firstName: string; lastName: string };
    await Promise.all(
      conversation.participants
        .map(String)
        .filter((id) => id !== senderId && !isUserOnline(id))
        .map((id) => notificationService.notifyMessageReceived(id, senderId, `${sender.firstName} ${sender.lastName}`, conversation._id.toString()))
    );

    return message;
  }
}

export default new ChatService();
