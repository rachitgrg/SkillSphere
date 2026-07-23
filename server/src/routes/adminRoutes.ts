import { Router } from 'express';
import { getDashboardStats, banUser, unbanUser, getAllUsers } from '../controllers/adminController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { UserRole } from '../types';

const router = Router();

router.use(protect);
router.use(authorize(UserRole.ADMIN));

router.get('/dashboard', getDashboardStats);
router.get('/users', getAllUsers);
router.post('/users/ban', banUser);
router.post('/users/unban', unbanUser);

export default router;
