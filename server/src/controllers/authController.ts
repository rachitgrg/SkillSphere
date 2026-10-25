import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import ClientProfile from '../models/ClientProfile';
import FreelancerProfile from '../models/FreelancerProfile';
import { AuthRequest, IUser, UserRole } from '../types';
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

    await user.save();

    if (user.role === UserRole.CLIENT) {
      const clientProfile = new ClientProfile({
        user: user._id,
        totalSpent: 0,
        postedGigs: 0,
        activeGigs: 0,
        completedGigs: 0,
        averageRating: 0,
        totalReviews: 0,
        paymentVerified: false
      });
      await clientProfile.save();
    } else if (user.role === UserRole.FREELANCER) {
      const freelancerProfile = new FreelancerProfile({
        user: user._id,
        title: 'New Freelancer',
        headline: 'Ready to work',
        skills: [],
        portfolio: [],
        certifications: [],
        workExperience: [],
        education: [],
        hourlyRate: 0,
        availability: 'available',
        availabilitySlots: [],
        totalEarnings: 0,
        completedGigs: 0,
        averageRating: 0,
        totalReviews: 0,
        responseTime: 24,
        languages: []
      });
      await freelancerProfile.save();
    }

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

    user.lastLogin = new Date();
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
const startSession = async (res: Response, user: IUser): Promise<string> => {
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
