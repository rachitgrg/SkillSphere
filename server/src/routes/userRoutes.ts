import { Router } from 'express';
import { getUserById, updateProfile, getFreelancerProfile, updateFreelancerProfile, getClientProfile, updateClientProfile } from '../controllers/userController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { UserRole } from '../types';

const router = Router();

router.use(protect);

router.get('/:id', getUserById);
router.put('/profile', updateProfile);

router.get('/freelancer/:userId', getFreelancerProfile);
router.put('/freelancer', authorize(UserRole.FREELANCER), updateFreelancerProfile);

router.get('/client/:userId', getClientProfile);
router.put('/client', authorize(UserRole.CLIENT), updateClientProfile);

export default router;
