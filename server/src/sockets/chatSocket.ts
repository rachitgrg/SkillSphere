import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import chatService, { conversationRoom } from '../services/chatService';
import { MessageType } from '../types';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const conversationPayload = z.object({ conversationId: objectId });

const sendMessagePayload = z.object({
  conversationId: objectId,
  content: z.string().trim().min(1).max(5000),
  type: z.enum([MessageType.TEXT, MessageType.IMAGE, MessageType.FILE]).optional(),
  fileUrl: z.string().url().optional(),
  fileName: z.string().max(255).optional(),
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

  socket.on('join_conversation', async (raw: unknown, ack?: Ack) => {
    const parsed = normalizeConversation(raw);
    if (!parsed.success) return fail(ack, 'Invalid conversation id');

    const { conversationId } = parsed.data;
    if (!(await chatService.isParticipant(conversationId, userId))) {
      return fail(ack, 'Not a participant of this conversation');
    }
    socket.join(conversationRoom(conversationId));
    if (typeof ack === 'function') ack({ ok: true });
  });

  socket.on('leave_conversation', (raw: unknown) => {
    const parsed = normalizeConversation(raw);
    if (parsed.success) socket.leave(conversationRoom(parsed.data.conversationId));
  });

  socket.on('send_message', async (raw: unknown, ack?: Ack) => {
    const parsed = sendMessagePayload.safeParse(raw);
    if (!parsed.success) return fail(ack, parsed.error.issues[0]?.message ?? 'Invalid message');

    try {
      const message = await chatService.sendMessage(userId, parsed.data);
      if (typeof ack === 'function') ack({ ok: true, message: message.toJSON() });
    } catch (error) {
      fail(ack, error instanceof Error ? error.message : 'Failed to send message');
    }
  });

  // Typing indicators only reach rooms the socket has legitimately joined.
  const relayTyping = (event: 'typing' | 'stop_typing') => (raw: unknown) => {
    const parsed = normalizeConversation(raw);
    if (!parsed.success) return;
    const room = conversationRoom(parsed.data.conversationId);
    if (!socket.rooms.has(room)) return;
    socket.to(room).emit(event, { conversationId: parsed.data.conversationId, userId });
  };

  socket.on('typing', relayTyping('typing'));
  socket.on('stop_typing', relayTyping('stop_typing'));
};
