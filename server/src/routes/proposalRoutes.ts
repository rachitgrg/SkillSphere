import { Router } from 'express';
import { createProposal, getProposalsForGig, getProposalById, updateProposalStatus } from '../controllers/proposalController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { UserRole } from '../types';

const router = Router();

router.use(protect);

router.post('/', authorize(UserRole.FREELANCER), createProposal);
router.get('/gig/:gigId', getProposalsForGig);
router.get('/:id', getProposalById);
router.put('/:id/status', authorize(UserRole.CLIENT, UserRole.ADMIN), updateProposalStatus);

export default router;
