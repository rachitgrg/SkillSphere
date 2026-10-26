import { Response, NextFunction } from 'express';
import Review from '../models/Review';
import Gig from '../models/Gig';
import reputationService from '../services/reputationService';
import notificationService from '../services/notificationService';
import Payment from '../models/Payment';
import { Types } from 'mongoose';
import { AuthRequest, GigStatus, PaymentStatus } from '../types';

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
    // Validating computes the weighted rating, which the outlier check needs.
    const review = new Review({ gig: gig._id, reviewer: reviewerId, reviewee: revieweeId, categories, comment });
    await review.validate();
    const fraud = await reputationService.detectFraudulentReview(reviewerId, revieweeId, gig._id.toString(), { rating: review.rating, comment });
    review.isFlagged = fraud.isSuspicious;
    review.flagReason = fraud.isSuspicious ? fraud.reasons.join('; ') : undefined;
    review.isVisible = !fraud.isSuspicious;

    try {
      await review.save();
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

/** Bucketed contract value shown on "Verified hire" tags (exact amounts stay private). */
const AMOUNT_BUCKETS: [number, string][] = [
  [5_000, 'Under ₹5k'],
  [25_000, '₹5k–₹25k'],
  [1_00_000, '₹25k–₹1L'],
  [5_00_000, '₹1L–₹5L'],
  [Infinity, '₹5L+'],
];
export const amountRange = (amount: number) => AMOUNT_BUCKETS.find(([max]) => amount < max)![1];

/**
 * GET /reviews/user/:userId — visible reviews. Every review comes from a party to a completed gig,
 * so each carries a "Verified hire" tag with the contract value range (released payments).
 */
export const getReviews = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const reviews = await Review.find({ reviewee: userId, isVisible: true })
      .populate('reviewer', 'firstName lastName avatar')
      .populate('gig', 'title')
      .sort({ createdAt: -1 })
      .lean();

    const gigIds = reviews.map((r) => (r.gig as unknown as { _id: Types.ObjectId })?._id).filter(Boolean);
    const totals = await Payment.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: { gig: { $in: gigIds }, status: PaymentStatus.RELEASED } },
      { $group: { _id: '$gig', total: { $sum: '$amount' } } },
    ]);
    const byGig = new Map(totals.map((t) => [t._id.toString(), t.total]));
    const data = reviews.map((r) => {
      const total = byGig.get(String((r.gig as unknown as { _id: Types.ObjectId })?._id));
      return { ...r, verifiedHire: { amountRange: total ? amountRange(total) : undefined } };
    });

    res.status(200).json({ success: true, message: 'Reviews retrieved', data });
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
