import { Router } from 'express';
import { getGigMatches, getRecommendations, careerAnalysis, resumeAnalysis } from '../controllers/aiController';
import { fileUpload } from '../middleware/upload';
import { uploadLimiter } from '../middleware/rateLimiter';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { careerAnalysisSchema } from '../utils/validators';
import { UserRole } from '../types';

const router = Router();

router.use(protect);

router.get('/gigs/:gigId/matches', authorize(UserRole.CLIENT), getGigMatches);
router.get('/recommendations', authorize(UserRole.FREELANCER), getRecommendations);
router.post(
  '/resume-analysis',
  authorize(UserRole.FREELANCER),
  uploadLimiter,
  fileUpload({ field: 'resume', kinds: ['resume', 'document'], maxSizeMB: 5, required: false }),
  resumeAnalysis
);
router.post('/career-analysis', authorize(UserRole.FREELANCER), validate(careerAnalysisSchema), careerAnalysis);

export default router;
