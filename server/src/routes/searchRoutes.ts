import { Router } from 'express';
import { searchGigs, searchFreelancers, getMatchesForGig } from '../controllers/searchController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { UserRole } from '../types';

const router = Router();

router.get('/gigs', searchGigs);
router.get('/freelancers', searchFreelancers);
router.get('/matches/:gigId', protect, authorize(UserRole.CLIENT), getMatchesForGig);

export default router;
