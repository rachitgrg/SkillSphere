import { Router } from 'express';
import { createProposal, getProposalsForGig, getProposalById, updateProposalStatus } from '../controllers/proposalController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { UserRole } from '../types';
import { validate } from '../middleware/validate';
import { createProposalSchema, updateProposalStatusSchema } from '../utils/validators';

const router = Router();

router.use(protect);

router.post('/', authorize(UserRole.FREELANCER), validate(createProposalSchema), createProposal);
router.get('/gig/:gigId', getProposalsForGig);
router.get('/:id', getProposalById);
router.put('/:id/status', authorize(UserRole.CLIENT), validate(updateProposalStatusSchema), updateProposalStatus);

export default router;
