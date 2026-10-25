import { Response, NextFunction } from 'express';
import Review from '../models/Review';
import Gig from '../models/Gig';
import reputationService from '../services/reputationService';
import notificationService from '../services/notificationService';
import { AuthRequest, GigStatus } from '../types';

/**
 * Only the two parties of a completed gig can review each other; the reviewee is derived
 * (never taken from the body). Suspicious reviews are stored hidden and flagged for admins.
 */
export const createReview = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { gigId, categories, comment } = req.body;
    const reviewerId = req.user!._id.toString();

    const gig = await Gig.findById(gigId);
    if (!gig) {
      res.status(404).json({ success: false, message: 'Gig not found' });
      return;
    }

    const clientId = gig.client.toString();
    const freelancerId = gig.selectedFreelancer?.toString();
    if (reviewerId !== clientId && reviewerId !== freelancerId) {
      res.status(403).json({ success: false, message: 'Only the client and the hired freelancer can review this gig' });
      return;
    }
    if (gig.status !== GigStatus.COMPLETED || !freelancerId) {
      res.status(409).json({ success: false, message: 'Gig must be completed before leaving a review' });
      return;
    }

    const revieweeId = reviewerId === clientId ? freelancerId : clientId;
    const fraud = await reputationService.detectFraudulentReview(reviewerId, revieweeId, gig._id.toString());

    let review;
    try {
      review = await Review.create({
        gig: gig._id,
        reviewer: reviewerId,
        reviewee: revieweeId,
        categories,
        comment,
        isFlagged: fraud.isSuspicious,
        flagReason: fraud.isSuspicious ? fraud.reasons.join('; ') : undefined,
        isVisible: !fraud.isSuspicious,
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        res.status(409).json({ success: false, message: 'You have already reviewed this gig' });
        return;
      }
      throw error;
    }

    if (fraud.isSuspicious) {
      console.warn(`[fraud] review ${review._id} hidden for admin review: ${review.flagReason}`);
    } else {
      await reputationService.updateUserReputation(revieweeId);
      await notificationService.notifyReviewReceived(revieweeId, reviewerId, review.rating, gig.title, gig._id.toString());
    }

    res.status(201).json({
      success: true,
      message: fraud.isSuspicious ? 'Review submitted and held for moderation' : 'Review submitted',
      data: review,
    });
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

/** GET /reviews/user/:userId/breakdown — rating distribution and category averages (visible reviews). */
export const getReviewBreakdown = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const breakdown = await reputationService.getReputationBreakdown(req.params.userId);
    res.status(200).json({ success: true, message: 'Review breakdown', data: breakdown });
  } catch (error) {
    next(error);
  }
};

/** POST /reviews/:id/report — any signed-in user can report a review once; it is flagged for admins. */
export const reportReview = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const me = req.user!._id;
    const review = await Review.findOneAndUpdate(
      { _id: req.params.id, 'reports.user': { $ne: me } },
      {
        $push: { reports: { user: me, reason: req.body.reason } },
        $set: { isFlagged: true },
      },
      { returnDocument: 'after' }
    );
    if (!review) {
      const exists = await Review.exists({ _id: req.params.id });
      res.status(exists ? 409 : 404).json({
        success: false,
        message: exists ? 'You have already reported this review' : 'Review not found',
      });
      return;
    }
    res.status(200).json({ success: true, message: 'Review reported. Our team will take a look.' });
  } catch (error) {
    next(error);
  }
};
