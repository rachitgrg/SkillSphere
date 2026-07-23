import { Router } from 'express';
import { createGig, getGigs, getGigById, updateGig, deleteGig } from '../controllers/gigController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { UserRole } from '../types';

const router = Router();

router.get('/', protect, getGigs);
router.get('/:id', protect, getGigById);
router.post('/', protect, authorize(UserRole.CLIENT), createGig);
router.put('/:id', protect, authorize(UserRole.CLIENT, UserRole.ADMIN), updateGig);
router.delete('/:id', protect, authorize(UserRole.CLIENT, UserRole.ADMIN), deleteGig);

export default router;
