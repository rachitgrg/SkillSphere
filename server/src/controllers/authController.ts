import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import accountService from '../services/accountService';
import sessionService from '../services/sessionService';
import { AuthRequest, IUser } from '../types';
import { isSuspended } from '../utils/suspension';
import { REFRESH_COOKIE, clearRefreshCookie, generateAccessToken, setRefreshCookie } from '../utils/generateToken';

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

    const token = await startSession(req, res, user);

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
    const token = await startSession(req, res, user);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user, token }
    });
  } catch (error) {
    next(error);
  }
};

/** Ends this device's session (from the cookie, if any) and clears it. Works with an expired access token. */
export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await sessionService.revoke(token);
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
 * A token rotated in the last 30 s (another tab refreshed at the same moment) gets an access token
 * and keeps the newer cookie; replaying an older rotated token revokes that device's session.
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      res.status(401).json({ success: false, message: 'Refresh token required' });
      return;
    }

    const result = await sessionService.rotate(token);
    if (result.status === 'invalid') {
      clearRefreshCookie(res);
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }

    const { user } = result;
    if (!user.isActive || (await isSuspended(user))) {
      clearRefreshCookie(res);
      res.status(403).json({ success: false, message: 'Account is not active' });
      return;
    }

    if (result.status === 'rotated') setRefreshCookie(res, result.refreshToken);
    const accessToken = generateAccessToken({ id: user._id.toString(), role: user.role });
    res.status(200).json({ success: true, message: 'Token refreshed', data: { user, token: accessToken } });
  } catch (error) {
    next(error);
  }
};

/** Saves the user, starts a session for this device (other devices stay signed in), sets its cookie and returns an access token. */
export const startSession = async (req: Request, res: Response, user: IUser): Promise<string> => {
  await user.save();
  setRefreshCookie(res, await sessionService.create(user._id.toString(), req.get('user-agent')));
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
    await sessionService.revokeAll(user._id); // signs out every other device
    const token = await startSession(req, res, user);
    res.status(200).json({ success: true, message: 'Password changed', data: { token } });
  } catch (error) {
    next(error);
  }
};
