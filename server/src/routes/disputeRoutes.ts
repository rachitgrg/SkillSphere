import { Router } from 'express';
import { createDispute, getDisputes, resolveDispute } from '../controllers/disputeController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { UserRole } from '../types';

const router = Router();

router.use(protect);

router.post('/', createDispute);
router.get('/', getDisputes);
router.put('/:id/resolve', authorize(UserRole.ADMIN), resolveDispute);

export default router;
