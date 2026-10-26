import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import User from '../models/User';
import accountService from '../services/accountService';
import { env, features } from '../config/env';
import { AuthRequest, IUser, UserRole } from '../types';
import { isSuspended } from '../utils/suspension';
import { startSession } from './authController';

// ───────────── Email verification ─────────────

/** GET /auth/verify-email/:token */
export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await accountService.verifyEmail(req.params.token);
    if (!user) {
      res.status(400).json({ success: false, message: 'This verification link is invalid or has expired' });
      return;
    }
    res.status(200).json({ success: true, message: 'Email verified', data: { email: user.email } });
  } catch (error) {
    next(error);
  }
};

/** POST /auth/resend-verification */
export const resendVerification = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user!.isVerified) {
      res.status(409).json({ success: false, message: 'Your email is already verified' });
      return;
    }
    await accountService.sendEmailVerification(req.user!);
    res.status(200).json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    next(error);
  }
};

// ───────────── Password reset ─────────────

/** POST /auth/forgot-password — always 200 so attackers can't probe which emails exist. */
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await accountService.requestPasswordReset(req.body.email);
    res.status(200).json({ success: true, message: 'If an account exists for that email, a reset link is on its way' });
  } catch (error) {
    next(error);
  }
};

/** POST /auth/reset-password/:token */
export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ok = await accountService.resetPassword(req.params.token, req.body.password);
    if (!ok) {
      res.status(400).json({ success: false, message: 'This reset link is invalid or has expired' });
      return;
    }
    res.status(200).json({ success: true, message: 'Password updated. Please log in.' });
  } catch (error) {
    next(error);
  }
};

// ───────────── Two-factor ─────────────

/** POST /auth/2fa/setup — returns a QR code for an authenticator app. */
export const twoFactorSetup = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user!.twoFactorEnabled) {
      res.status(409).json({ success: false, message: 'Two-factor authentication is already on' });
      return;
    }
    const setup = await accountService.setupTwoFactor(req.user!);
    res.status(200).json({ success: true, message: 'Scan the QR code, then confirm with a code', data: setup });
  } catch (error) {
    next(error);
  }
};

/** POST /auth/2fa/enable { code } — returns backup codes once. */
export const twoFactorEnable = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const backupCodes = await accountService.enableTwoFactor(req.user!, req.body.code);
    if (!backupCodes) {
      res.status(400).json({ success: false, message: 'That code is not valid. Check your authenticator app and try again.' });
      return;
    }
    res.status(200).json({ success: true, message: 'Two-factor authentication enabled', data: { backupCodes } });
  } catch (error) {
    next(error);
  }
};

/** POST /auth/2fa/disable { password, code } */
export const twoFactorDisable = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.user!._id).select('+password');
    if (!user?.twoFactorEnabled) {
      res.status(409).json({ success: false, message: 'Two-factor authentication is not on' });
      return;
    }
    const passwordOk = user.password ? await user.comparePassword(req.body.password) : true;
    if (!passwordOk || !(await accountService.checkSecondFactor(user._id.toString(), req.body.code))) {
      res.status(400).json({ success: false, message: 'Password or code is incorrect' });
      return;
    }
    await accountService.disableTwoFactor(user);
    res.status(200).json({ success: true, message: 'Two-factor authentication disabled' });
  } catch (error) {
    next(error);
  }
};

/** POST /auth/2fa/verify { tempToken, code } — second login step; starts the session. */
export const twoFactorVerify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = accountService.readTwoFactorChallenge(req.body.tempToken);
    if (!userId) {
      res.status(401).json({ success: false, message: 'Your sign-in expired. Please log in again.' });
      return;
    }
    const user = await User.findById(userId);
    if (!user || !user.isActive || (await isSuspended(user))) {
      res.status(403).json({ success: false, message: 'Account is not active' });
      return;
    }
    if (!(await accountService.checkSecondFactor(userId, req.body.code))) {
      res.status(400).json({ success: false, message: 'That code is not valid' });
      return;
    }
    user.lastLogin = new Date();
    user.lastLoginIp = req.ip;
    const token = await startSession(res, user);
    res.status(200).json({ success: true, message: 'Login successful', data: { user, token } });
  } catch (error) {
    next(error);
  }
};

// ───────────── Google OAuth ─────────────

/** GET /auth/providers — which sign-in options are configured. */
export const getProviders = (_req: Request, res: Response): void => {
  res.status(200).json({ success: true, message: 'Sign-in providers', data: { google: features.google, emailVerification: env.REQUIRE_EMAIL_VERIFICATION } });
};

const oauthRedirect = (res: Response, error?: string) =>
  res.redirect(`${env.CLIENT_URL}/oauth/callback${error ? `?error=${encodeURIComponent(error)}` : ''}`);

/** GET /auth/google — starts the Google consent flow (503 when not configured). */
export const googleStart = (req: Request, res: Response, next: NextFunction): void => {
  if (!features.google) {
    res.status(503).json({ success: false, message: 'Google sign-in is not configured' });
    return;
  }
  passport.authenticate('google', { session: false, scope: ['profile', 'email'], prompt: 'select_account' })(req, res, next);
};

/** GET /auth/google/callback — sets the refresh cookie and returns to the client. */
export const googleCallback = (req: Request, res: Response, next: NextFunction): void => {
  if (!features.google) {
    oauthRedirect(res, 'Google sign-in is not configured');
    return;
  }
  passport.authenticate('google', { session: false }, async (error: Error | null, user: IUser | false) => {
    try {
      if (error || !user) return oauthRedirect(res, 'Google sign-in failed');
      if (!user.isActive || (await isSuspended(user))) return oauthRedirect(res, 'This account is not active');
      user.lastLoginIp = req.ip;
      await startSession(res, user);
      oauthRedirect(res);
    } catch (err) {
      next(err);
    }
  })(req, res, next);
};

/** POST /auth/choose-role { role } — first Google login picks client or freelancer once. */
export const chooseRole = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    if (!user.needsRoleSelection) {
      res.status(409).json({ success: false, message: 'Your role is already set' });
      return;
    }
    user.role = req.body.role as UserRole;
    user.needsRoleSelection = false;
    await accountService.createRoleProfile(user);
    // The role is part of the access token, so issue a fresh one.
    const token = await startSession(res, user);
    res.status(200).json({ success: true, message: 'Welcome to SkillSphere', data: { user, token } });
  } catch (error) {
    next(error);
  }
};
