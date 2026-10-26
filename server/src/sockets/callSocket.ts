import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import Conversation from '../models/Conversation';
import User from '../models/User';
import { userRoom } from '../services/chatService';

/**
 * 1:1 WebRTC call signalling (plan 4.6, optional video). The server only relays SDP and ICE
 * between the participants of a conversation; media flows peer-to-peer (Google public STUN).
 *
 *   call:offer  { conversationId, sdp, video }  → other participant receives { conversationId, from, sdp, video }
 *   call:answer { conversationId, sdp }         → caller receives { conversationId, sdp }
 *   call:ice    { conversationId, candidate }   → relayed as-is
 *   call:end    { conversationId, reason? }     → relayed (declined | ended | busy | unavailable)
 */
const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const sdp = z.object({ type: z.enum(['offer', 'answer']), sdp: z.string().max(100_000) });

const payloads = {
  'call:offer': z.object({ conversationId: objectId, sdp, video: z.boolean().default(true) }),
  'call:answer': z.object({ conversationId: objectId, sdp }),
  'call:ice': z.object({
    conversationId: objectId,
    candidate: z.object({
      candidate: z.string().max(2000),
      sdpMid: z.string().max(100).nullable().optional(),
      sdpMLineIndex: z.number().int().nullable().optional(),
      usernameFragment: z.string().max(200).nullable().optional(),
    }),
  }),
  'call:end': z.object({ conversationId: objectId, reason: z.enum(['declined', 'ended', 'busy', 'unavailable']).default('ended') }),
} as const;

type Ack = (response: { ok: boolean; error?: string }) => void;

export const registerCallHandlers = (io: Server, socket: Socket): void => {
  const userId: string = socket.data.userId;

  /** The other participants, or null when the caller is not in the conversation. */
  const others = async (conversationId: string): Promise<string[] | null> => {
    const conversation = await Conversation.findOne({ _id: conversationId, participants: userId }).select('participants').lean();
    return conversation ? conversation.participants.map(String).filter((id) => id !== userId) : null;
  };

  for (const event of Object.keys(payloads) as (keyof typeof payloads)[]) {
    socket.on(event, async (raw: unknown, ack?: Ack) => {
      const reply = (r: { ok: boolean; error?: string }) => typeof ack === 'function' && ack(r);
      const parsed = payloads[event].safeParse(raw);
      if (!parsed.success) return reply({ ok: false, error: 'Invalid call payload' });

      const recipients = await others(parsed.data.conversationId);
      if (!recipients) return reply({ ok: false, error: 'Not a participant of this conversation' });

      let data: Record<string, unknown> = parsed.data;
      if (event === 'call:offer') {
        // Nobody to ring: tell the caller right away instead of letting it time out.
        const reachable = await Promise.all(recipients.map(async (id) => (await io.in(userRoom(id)).fetchSockets()).length > 0));
        if (!reachable.some(Boolean)) return reply({ ok: false, error: 'unavailable' });
        const caller = await User.findById(userId).select('firstName lastName avatar').lean();
        data = { ...data, from: { _id: userId, firstName: caller?.firstName, lastName: caller?.lastName, avatar: caller?.avatar } };
      }
      for (const id of recipients) io.to(userRoom(id)).emit(event, data);
      reply({ ok: true });
    });
  }
};
