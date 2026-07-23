import { Response } from 'express';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import { AuthRequest } from '../types';

export const getConversations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversations = await Conversation.find({ participants: req.user?._id })
      .populate('participants', 'firstName lastName avatar')
      .populate('gig', 'title status')
      .sort({ lastMessageAt: -1 });

    res.status(200).json({ success: true, message: 'Conversations retrieved', data: conversations });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { recipientId, gigId } = req.body;
    const participants = [req.user?._id, recipientId];

    let conversation = await Conversation.findOne({ participants: { $all: participants }, gig: gigId });

    if (!conversation) {
      conversation = new Conversation({
        participants,
        gig: gigId,
        isActive: true,
        lastMessageAt: new Date()
      });
      await conversation.save();
    }

    res.status(201).json({ success: true, message: 'Conversation retrieved/created', data: conversation });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId, content, type, fileUrl, fileName } = req.body;

    const conversation = await Conversation.findOne({ _id: conversationId, participants: req.user?._id });
    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found or not a participant' });
      return;
    }

    const message = new Message({
      conversation: conversationId,
      sender: req.user?._id,
      content,
      type: type || 'text',
      fileUrl,
      fileName,
      readBy: [{ user: req.user?._id, readAt: new Date() }],
      isEdited: false,
      isDeleted: false
    });

    await message.save();

    conversation.lastMessage = message._id as any;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    res.status(201).json({ success: true, message: 'Message sent', data: message });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
