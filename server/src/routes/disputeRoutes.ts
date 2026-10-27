import { Router } from 'express';
import { createDispute, getDisputes, getDisputeById, resolveDispute, addEvidence, addDisputeMessage, setDisputeStatus } from '../controllers/disputeController';
import { uploadLimiter } from '../middleware/rateLimiter';
import { fileUpload } from '../middleware/upload';
import { requireUploads } from '../services/uploadService';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { createDisputeSchema, resolveDisputeSchema, disputeEvidenceSchema, disputeMessageSchema, disputeStatusSchema } from '../utils/validators';
import { UserRole } from '../types';

const router = Router();

router.use(protect);

router.post('/', authorize(UserRole.CLIENT, UserRole.FREELANCER), validate(createDisputeSchema), createDispute);
router.get('/', getDisputes);
router.get('/:id', getDisputeById);
router.put('/:id/resolve', authorize(UserRole.ADMIN), validate(resolveDisputeSchema), resolveDispute);
router.put('/:id/status', authorize(UserRole.ADMIN), validate(disputeStatusSchema), setDisputeStatus);
router.post(
  '/:id/evidence',
  authorize(UserRole.CLIENT, UserRole.FREELANCER),
  uploadLimiter,
  requireUploads,
  fileUpload({ field: 'files', kinds: ['image', 'document'], maxFiles: 5, maxSizeMB: 10 }),
  validate(disputeEvidenceSchema),
  addEvidence
);
router.post(
  '/:id/messages',
  uploadLimiter,
  requireUploads,
  fileUpload({ field: 'files', kinds: ['image', 'document'], maxFiles: 3, maxSizeMB: 10, required: false }),
  validate(disputeMessageSchema),
  addDisputeMessage
);

export default router;
