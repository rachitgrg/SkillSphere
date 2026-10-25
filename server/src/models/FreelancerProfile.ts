import mongoose, { Schema } from 'mongoose';
import { IFreelancerProfile, ProficiencyLevel, AvailabilityStatus } from '../types';

const skillSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    proficiency: {
      type: String,
      enum: Object.values(ProficiencyLevel),
      required: true,
    },
    yearsOfExperience: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const portfolioItemSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    url: String,
    images: [String],
    technologies: [String],
    completedAt: Date,
  },
  { _id: true }
);

const certificationSchema = new Schema(
  {
    name: { type: String, required: true },
    issuer: { type: String, required: true },
    issueDate: { type: Date, required: true },
    expiryDate: Date,
    credentialUrl: String,
  },
  { _id: true }
);

const workExperienceSchema = new Schema(
  {
    title: { type: String, required: true },
    company: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: Date,
    current: { type: Boolean, default: false },
    description: { type: String, required: true },
  },
  { _id: true }
);

const availabilitySlotSchema = new Schema(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
  },
  { _id: false }
);

const freelancerProfileSchema = new Schema<IFreelancerProfile>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: [true, 'Professional title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    headline: {
      type: String,
      trim: true,
      maxlength: [200, 'Headline cannot exceed 200 characters'],
      default: '',
    },
    skills: {
      type: [skillSchema],
      validate: {
        validator: (v: unknown[]) => v.length <= 50,
        message: 'Cannot have more than 50 skills',
      },
    },
    portfolio: [portfolioItemSchema],
    certifications: [certificationSchema],
    workExperience: [workExperienceSchema],
    education: [
      {
        degree: { type: String, required: true },
        institution: { type: String, required: true },
        year: { type: Number, required: true },
      },
    ],
    hourlyRate: {
      type: Number,
      default: 0,
      min: [0, 'Hourly rate cannot be negative'],
    },
    availability: {
      type: String,
      enum: Object.values(AvailabilityStatus),
      default: AvailabilityStatus.AVAILABLE,
    },
    availabilitySlots: [availabilitySlotSchema],
    totalEarnings: { type: Number, default: 0 },
    completedGigs: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    responseTime: { type: Number, default: 0 },
    languages: [
      {
        language: { type: String, required: true },
        proficiency: { type: String, required: true },
      },
    ],
    socialLinks: {
      github: String,
      linkedin: String,
      website: String,
      twitter: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
freelancerProfileSchema.index({ 'skills.name': 1 });
freelancerProfileSchema.index({ hourlyRate: 1 });
freelancerProfileSchema.index({ availability: 1 });
freelancerProfileSchema.index({ averageRating: -1 });
freelancerProfileSchema.index({ completedGigs: -1 });
freelancerProfileSchema.index({ totalEarnings: -1 });

const FreelancerProfile = mongoose.model<IFreelancerProfile>(
  'FreelancerProfile',
  freelancerProfileSchema
);

export default FreelancerProfile;
