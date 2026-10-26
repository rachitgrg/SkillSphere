import { Router } from 'express';
import {
  getMe,
  updateMe,
  getFreelancerProfile,
  updateFreelancerProfile,
  getClientProfile,
  updateClientProfile,
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../controllers/userController';
import {
  uploadAvatar,
  uploadResume,
  deleteResume,
  addPortfolioItem,
  deletePortfolioItem,
  requestVerification,
} from '../controllers/mediaController';
import { protect, optionalAuth } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rateLimiter';
import { fileUpload } from '../middleware/upload';
import { requireUploads } from '../services/uploadService';
import { authorize } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import {
  updateProfileSchema,
  updateFreelancerProfileSchema,
  updateClientProfileSchema,
  portfolioItemSchema,
  verificationRequestSchema,
  notificationPreferencesSchema,
} from '../utils/validators';
import { UserRole } from '../types';

const router = Router();

router.get('/me', protect, getMe);
router.put('/me', protect, validate(updateProfileSchema), updateMe);
router.get('/me/notification-preferences', protect, getNotificationPreferences);
router.put('/me/notification-preferences', protect, validate(notificationPreferencesSchema), updateNotificationPreferences);
router.post('/me/avatar', protect, uploadLimiter, requireUploads, fileUpload({ field: 'avatar', kinds: ['image'], maxSizeMB: 5 }), uploadAvatar);

// Uploads: rate-limited, 503 without Cloudinary (checked before the body is buffered).
const freelancerUpload = [protect, authorize(UserRole.FREELANCER), uploadLimiter, requireUploads];
router.post('/freelancers/me/resume', ...freelancerUpload, fileUpload({ field: 'resume', kinds: ['resume'], maxSizeMB: 5 }), uploadResume);
router.delete('/freelancers/me/resume', protect, authorize(UserRole.FREELANCER), deleteResume);
router.post(
  '/freelancers/me/portfolio',
  ...freelancerUpload,
  fileUpload({ field: 'images', kinds: ['image'], maxFiles: 6, maxSizeMB: 5, required: false }),
  validate(portfolioItemSchema),
  addPortfolioItem
);
router.delete('/freelancers/me/portfolio/:itemId', protect, authorize(UserRole.FREELANCER), deletePortfolioItem);
router.post(
  '/freelancers/me/verification-request',
  ...freelancerUpload,
  fileUpload({ field: 'documents', kinds: ['image', 'document'], maxFiles: 3, maxSizeMB: 5 }),
  validate(verificationRequestSchema),
  requestVerification
);

// `me` routes are declared before `:userId` so they are never captured as an id.
router.put('/freelancers/me', protect, authorize(UserRole.FREELANCER), validate(updateFreelancerProfileSchema), updateFreelancerProfile);
router.get('/freelancers/:userId', optionalAuth, getFreelancerProfile);

router.put('/clients/me', protect, authorize(UserRole.CLIENT), validate(updateClientProfileSchema), updateClientProfile);
router.get('/clients/:userId', optionalAuth, getClientProfile);

export default router;
