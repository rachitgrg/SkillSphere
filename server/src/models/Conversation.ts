import mongoose, { Schema } from 'mongoose';
import { IConversation } from '../types';

const conversationSchema = new Schema<IConversation>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    gig: {
      type: Schema.Types.ObjectId,
      ref: 'Gig',
    },
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    lastMessageAt: Date,
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ gig: 1 });
conversationSchema.index({ isActive: 1 });

const Conversation = mongoose.model<IConversation>(
  'Conversation',
  conversationSchema
);

export default Conversation;
