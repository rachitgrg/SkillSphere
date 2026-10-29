import { Router } from 'express';
import { register, login, logout, getMe, refreshToken, changePassword } from '../controllers/authController';
import {
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  twoFactorSetup,
  twoFactorEnable,
  twoFactorDisable,
  twoFactorVerify,
  getProviders,
  googleStart,
  googleCallback,
  chooseRole,
} from '../controllers/accountController';
import { protect } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { authLimiter } from '../middleware/rateLimiter';
import { requireTrustedOrigin } from '../middleware/trustedOrigin';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  twoFactorCodeSchema,
  twoFactorDisableSchema,
  twoFactorVerifySchema,
  chooseRoleSchema,
} from '../utils/validators';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', requireTrustedOrigin, refreshToken);
router.post('/logout', requireTrustedOrigin, logout);
router.get('/me', protect, getMe);
router.put('/change-password', protect, authLimiter, validate(changePasswordSchema), changePassword);

// Email verification & password reset
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', protect, authLimiter, resendVerification);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password/:token', authLimiter, validate(resetPasswordSchema), resetPassword);

// Two-factor authentication (TOTP)
router.post('/2fa/setup', protect, twoFactorSetup);
router.post('/2fa/enable', protect, authLimiter, validate(twoFactorCodeSchema), twoFactorEnable);
router.post('/2fa/disable', protect, authLimiter, validate(twoFactorDisableSchema), twoFactorDisable);
router.post('/2fa/verify', authLimiter, validate(twoFactorVerifySchema), twoFactorVerify);

// Google OAuth
router.get('/providers', getProviders);
router.get('/google', googleStart);
router.get('/google/callback', googleCallback);
router.post('/choose-role', protect, validate(chooseRoleSchema), chooseRole);

export default router;
