import mongoose, { Schema } from 'mongoose';
import { IAdminLog, AdminAction } from '../types';

const adminLogSchema = new Schema<IAdminLog>(
  {
    admin: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: Object.values(AdminAction),
      required: true,
    },
    targetType: {
      type: String,
      enum: ['user', 'gig', 'payment', 'review', 'dispute'],
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    details: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    ipAddress: String,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
adminLogSchema.index({ admin: 1 });
adminLogSchema.index({ action: 1 });
adminLogSchema.index({ targetType: 1, targetId: 1 });
adminLogSchema.index({ createdAt: -1 });

const AdminLog = mongoose.model<IAdminLog>('AdminLog', adminLogSchema);

export default AdminLog;
