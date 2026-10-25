import { Router } from 'express';
import {
  getStats,
  getAnalytics,
  getUsers,
  getUserDetails,
  suspendUser,
  unsuspendUser,
  getPendingGigs,
  approveGig,
  rejectGig,
  getPayments,
  getFraudReport,
  setReviewVisibility,
  getLogs,
} from '../controllers/adminController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { suspendUserSchema, rejectGigSchema, reviewVisibilitySchema } from '../utils/validators';
import { UserRole } from '../types';

const router = Router();

router.use(protect, authorize(UserRole.ADMIN));

router.get('/stats', getStats);
router.get('/analytics', getAnalytics);

router.get('/users', getUsers);
router.get('/users/:id', getUserDetails);
router.put('/users/:id/suspend', validate(suspendUserSchema), suspendUser);
router.put('/users/:id/unsuspend', unsuspendUser);

router.get('/gigs/pending', getPendingGigs);
router.put('/gigs/:id/approve', approveGig);
router.put('/gigs/:id/reject', validate(rejectGigSchema), rejectGig);

router.get('/payments', getPayments);
router.get('/fraud', getFraudReport);
router.put('/reviews/:id/visibility', validate(reviewVisibilitySchema), setReviewVisibility);
router.get('/logs', getLogs);

export default router;
