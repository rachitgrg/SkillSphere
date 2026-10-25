import { Router } from 'express';
import { createGig, getGigs, getMyGigs, getGigById, updateGig, deleteGig, cancelGig } from '../controllers/gigController';
import { protect, optionalAuth } from '../middleware/auth';
import { authorize, requireVerified } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { createGigSchema, updateGigSchema } from '../utils/validators';
import { UserRole } from '../types';

const router = Router();

router.get('/', optionalAuth, getGigs);
router.get('/mine', protect, authorize(UserRole.CLIENT, UserRole.FREELANCER), getMyGigs);
router.get('/:id', optionalAuth, getGigById);
router.post('/', protect, authorize(UserRole.CLIENT), requireVerified, validate(createGigSchema), createGig);
router.put('/:id', protect, authorize(UserRole.CLIENT), validate(updateGigSchema), updateGig);
router.put('/:id/cancel', protect, authorize(UserRole.CLIENT), cancelGig);
router.delete('/:id', protect, authorize(UserRole.CLIENT, UserRole.ADMIN), deleteGig);

export default router;
