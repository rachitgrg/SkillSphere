import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import ClientProfile from '../models/ClientProfile';
import FreelancerProfile from '../models/FreelancerProfile';
import { AuthRequest, UserRole } from '../types';
import { generateAccessToken, generateRefreshToken } from '../utils/generateToken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const register = async (req: Request, res: Response): Promise<void> => {
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

    if (role === UserRole.CLIENT) {
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
    } else if (role === UserRole.FREELANCER) {
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

    const token = generateAccessToken({ id: user._id.toString(), role: user.role });
    const refreshToken = generateRefreshToken({ id: user._id.toString() });
    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { user, token, refreshToken }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    if (user.isBanned) {
      res.status(403).json({ success: false, message: 'Account is banned' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    user.lastLogin = new Date();
    const token = generateAccessToken({ id: user._id.toString(), role: user.role });
    const refreshToken = generateRefreshToken({ id: user._id.toString() });
    user.refreshToken = refreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user, token, refreshToken }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user) {
      req.user.refreshToken = undefined;
      await req.user.save();
    }
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id).select('-password');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'User profile retrieved', data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(401).json({ success: false, message: 'Refresh token required' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as any;
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== token) {
      res.status(403).json({ success: false, message: 'Invalid refresh token' });
      return;
    }

    const newToken = generateToken(user._id.toString(), user.role);
    res.status(200).json({ success: true, message: 'Token refreshed', data: { token: newToken } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Invalid refresh token' });
  }
};
