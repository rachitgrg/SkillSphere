import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import accountService from '../services/accountService';
import { AuthRequest, IUser } from '../types';
import { isSuspended } from '../utils/suspension';
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  setRefreshCookie,
  verifyRefreshToken,
} from '../utils/generateToken';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, email, password, role } = req.body;
    
    let user = await User.findOne({ email });
    if (user) {
      res.status(400).json({ success: false, message: 'User already exists' });
      return;
    }

    user = new User({
      firstName,
      lastName,
      email,
      password,
      role,
      isVerified: false,
      isActive: true,
      isBanned: false,
      twoFactorEnabled: false
    });

    user.lastLoginIp = req.ip;
    await user.save();
    await accountService.createRoleProfile(user);
    await accountService.sendEmailVerification(user);

    const token = await startSession(res, user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { user, token }
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    // Checked after the password so account state isn't revealed to guessers.
    if (await isSuspended(user)) {
      res.status(403).json({ success: false, message: 'Account is suspended' });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'Account is deactivated' });
      return;
    }

    // Password is right but a second factor is required: no session until /auth/2fa/verify.
    if (user.twoFactorEnabled) {
      res.status(200).json({
        success: true,
        message: 'Two-factor code required',
        data: { twoFactorRequired: true, tempToken: accountService.issueTwoFactorChallenge(user) },
      });
      return;
    }

    user.lastLogin = new Date();
    user.lastLoginIp = req.ip;
    const token = await startSession(res, user);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user, token }
    });
  } catch (error) {
    next(error);
  }
};

/** Revokes the refresh token from the cookie (if any) and clears it. Works with an expired access token. */
export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      try {
        const { id } = verifyRefreshToken(token);
        await User.updateOne({ _id: id, refreshToken: hashToken(token) }, { $unset: { refreshToken: 1 } });
      } catch {
        // Invalid/expired token: nothing to revoke.
      }
    }
    clearRefreshCookie(res);
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id).select('-password');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'User profile retrieved', data: user });
  } catch (error) {
    next(error);
  }
};

/**
 * Exchanges the httpOnly refresh cookie for a new access token and rotates the refresh token.
 * Presenting an already-rotated token revokes the session (likely token theft).
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      res.status(401).json({ success: false, message: 'Refresh token required' });
      return;
    }

    let userId: string;
    try {
      userId = verifyRefreshToken(token).id;
    } catch {
      clearRefreshCookie(res);
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }

    const user = await User.findById(userId).select('+refreshToken');
    if (!user || user.refreshToken !== hashToken(token)) {
      if (user?.refreshToken) {
        user.refreshToken = undefined;
        await user.save();
      }
      clearRefreshCookie(res);
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }

    if (!user.isActive || (await isSuspended(user))) {
      clearRefreshCookie(res);
      res.status(403).json({ success: false, message: 'Account is not active' });
      return;
    }

    const accessToken = await startSession(res, user);
    res.status(200).json({ success: true, message: 'Token refreshed', data: { user, token: accessToken } });
  } catch (error) {
    next(error);
  }
};

/** Issues an access token, rotates the (hashed) refresh token and sets its cookie. */
export const startSession = async (res: Response, user: IUser): Promise<string> => {
  const refresh = generateRefreshToken({ id: user._id.toString() });
  user.refreshToken = hashToken(refresh);
  await user.save();
  setRefreshCookie(res, refresh);
  return generateAccessToken({ id: user._id.toString(), role: user.role });
};

/** PUT /auth/change-password — verifies the current password and starts a fresh session (other sessions are revoked). */
export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user!._id).select('+password');
    if (!user || !(await user.comparePassword(currentPassword))) {
      res.status(400).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    user.password = newPassword;
    const token = await startSession(res, user);
    res.status(200).json({ success: true, message: 'Password changed', data: { token } });
  } catch (error) {
    next(error);
  }
};
