import { Router, Request, Response } from 'express';
import { env, features } from '../config/env';
import embeddingService from '../services/embeddingService';

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

export default router;
