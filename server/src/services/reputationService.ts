import { Types } from 'mongoose';
import Review from '../models/Review';
import FreelancerProfile from '../models/FreelancerProfile';
import ClientProfile from '../models/ClientProfile';
import Gig from '../models/Gig';
import Dispute from '../models/Dispute';
import User from '../models/User';
import { DisputeStatus, GigStatus, IReview, UserRole } from '../types';
import { isPublicIp } from '../utils/ip';

/**
 * Reputation score (0–100), stored as `reputationScore` on freelancer and client profiles:
 *
 *   rating      = Bayesian mean of review ratings / 5
 *                 (each review's rating is already weighted by category: quality 30 %, communication 20 %,
 *                  timeliness 20 %, professionalism 15 %, value 15 %; reviews older than 12 months count 50 %;
 *                  prior of BAYES_PRIOR_REVIEWS reviews at the platform mean)
 *   completion  = (completed + 2·0.8) / (completed + cancelled + lost disputes + 2)   — 2 pseudo-jobs at 80 %
 *   score       = 100 · (0.75 · rating + 0.25 · completion)  + 5 if verified (freelancers), capped at 100
 *
 * Recalculated after every review, dispute resolution, gig completion/cancellation and verification change.
 */
export const REPUTATION = {
  BAYES_PRIOR_REVIEWS: 5,
  DEFAULT_PLATFORM_RATING: 4,
  OLD_REVIEW_MONTHS: 12,
  OLD_REVIEW_WEIGHT: 0.5,
  RATING_WEIGHT: 0.75,
  COMPLETION_WEIGHT: 0.25,
  COMPLETION_PRIOR_JOBS: 2,
  COMPLETION_PRIOR_RATE: 0.8,
  VERIFIED_BONUS: 5,
} as const;

const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

/** Pure scoring, exported for tests. */
export const computeReputation = (input: {
  reviews: Pick<IReview, 'rating' | 'createdAt'>[];
  platformMean: number;
  completed: number;
  failed: number; // cancelled + lost disputes
  verified?: boolean;
  now?: Date;
}) => {
  const now = input.now ?? new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - REPUTATION.OLD_REVIEW_MONTHS);

  let weight = 0;
  let weighted = 0;
  for (const r of input.reviews) {
    const w = r.createdAt < cutoff ? REPUTATION.OLD_REVIEW_WEIGHT : 1;
    weight += w;
    weighted += w * r.rating;
  }
  const m = REPUTATION.BAYES_PRIOR_REVIEWS;
  const bayesian = (weighted + m * input.platformMean) / (weight + m);
  const completion =
    (input.completed + REPUTATION.COMPLETION_PRIOR_JOBS * REPUTATION.COMPLETION_PRIOR_RATE) /
    (input.completed + input.failed + REPUTATION.COMPLETION_PRIOR_JOBS);

  const score = 100 * (REPUTATION.RATING_WEIGHT * (bayesian / 5) + REPUTATION.COMPLETION_WEIGHT * completion) + (input.verified ? REPUTATION.VERIFIED_BONUS : 0);
  return {
    score: round(Math.min(100, score), 1),
    bayesianRating: round(bayesian),
    completionRate: round(completion, 3),
  };
};

export interface FraudCheck {
  isSuspicious: boolean;
  reasons: string[];
}

/** Account younger than this is a weak fraud signal. */
const NEW_ACCOUNT_DAYS = 3;
const MIN_COMMENT_LENGTH = 20;

class ReputationService {
  /** Mean rating of all visible reviews, the Bayesian prior. */
  async platformMean(): Promise<number> {
    const [row] = await Review.aggregate<{ mean: number }>([{ $match: { isVisible: true } }, { $group: { _id: null, mean: { $avg: '$rating' } } }]);
    return row?.mean || REPUTATION.DEFAULT_PLATFORM_RATING;
  }

  async updateUserReputation(userId: string | Types.ObjectId): Promise<void> {
    const user = await User.findById(userId).select('role');
    if (!user || ![UserRole.FREELANCER, UserRole.CLIENT].includes(user.role)) return;
    const id = user._id;
    const isFreelancer = user.role === UserRole.FREELANCER;

    const [reviews, platformMean, completed, cancelled, lostDisputes, profile] = await Promise.all([
      Review.find({ reviewee: id, isVisible: true }).select('rating createdAt').lean(),
      this.platformMean(),
      Gig.countDocuments({ [isFreelancer ? 'selectedFreelancer' : 'client']: id, status: GigStatus.COMPLETED }),
      Gig.countDocuments({ [isFreelancer ? 'selectedFreelancer' : 'client']: id, status: GigStatus.CANCELLED }),
      // A freelancer loses a dispute when the client is refunded; a client when the money is released.
      Dispute.countDocuments({
        status: DisputeStatus.RESOLVED,
        paymentAction: isFreelancer ? 'refund' : 'release',
        $or: [{ raisedBy: id }, { against: id }],
      }),
      isFreelancer ? FreelancerProfile.findOne({ user: id }).select('verification').lean() : null,
    ]);

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = reviews.length ? round(totalRating / reviews.length) : 0;
    const { score } = computeReputation({
      reviews,
      platformMean,
      completed,
      failed: cancelled + lostDisputes,
      verified: profile?.verification?.status === 'verified',
    });

    const update = { averageRating, totalReviews: reviews.length, reputationScore: score };
    if (isFreelancer) await FreelancerProfile.updateOne({ user: id }, { $set: update });
    else await ClientProfile.updateOne({ user: id }, { $set: update });
  }

