import { Router, Request, Response, NextFunction } from 'express';
import { env, features } from '../config/env';
import embeddingService from '../services/embeddingService';
import cacheService from '../services/cacheService';
import FreelancerProfile from '../models/FreelancerProfile';
import Gig from '../models/Gig';
import Review from '../models/Review';
import { GigStatus } from '../types';

const router = Router();

/** GET /config — which optional integrations are live, so the UI can show disabled states. */
router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Platform configuration',
    data: {
      uploads: features.cloudinary,
      payments: features.razorpay,
      ai: embeddingService.available,
      google: features.google,
      emailVerification: env.REQUIRE_EMAIL_VERIFICATION,
      platformFeePercentage: env.PLATFORM_FEE_PERCENTAGE,
    },
  });
});

export interface PlatformStats {
  openGigs: number;
  verifiedFreelancers: number;
  completedProjects: number;
  /** Mean of visible review ratings, or null before the first review. */
  averageRating: number | null;
  categories: { category: string; openGigs: number }[];
}

/** GET /config/stats — live public counts for the landing page, cached for 10 minutes. */
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await cacheService.wrap<PlatformStats>('config:stats', 600, async () => {
      const openPublic = { status: GigStatus.OPEN, visibility: 'public' as const };
      const [openGigs, verifiedFreelancers, completedProjects, [rating], categories] = await Promise.all([
        Gig.countDocuments(openPublic),
        FreelancerProfile.countDocuments({ 'verification.status': 'verified' }),
        Gig.countDocuments({ status: GigStatus.COMPLETED }),
        Review.aggregate<{ mean: number }>([{ $match: { isVisible: true } }, { $group: { _id: null, mean: { $avg: '$rating' } } }]),
        Gig.aggregate<{ category: string; openGigs: number }>([
          { $match: openPublic },
          { $group: { _id: '$category', openGigs: { $sum: 1 } } },
          { $sort: { openGigs: -1 } },
          { $project: { _id: 0, category: '$_id', openGigs: 1 } },
        ]),
      ]);
      return {
        openGigs,
        verifiedFreelancers,
        completedProjects,
        averageRating: rating ? Math.round(rating.mean * 10) / 10 : null,
        categories,
      };
    });
    res.status(200).json({ success: true, message: 'Platform stats', data: stats });
  } catch (error) {
    next(error);
  }
});

export default router;
