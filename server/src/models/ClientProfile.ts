import mongoose, { Schema } from 'mongoose';
import { IClientProfile } from '../types';

const clientProfileSchema = new Schema<IClientProfile>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    companyName: {
      type: String,
      trim: true,
      maxlength: [100, 'Company name cannot exceed 100 characters'],
    },
    companyWebsite: {
      type: String,
      trim: true,
    },
    companySize: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '500+'],
    },
    industry: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    totalSpent: { type: Number, default: 0 },
    postedGigs: { type: Number, default: 0 },
    activeGigs: { type: Number, default: 0 },
    completedGigs: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    // 0–100, see reputationService.
    reputationScore: { type: Number, default: 0, min: 0, max: 100 },
    paymentVerified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
clientProfileSchema.index({ industry: 1 });
clientProfileSchema.index({ averageRating: -1 });
clientProfileSchema.index({ totalSpent: -1 });

const ClientProfile = mongoose.model<IClientProfile>(
  'ClientProfile',
  clientProfileSchema
);

export default ClientProfile;
