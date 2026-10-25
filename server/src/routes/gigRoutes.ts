import { Router } from 'express';
import { createGig, getGigs, getGigById, updateGig, deleteGig, analyzeCareer } from '../controllers/gigController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { UserRole } from '../types';
import { validate } from '../middleware/validate';
import { createGigSchema, updateGigSchema } from '../utils/validators';

const router = Router();

router.get('/', protect, getGigs);
router.post('/analyze-career', protect, authorize(UserRole.FREELANCER, UserRole.ADMIN), analyzeCareer);
router.get('/:id', protect, getGigById);
router.post('/', protect, authorize(UserRole.CLIENT), validate(createGigSchema), createGig);
router.put('/:id', protect, authorize(UserRole.CLIENT), validate(updateGigSchema), updateGig);
router.delete('/:id', protect, authorize(UserRole.CLIENT, UserRole.ADMIN), deleteGig);

export default router;
