import mongoose, { Schema } from 'mongoose';
import { INotification, NotificationType } from '../types';

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      maxlength: 200,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      maxlength: 500,
    },
    data: {
      type: Schema.Types.Mixed,
    },
    isRead: { type: Boolean, default: false },
    readAt: Date,
    link: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ createdAt: -1 });

// TTL index: auto-delete notifications after 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

const Notification = mongoose.model<INotification>(
  'Notification',
  notificationSchema
);

export default Notification;
