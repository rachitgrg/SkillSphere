import { Response, NextFunction } from 'express';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import User from '../models/User';
import chatService from '../services/chatService';
import { AuthRequest } from '../types';
import { Types } from 'mongoose';

export const getConversations = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const me = req.user!._id;
    const conversations = await Conversation.find({ participants: me })
      .populate('participants', 'firstName lastName avatar')
      .populate('gig', 'title status')
      .populate('lastMessage', 'content type sender createdAt')
      .sort({ lastMessageAt: -1 });

    // Unread = messages from others that I haven't read, per conversation.
    const unread = await Message.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          conversation: { $in: conversations.map((c) => c._id) },
          sender: { $ne: me },
          'readBy.user': { $ne: me },
          isDeleted: false,
        },
      },
      { $group: { _id: '$conversation', count: { $sum: 1 } } },
    ]);
    const unreadById = new Map(unread.map((u) => [u._id.toString(), u.count]));

    const data = conversations.map((c) => ({ ...c.toJSON(), unreadCount: unreadById.get(c._id.toString()) ?? 0 }));
    res.status(200).json({ success: true, message: 'Conversations retrieved', data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /chat/conversations/:id/messages?before=<ISO date|messageId>&limit= — newest first page,
 * older pages via the before cursor. Returned oldest → newest for rendering.
 */
export const getMessages = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    if (!(await chatService.isParticipant(id, req.user!._id))) {
      res.status(404).json({ success: false, message: 'Conversation not found or not a participant' });
      return;
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const filter: Record<string, unknown> = { conversation: id, isDeleted: false };
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    if (before) {
      const cursor = Types.ObjectId.isValid(before)
        ? (await Message.findById(before).select('createdAt'))?.createdAt
        : new Date(before);
      if (cursor && !Number.isNaN(cursor.getTime())) filter.createdAt = { $lt: cursor };
    }

    const page = await Message.find(filter)
      .populate('sender', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .limit(limit + 1);
    const hasMore = page.length > limit;
    const messages = page.slice(0, limit).reverse();

    res.status(200).json({ success: true, message: 'Messages retrieved', data: { messages, hasMore } });
  } catch (error) {
    next(error);
  }
};

export const createConversation = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { participantId, gigId } = req.body;
    const me = req.user!._id;

    if (String(participantId) === me.toString()) {
      res.status(400).json({ success: false, message: 'You cannot start a conversation with yourself' });
      return;
    }
    if (!(await User.exists({ _id: participantId, isActive: true, isBanned: false }))) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const participants = [me, participantId];
    const filter = { participants: { $all: participants, $size: 2 }, gig: gigId ?? null };
    let conversation = await Conversation.findOne(filter);
    const created = !conversation;

    if (!conversation) {
      conversation = await Conversation.create({
        participants,
        gig: gigId,
        isActive: true,
        lastMessageAt: new Date()
      });
    }
    await conversation.populate('participants', 'firstName lastName avatar');

    res.status(created ? 201 : 200).json({ success: true, message: 'Conversation ready', data: conversation });
  } catch (error) {
    next(error);
  }
};
