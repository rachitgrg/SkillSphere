import mongoose, { Schema } from 'mongoose';
import { IProposal, ProposalStatus, MilestoneStatus } from '../types';

const negotiationEntrySchema = new Schema(
  {
    proposedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const proposalMilestoneSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(MilestoneStatus),
      default: MilestoneStatus.PENDING,
    },
    completedAt: Date,
  },
  { _id: true }
);

const proposalSchema = new Schema<IProposal>(
  {
    gig: {
      type: Schema.Types.ObjectId,
      ref: 'Gig',
      required: true,
    },
    freelancer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    coverLetter: {
      type: String,
      required: [true, 'Cover letter is required'],
      maxlength: [3000, 'Cover letter cannot exceed 3000 characters'],
    },
    proposedAmount: {
      type: Number,
      required: [true, 'Proposed amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    estimatedDuration: {
      type: String,
      required: [true, 'Estimated duration is required'],
    },
    milestones: [proposalMilestoneSchema],
    attachments: [String],
    status: {
      type: String,
      enum: Object.values(ProposalStatus),
      default: ProposalStatus.PENDING,
    },
    negotiationHistory: [negotiationEntrySchema],
    clientNotes: String,
    isBookmarked: { type: Boolean, default: false },
    submittedAt: { type: Date, default: Date.now },
    respondedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
proposalSchema.index({ gig: 1, freelancer: 1 }, { unique: true });
proposalSchema.index({ freelancer: 1 });
proposalSchema.index({ status: 1 });
proposalSchema.index({ createdAt: -1 });
proposalSchema.index({ proposedAmount: 1 });

const Proposal = mongoose.model<IProposal>('Proposal', proposalSchema);

export default Proposal;
