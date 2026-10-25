import { Router } from 'express';
import { register, login, logout, getMe, refreshToken, changePassword } from '../controllers/authController';
import { protect } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { authLimiter } from '../middleware/rateLimiter';
import { registerSchema, loginSchema, changePasswordSchema } from '../utils/validators';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.put('/change-password', protect, authLimiter, validate(changePasswordSchema), changePassword);

export default router;