  /**
   * Fraud signals for a new review. Strong signals flag on their own; weak ones flag in pairs.
   *  strong: self-review, duplicate review, ≥5 reviews between the pair,
   *          ≥3 reviews by the reviewer in the last hour, comment copied from another of their reviews
   *  weak:   same public login IP as the reviewee (households, offices and NATs share one, and
   *          loopback/private addresses are ignored), reviewer account < 3 days old, comment shorter
   *          than 20 characters, rating ≥ 2.5 stars away from an established (≥ 5 reviews) average
   */
  async detectFraudulentReview(
    reviewerId: string,
    revieweeId: string,
    gigId: string,
    review: { rating?: number; comment?: string } = {}
  ): Promise<FraudCheck> {
    const strong: string[] = [];
    const weak: string[] = [];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const comment = review.comment?.trim() ?? '';

    const [existing, pairCount, recent, users, sameText, revieweeStats] = await Promise.all([
      Review.exists({ gig: gigId, reviewer: reviewerId }),
      Review.countDocuments({ reviewer: reviewerId, reviewee: revieweeId }),
      Review.countDocuments({ reviewer: reviewerId, createdAt: { $gte: oneHourAgo } }),
      User.find({ _id: { $in: [reviewerId, revieweeId] } }).select('+lastLoginIp createdAt').lean(),
      comment ? Review.exists({ reviewer: reviewerId, comment }) : null,
      Review.aggregate<{ avg: number; n: number }>([
        { $match: { reviewee: new Types.ObjectId(revieweeId), isVisible: true } },
        { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } },
      ]),
    ]);

    if (reviewerId === revieweeId) strong.push('Self-review attempt detected');
    if (existing) strong.push('Duplicate review for the same gig');
    if (pairCount >= 5) strong.push('Excessive reviews between same users');
    if (recent >= 3) strong.push('Rapid review submission detected');
    if (sameText) strong.push('Comment copied from another review by the same user');

    const reviewer = users.find((u) => u._id.toString() === reviewerId);
    const reviewee = users.find((u) => u._id.toString() === revieweeId);
    if (isPublicIp(reviewer?.lastLoginIp) && reviewer?.lastLoginIp === reviewee?.lastLoginIp) weak.push('Reviewer and reviewee share an IP address');
    if (reviewer && Date.now() - new Date(reviewer.createdAt).getTime() < NEW_ACCOUNT_DAYS * 86_400_000) weak.push('Brand-new reviewer account');
    if (comment && comment.length < MIN_COMMENT_LENGTH) weak.push('Very short comment');
    const stats = revieweeStats[0];
    if (review.rating !== undefined && stats && stats.n >= 5 && Math.abs(review.rating - stats.avg) >= 2.5) weak.push('Rating is an outlier');

    const isSuspicious = strong.length > 0 || weak.length >= 2;
    return { isSuspicious, reasons: isSuspicious ? [...strong, ...weak] : [] };
  }

  async getReputationBreakdown(userId: string): Promise<{
    overall: number;
    categories: Record<string, number>;
    totalReviews: number;
    distribution: Record<number, number>;
    reputationScore: number;
  }> {
    const [reviews, freelancer, client] = await Promise.all([
      Review.find({ reviewee: userId, isVisible: true }).lean(),
      FreelancerProfile.findOne({ user: userId }).select('reputationScore').lean(),
      ClientProfile.findOne({ user: userId }).select('reputationScore').lean(),
    ]);
    const reputationScore = freelancer?.reputationScore ?? client?.reputationScore ?? 0;
    const keys = ['communication', 'quality', 'timeliness', 'professionalism', 'value'] as const;
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    if (reviews.length === 0) {
      return { overall: 0, categories: Object.fromEntries(keys.map((k) => [k, 0])), totalReviews: 0, distribution, reputationScore };
    }

    const sums = Object.fromEntries(keys.map((k) => [k, 0])) as Record<(typeof keys)[number], number>;
    for (const review of reviews) {
      for (const k of keys) sums[k] += review.categories[k];
      const rounded = Math.min(5, Math.max(1, Math.round(review.rating)));
      distribution[rounded] += 1;
    }
    const count = reviews.length;
    return {
      overall: round(reviews.reduce((sum, r) => sum + r.rating, 0) / count),
      categories: Object.fromEntries(keys.map((k) => [k, round(sums[k] / count)])),
      totalReviews: count,
      distribution,
      reputationScore,
    };
  }
}

export default new ReputationService();
