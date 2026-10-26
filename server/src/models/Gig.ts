import mongoose, { Schema } from 'mongoose';
import { IGig, GigStatus, MilestoneStatus } from '../types';

const milestoneSchema = new Schema(
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

const gigSchema = new Schema<IGig>(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Gig title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Gig description is required'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    subCategory: {
      type: String,
      trim: true,
    },
    skills: {
      type: [String],
      required: [true, 'At least one skill is required'],
      validate: {
        validator: (v: string[]) => v.length > 0 && v.length <= 20,
        message: 'Must have between 1 and 20 skills',
      },
    },
    budgetType: {
      type: String,
      enum: ['fixed', 'hourly'],
      required: true,
    },
    budgetMin: {
      type: Number,
      required: true,
      min: [0, 'Budget cannot be negative'],
    },
    budgetMax: {
      type: Number,
      required: true,
      min: [0, 'Budget cannot be negative'],
    },
    duration: {
      type: String,
      required: true,
    },
    experienceLevel: {
      type: String,
      enum: ['entry', 'intermediate', 'expert'],
      required: true,
    },
    milestones: [milestoneSchema],
    // Uploaded via POST /gigs/:id/attachments (Cloudinary).
    attachments: [
      {
        url: { type: String, required: true },
        publicId: String,
        name: { type: String, required: true },
        size: Number,
        mimeType: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    invitations: [
      {
        _id: false,
        freelancer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        invitedAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
        respondedAt: Date,
      },
    ],
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        // No empty [] default: an empty point breaks the 2dsphere index.
        default: undefined,
      },
    },
    locationType: {
      type: String,
      enum: ['remote', 'onsite', 'hybrid'],
      default: 'remote',
    },
    status: {
      type: String,
      enum: Object.values(GigStatus),
      default: GigStatus.DRAFT,
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'invite_only'],
      default: 'public',
    },
    proposals: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Proposal',
      },
    ],
    selectedFreelancer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    totalProposals: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    tags: [String],
    deadline: Date,
    completedAt: Date,
    // Set by an admin when the gig is rejected from the approval queue.
    rejectionReason: String,
    approvedAt: Date,
    // Sentence embedding of title + skills + description (embeddingService); never sent to clients.
    embedding: { type: [Number], select: false, default: undefined },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
gigSchema.index({ client: 1 });
gigSchema.index({ status: 1 });
gigSchema.index({ category: 1 });
gigSchema.index({ skills: 1 });
gigSchema.index({ budgetMin: 1, budgetMax: 1 });
gigSchema.index({ experienceLevel: 1 });
gigSchema.index({ locationType: 1 });
gigSchema.index({ location: '2dsphere' });
gigSchema.index({ createdAt: -1 });
gigSchema.index({ 'invitations.freelancer': 1 });
gigSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Pre-validate: budgetMax >= budgetMin
// While the gig is being written (before anyone is hired) milestones must fit the budget;
// after hiring, the accepted (possibly negotiated) amount governs instead.
const BUDGETED_STATUSES = [GigStatus.DRAFT, GigStatus.PENDING_APPROVAL, GigStatus.OPEN];

gigSchema.pre('validate', function () {
  if (this.budgetMax < this.budgetMin) {
    this.invalidate('budgetMax', 'Maximum budget must be >= minimum budget');
  }
  if (this.budgetType === 'fixed' && BUDGETED_STATUSES.includes(this.status) && (this.isModified('milestones') || this.isModified('budgetMax'))) {
    const total = this.milestones.reduce((sum, m) => sum + (m.amount || 0), 0);
    if (total > this.budgetMax) {
      this.invalidate('milestones', `Milestones add up to ₹${total}, more than the ₹${this.budgetMax} budget`);
    }
  }
});

const Gig = mongoose.model<IGig>('Gig', gigSchema);

export default Gig;
