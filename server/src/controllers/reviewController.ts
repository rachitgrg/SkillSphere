import { Response, NextFunction } from 'express';
import Review from '../models/Review';
import Gig from '../models/Gig';
import FreelancerProfile from '../models/FreelancerProfile';
import ClientProfile from '../models/ClientProfile';
import { AuthRequest } from '../types';

export const createReview = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { gigId, revieweeId, categories, comment } = req.body;
    
    const gig = await Gig.findById(gigId);
    if (!gig) {
      res.status(404).json({ success: false, message: 'Gig not found' });
      return;
    }

    if (gig.status !== 'completed') {
      res.status(400).json({ success: false, message: 'Gig must be completed before leaving a review' });
      return;
    }

    const existingReview = await Review.findOne({ gig: gigId, reviewer: req.user?._id });
    if (existingReview) {
      res.status(400).json({ success: false, message: 'You have already reviewed this gig' });
      return;
    }

    // Calculate average rating
    const rating = (categories.communication + categories.quality + categories.timeliness + categories.professionalism + categories.value) / 5;

    const review = new Review({
      gig: gigId,
      reviewer: req.user?._id,
      reviewee: revieweeId,
      rating,
      categories,
      comment,
      isFlagged: false,
      isVisible: true
    });

    await review.save();

    // Update profiles with new ratings (simplified logic)
    const fProfile = await FreelancerProfile.findOne({ user: revieweeId });
    if (fProfile) {
      const newTotal = fProfile.totalReviews + 1;
      fProfile.averageRating = ((fProfile.averageRating * fProfile.totalReviews) + rating) / newTotal;
      fProfile.totalReviews = newTotal;
      await fProfile.save();
    } else {
      const cProfile = await ClientProfile.findOne({ user: revieweeId });
      if (cProfile) {
        const newTotal = cProfile.totalReviews + 1;
        cProfile.averageRating = ((cProfile.averageRating * cProfile.totalReviews) + rating) / newTotal;
        cProfile.totalReviews = newTotal;
        await cProfile.save();
      }
    }

    res.status(201).json({ success: true, message: 'Review submitted', data: review });
  } catch (error) {
    next(error);
  }
};

export const getReviews = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const reviews = await Review.find({ reviewee: userId, isVisible: true })
      .populate('reviewer', 'firstName lastName avatar')
      .populate('gig', 'title')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, message: 'Reviews retrieved', data: reviews });
  } catch (error) {
    next(error);
  }
};

export const replyToReview = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      res.status(404).json({ success: false, message: 'Review not found' });
      return;
    }

    if (review.reviewee.toString() !== req.user?._id.toString()) {
      res.status(403).json({ success: false, message: 'Not authorized to reply to this review' });
      return;
    }

    if (review.response) {
      res.status(400).json({ success: false, message: 'Review already has a response' });
      return;
    }

    review.response = req.body.response;
    review.responseAt = new Date();
    await review.save();

    res.status(200).json({ success: true, message: 'Response added', data: review });
  } catch (error) {
    next(error);
  }
};
