import mongoose, { Schema } from 'mongoose';
import { IReview } from '../types';

const reviewSchema = new Schema<IReview>(
  {
    gig: {
      type: Schema.Types.ObjectId,
      ref: 'Gig',
      required: true,
    },
    reviewer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewee: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    categories: {
      communication: { type: Number, min: 1, max: 5, required: true },
      quality: { type: Number, min: 1, max: 5, required: true },
      timeliness: { type: Number, min: 1, max: 5, required: true },
      professionalism: { type: Number, min: 1, max: 5, required: true },
      value: { type: Number, min: 1, max: 5, required: true },
    },
    comment: {
      type: String,
      required: [true, 'Review comment is required'],
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },
    response: {
      type: String,
      maxlength: [1000, 'Response cannot exceed 1000 characters'],
    },
    responseAt: Date,
    isFlagged: { type: Boolean, default: false },
    flagReason: String,
    isVisible: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
reviewSchema.index({ gig: 1 });
reviewSchema.index({ reviewer: 1 });
reviewSchema.index({ reviewee: 1 });
reviewSchema.index({ rating: -1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ gig: 1, reviewer: 1 }, { unique: true });

// Pre-save: calculate weighted average rating
reviewSchema.pre('save', function () {
  if (this.isModified('categories')) {
    const { communication, quality, timeliness, professionalism, value } = this.categories;
    // Weighted: quality 30%, communication 20%, timeliness 20%, professionalism 15%, value 15%
    this.rating = Math.round(
      (quality * 0.3 +
        communication * 0.2 +
        timeliness * 0.2 +
        professionalism * 0.15 +
        value * 0.15) *
        100
    ) / 100;
  }
});

const Review = mongoose.model<IReview>('Review', reviewSchema);

export default Review;
