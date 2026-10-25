import { Router } from 'express';
import { getGigMatches, getRecommendations, careerAnalysis } from '../controllers/aiController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { careerAnalysisSchema } from '../utils/validators';
import { UserRole } from '../types';

const router = Router();

router.use(protect);

router.get('/gigs/:gigId/matches', authorize(UserRole.CLIENT), getGigMatches);
router.get('/recommendations', authorize(UserRole.FREELANCER), getRecommendations);
router.post('/career-analysis', authorize(UserRole.FREELANCER), validate(careerAnalysisSchema), careerAnalysis);

export default router;
