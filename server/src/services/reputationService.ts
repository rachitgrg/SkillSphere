import Review from '../models/Review';
import FreelancerProfile from '../models/FreelancerProfile';
import ClientProfile from '../models/ClientProfile';
import { UserRole } from '../types';
import User from '../models/User';

class ReputationService {
  async updateUserReputation(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) return;

    if (user.role === UserRole.FREELANCER) {
      await this.updateFreelancerReputation(userId);
    } else if (user.role === UserRole.CLIENT) {
      await this.updateClientReputation(userId);
    }
  }

  async updateFreelancerReputation(userId: string): Promise<void> {
    const reviews = await Review.find({
      reviewee: userId,
      isVisible: true,
    });

    if (reviews.length === 0) return;

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = Math.round((totalRating / reviews.length) * 100) / 100;

    await FreelancerProfile.findOneAndUpdate(
      { user: userId },
      {
        averageRating,
        totalReviews: reviews.length,
      }
    );
  }

  async updateClientReputation(userId: string): Promise<void> {
    const reviews = await Review.find({
      reviewee: userId,
      isVisible: true,
    });

    if (reviews.length === 0) return;

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = Math.round((totalRating / reviews.length) * 100) / 100;

    await ClientProfile.findOneAndUpdate(
      { user: userId },
      {
        averageRating,
        totalReviews: reviews.length,
      }
    );
  }

  async detectFraudulentReview(
    reviewerId: string,
    revieweeId: string,
    gigId: string
  ): Promise<{ isSuspicious: boolean; reasons: string[] }> {
    const reasons: string[] = [];
    let isSuspicious = false;

    // Check if reviewer and reviewee are the same
    if (reviewerId === revieweeId) {
      reasons.push('Self-review attempt detected');
      isSuspicious = true;
    }

    // Check for duplicate reviews
    const existingReview = await Review.findOne({
      gig: gigId,
      reviewer: reviewerId,
    });

    if (existingReview) {
      reasons.push('Duplicate review for the same gig');
      isSuspicious = true;
    }

    // Check for review bombing (more than 5 reviews from same reviewer to same reviewee)
    const reviewCount = await Review.countDocuments({
      reviewer: reviewerId,
      reviewee: revieweeId,
    });

    if (reviewCount >= 5) {
      reasons.push('Excessive reviews between same users');
      isSuspicious = true;
    }

    // Check for rapid reviews (more than 3 reviews in last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentReviews = await Review.countDocuments({
      reviewer: reviewerId,
      createdAt: { $gte: oneHourAgo },
    });

    if (recentReviews >= 3) {
      reasons.push('Rapid review submission detected');
      isSuspicious = true;
    }

    return { isSuspicious, reasons };
  }

  async getReputationBreakdown(
    userId: string
  ): Promise<{
    overall: number;
    categories: Record<string, number>;
    totalReviews: number;
    distribution: Record<number, number>;
  }> {
    const reviews = await Review.find({
      reviewee: userId,
      isVisible: true,
    });

    if (reviews.length === 0) {
      return {
        overall: 0,
        categories: {
          communication: 0,
          quality: 0,
          timeliness: 0,
          professionalism: 0,
          value: 0,
        },
        totalReviews: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const categories = {
      communication: 0,
      quality: 0,
      timeliness: 0,
      professionalism: 0,
      value: 0,
    };

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    reviews.forEach((review) => {
      categories.communication += review.categories.communication;
      categories.quality += review.categories.quality;
      categories.timeliness += review.categories.timeliness;
      categories.professionalism += review.categories.professionalism;
      categories.value += review.categories.value;

      const roundedRating = Math.round(review.rating);
      distribution[roundedRating] = (distribution[roundedRating] || 0) + 1;
    });

    const count = reviews.length;
    const overall =
      reviews.reduce((sum, r) => sum + r.rating, 0) / count;

    return {
      overall: Math.round(overall * 100) / 100,
      categories: {
        communication: Math.round((categories.communication / count) * 100) / 100,
        quality: Math.round((categories.quality / count) * 100) / 100,
        timeliness: Math.round((categories.timeliness / count) * 100) / 100,
        professionalism:
          Math.round((categories.professionalism / count) * 100) / 100,
        value: Math.round((categories.value / count) * 100) / 100,
      },
      totalReviews: count,
      distribution,
    };
  }
}

export default new ReputationService();
