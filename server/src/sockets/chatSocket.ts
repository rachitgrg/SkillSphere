import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import chatService, { conversationRoom } from '../services/chatService';
import { MessageType } from '../types';
import Message from '../models/Message';
import { safeHandler } from './safeHandler';
import { env } from '../config/env';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const conversationPayload = z.object({ conversationId: objectId });

/**
 * Files must come from POST /chat/conversations/:id/files, i.e. *our* Cloudinary account (not any
 * res.cloudinary.com URL). Without Cloudinary there are no uploads, so no file URL is accepted.
 */
export const isUploadedFileUrl = (url: string): boolean => {
  const cloud = env.CLOUDINARY_CLOUD_NAME;
  return Boolean(cloud) && url.startsWith(`https://res.cloudinary.com/${encodeURIComponent(cloud!)}/`);
};

const sendMessagePayload = z
  .object({
    conversationId: objectId,
    content: z.string().trim().min(1).max(5000),
    type: z.enum([MessageType.TEXT, MessageType.IMAGE, MessageType.FILE]).optional(),
    fileUrl: z.string().url().refine(isUploadedFileUrl, 'Upload the file first').optional(),
    fileName: z.string().max(255).optional(),
  })
  .refine((m) => (m.type === MessageType.IMAGE || m.type === MessageType.FILE) === Boolean(m.fileUrl), {
    message: 'File messages need a fileUrl (and only they may have one)',
  });

type Ack = (response: { ok: boolean; error?: string; [key: string]: unknown }) => void;

/** Accepts either `{ conversationId }` or a bare id string (older clients). */
const normalizeConversation = (raw: unknown) =>
  conversationPayload.safeParse(typeof raw === 'string' ? { conversationId: raw } : raw);

/**
 * Chat events. Every event re-checks membership: a socket can only join, type in or
 * send to conversations whose participants include the authenticated user.
 */
export const registerChatHandlers = (_io: Server, socket: Socket): void => {
  const userId: string = socket.data.userId;

  const fail = (ack: Ack | undefined, error: string) => {
    if (typeof ack === 'function') ack({ ok: false, error });
    else socket.emit('chat:error', { error });
  };

  socket.on('join_conversation', safeHandler('join_conversation', async (raw: unknown, ack?: Ack) => {
    const parsed = normalizeConversation(raw);
    if (!parsed.success) return fail(ack, 'Invalid conversation id');

    const { conversationId } = parsed.data;
    if (!(await chatService.isParticipant(conversationId, userId))) {
      return fail(ack, 'Not a participant of this conversation');
    }
    socket.join(conversationRoom(conversationId));
    if (typeof ack === 'function') ack({ ok: true });
  }));

  socket.on('leave_conversation', safeHandler('leave_conversation', (raw: unknown) => {
    const parsed = normalizeConversation(raw);
    if (parsed.success) socket.leave(conversationRoom(parsed.data.conversationId));
  }));

  socket.on('send_message', safeHandler('send_message', async (raw: unknown, ack?: Ack) => {
    const parsed = sendMessagePayload.safeParse(raw);
    if (!parsed.success) return fail(ack, parsed.error.issues[0]?.message ?? 'Invalid message');

    try {
      const message = await chatService.sendMessage(userId, parsed.data);
      if (typeof ack === 'function') ack({ ok: true, message: message.toJSON() });
    } catch (error) {
      fail(ack, error instanceof Error ? error.message : 'Failed to send message');
    }
  }));

  // Read receipts: marks the other participants' messages as read and tells the room.
  socket.on('messages_read', safeHandler('messages_read', async (raw: unknown, ack?: Ack) => {
    const parsed = normalizeConversation(raw);
    if (!parsed.success) return fail(ack, 'Invalid conversation id');
    const { conversationId } = parsed.data;
    if (!(await chatService.isParticipant(conversationId, userId))) return fail(ack, 'Not a participant of this conversation');

    const readAt = new Date();
    const { modifiedCount } = await Message.updateMany(
      { conversation: conversationId, sender: { $ne: userId }, 'readBy.user': { $ne: userId } },
      { $push: { readBy: { user: userId, readAt } } }
    );
    if (modifiedCount) socket.to(conversationRoom(conversationId)).emit('messages_read', { conversationId, userId, readAt });
    if (typeof ack === 'function') ack({ ok: true, updated: modifiedCount });
  }));

  // Typing indicators only reach rooms the socket has legitimately joined.
  const relayTyping = (event: 'typing' | 'stop_typing') => (raw: unknown) => {
    const parsed = normalizeConversation(raw);
    if (!parsed.success) return;
    const room = conversationRoom(parsed.data.conversationId);
    if (!socket.rooms.has(room)) return;
    socket.to(room).emit(event, { conversationId: parsed.data.conversationId, userId });
  };

  socket.on('typing', safeHandler('typing', relayTyping('typing')));
  socket.on('stop_typing', safeHandler('stop_typing', relayTyping('stop_typing')));
};
