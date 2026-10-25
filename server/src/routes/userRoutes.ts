import { Router } from 'express';
import { getUserById, updateProfile, getFreelancerProfile, updateFreelancerProfile, getClientProfile, updateClientProfile } from '../controllers/userController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { UserRole } from '../types';
import { validate } from '../middleware/validate';
import { updateProfileSchema, updateFreelancerProfileSchema, updateClientProfileSchema } from '../utils/validators';

const router = Router();

router.use(protect);

router.get('/:id', getUserById);
router.put('/profile', validate(updateProfileSchema), updateProfile);

router.get('/freelancer/:userId', getFreelancerProfile);
router.put('/freelancer', authorize(UserRole.FREELANCER), validate(updateFreelancerProfileSchema), updateFreelancerProfile);

router.get('/client/:userId', getClientProfile);
router.put('/client', authorize(UserRole.CLIENT), validate(updateClientProfileSchema), updateClientProfile);

export default router;
