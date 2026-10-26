import mongoose, { Schema } from 'mongoose';
import { IDispute, DisputeStatus } from '../types';

const evidenceSchema = new Schema(
  {
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fileUrl: { type: String, required: true },
    description: { type: String, required: true, maxlength: 500 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const disputeSchema = new Schema<IDispute>(
  {
    gig: {
      type: Schema.Types.ObjectId,
      ref: 'Gig',
      required: true,
    },
    payment: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
    },
    raisedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    against: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Dispute title is required'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Dispute description is required'],
      maxlength: [3000, 'Description cannot exceed 3000 characters'],
    },
    evidence: [evidenceSchema],
    status: {
      type: String,
      enum: Object.values(DisputeStatus),
      default: DisputeStatus.OPEN,
    },
    resolution: String,
    // How the escrowed money was settled; feeds the reputation completion rate (lost disputes).
    paymentAction: { type: String, enum: ['refund', 'release', 'split'] },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: Date,
    adminNotes: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
disputeSchema.index({ gig: 1 });
disputeSchema.index({ raisedBy: 1 });
disputeSchema.index({ against: 1 });
disputeSchema.index({ status: 1 });
disputeSchema.index({ createdAt: -1 });

const Dispute = mongoose.model<IDispute>('Dispute', disputeSchema);

export default Dispute;
