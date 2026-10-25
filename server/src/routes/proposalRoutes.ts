import { Router } from 'express';
import { createProposal, getMyProposals, getProposalsForGig, getProposalById, updateProposalStatus, withdrawProposal } from '../controllers/proposalController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { UserRole } from '../types';
import { validate } from '../middleware/validate';
import { createProposalSchema, updateProposalStatusSchema } from '../utils/validators';

const router = Router();

router.use(protect);

router.post('/', authorize(UserRole.FREELANCER), validate(createProposalSchema), createProposal);
router.get('/mine', authorize(UserRole.FREELANCER), getMyProposals);
router.get('/gig/:gigId', getProposalsForGig);
router.get('/:id', getProposalById);
router.put('/:id/withdraw', authorize(UserRole.FREELANCER), withdrawProposal);
router.put('/:id/status', authorize(UserRole.CLIENT), validate(updateProposalStatusSchema), updateProposalStatus);

export default router;
