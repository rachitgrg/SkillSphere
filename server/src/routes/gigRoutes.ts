import { Router } from 'express';
import {
  createGig,
  getGigs,
  getMyGigs,
  getGigById,
  updateGig,
  deleteGig,
  cancelGig,
  addAttachments,
  removeAttachment,
  inviteFreelancer,
  getMyInvitations,
  respondToInvitation,
} from '../controllers/gigController';
import {
  getProgress,
  addProgressLog,
  startMilestone,
  setMilestoneProgress,
  submitMilestone,
  approveMilestone,
  requestMilestoneChanges,
  completeGig,
} from '../controllers/projectController';
import { uploadLimiter } from '../middleware/rateLimiter';
import { fileUpload } from '../middleware/upload';
import { requireUploads } from '../services/uploadService';
import { protect, optionalAuth } from '../middleware/auth';
import { authorize, requireVerified } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import {
  createGigSchema,
  updateGigSchema,
  inviteFreelancerSchema,
  respondInvitationSchema,
  progressLogSchema,
  milestonePercentSchema,
  submitMilestoneSchema,
  requestChangesSchema,
} from '../utils/validators';
import { UserRole } from '../types';

const router = Router();

router.get('/', optionalAuth, getGigs);
router.get('/invitations', protect, authorize(UserRole.FREELANCER), getMyInvitations);
router.get('/mine', protect, authorize(UserRole.CLIENT, UserRole.FREELANCER), getMyGigs);
router.get('/:id', optionalAuth, getGigById);
router.post('/', protect, authorize(UserRole.CLIENT), requireVerified, validate(createGigSchema), createGig);
router.put('/:id', protect, authorize(UserRole.CLIENT), validate(updateGigSchema), updateGig);
router.put('/:id/cancel', protect, authorize(UserRole.CLIENT), cancelGig);
router.post(
  '/:id/attachments',
  protect,
  authorize(UserRole.CLIENT),
  uploadLimiter,
  requireUploads,
  fileUpload({ field: 'files', kinds: ['image', 'document'], maxFiles: 5, maxSizeMB: 10 }),
  addAttachments
);
router.delete('/:id/attachments/:attachmentId', protect, authorize(UserRole.CLIENT), removeAttachment);
router.post('/:id/invite', protect, authorize(UserRole.CLIENT), validate(inviteFreelancerSchema), inviteFreelancer);
router.put('/:id/invitation', protect, authorize(UserRole.FREELANCER), validate(respondInvitationSchema), respondToInvitation);
router.delete('/:id', protect, authorize(UserRole.CLIENT, UserRole.ADMIN), deleteGig);

// Project progress (4.14): both parties; uploads are optional (multipart) and need Cloudinary.
const optionalFiles = [uploadLimiter, requireUploads, fileUpload({ field: 'files', kinds: ['image', 'document'], maxFiles: 5, maxSizeMB: 10, required: false })];
router.get('/:id/progress', protect, getProgress);
router.post('/:id/progress-logs', protect, authorize(UserRole.CLIENT, UserRole.FREELANCER), ...optionalFiles, validate(progressLogSchema), addProgressLog);
router.put('/:id/milestones/:mid/start', protect, authorize(UserRole.FREELANCER), startMilestone);
router.put('/:id/milestones/:mid/progress', protect, authorize(UserRole.FREELANCER), validate(milestonePercentSchema), setMilestoneProgress);
router.put('/:id/milestones/:mid/submit', protect, authorize(UserRole.FREELANCER), ...optionalFiles, validate(submitMilestoneSchema), submitMilestone);
router.put('/:id/milestones/:mid/approve', protect, authorize(UserRole.CLIENT), approveMilestone);
router.put('/:id/milestones/:mid/request-changes', protect, authorize(UserRole.CLIENT), validate(requestChangesSchema), requestMilestoneChanges);
router.put('/:id/complete', protect, authorize(UserRole.CLIENT), completeGig);

export default router;
