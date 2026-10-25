import { Router } from 'express';
import { createDispute, getDisputes, getDisputeById, resolveDispute } from '../controllers/disputeController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { createDisputeSchema, resolveDisputeSchema } from '../utils/validators';
import { UserRole } from '../types';

const router = Router();

router.use(protect);

router.post('/', authorize(UserRole.CLIENT, UserRole.FREELANCER), validate(createDisputeSchema), createDispute);
router.get('/', getDisputes);
router.get('/:id', getDisputeById);
router.put('/:id/resolve', authorize(UserRole.ADMIN), validate(resolveDisputeSchema), resolveDispute);

export default router;
