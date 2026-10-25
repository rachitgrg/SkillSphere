import { Response, NextFunction } from 'express';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import User from '../models/User';
import chatService from '../services/chatService';
import { AuthRequest } from '../types';

export const getConversations = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const conversations = await Conversation.find({ participants: req.user?._id })
      .populate('participants', 'firstName lastName avatar')
      .populate('gig', 'title status')
      .sort({ lastMessageAt: -1 });

    res.status(200).json({ success: true, message: 'Conversations retrieved', data: conversations });
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { conversationId } = req.params;
    
    const conversation = await Conversation.findOne({ _id: conversationId, participants: req.user?._id });
    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found or not a participant' });
      return;
    }

    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'firstName lastName avatar')
      .sort({ createdAt: 1 });

    res.status(200).json({ success: true, message: 'Messages retrieved', data: messages });
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

export const sendMessage = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const conversationId = req.params.conversationId ?? req.body.conversationId;
    const message = await chatService.sendMessage(req.user!._id.toString(), { ...req.body, conversationId });
    res.status(201).json({ success: true, message: 'Message sent', data: message });
  } catch (error) {
    next(error);
  }
};
