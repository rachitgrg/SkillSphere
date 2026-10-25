import { Router } from 'express';
import { getFreelancerAnalytics, getClientAnalytics } from '../controllers/analyticsController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { UserRole } from '../types';

const router = Router();

router.use(protect);

router.get('/freelancer', authorize(UserRole.FREELANCER), getFreelancerAnalytics);
router.get('/client', authorize(UserRole.CLIENT), getClientAnalytics);

export default router;
