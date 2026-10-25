import { Router } from 'express';
import {
  getMe,
  updateMe,
  getFreelancerProfile,
  updateFreelancerProfile,
  getClientProfile,
  updateClientProfile,
} from '../controllers/userController';
import { protect, optionalAuth } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { updateProfileSchema, updateFreelancerProfileSchema, updateClientProfileSchema } from '../utils/validators';
import { UserRole } from '../types';

const router = Router();

router.get('/me', protect, getMe);
router.put('/me', protect, validate(updateProfileSchema), updateMe);

// `me` routes are declared before `:userId` so they are never captured as an id.
router.put('/freelancers/me', protect, authorize(UserRole.FREELANCER), validate(updateFreelancerProfileSchema), updateFreelancerProfile);
router.get('/freelancers/:userId', optionalAuth, getFreelancerProfile);

router.put('/clients/me', protect, authorize(UserRole.CLIENT), validate(updateClientProfileSchema), updateClientProfile);
router.get('/clients/:userId', optionalAuth, getClientProfile);

export default router;
