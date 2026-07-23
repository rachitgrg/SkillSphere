import { Response } from 'express';
import User from '../models/User';
import FreelancerProfile from '../models/FreelancerProfile';
import ClientProfile from '../models/ClientProfile';
import { AuthRequest, UserRole } from '../types';

export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'User found', data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { firstName, lastName, phone, bio, location, address } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { firstName, lastName, phone, bio, location, address },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({ success: true, message: 'Profile updated', data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFreelancerProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profile = await FreelancerProfile.findOne({ user: req.params.userId }).populate('user', 'firstName lastName avatar email');
    if (!profile) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Profile found', data: profile });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFreelancerProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== UserRole.FREELANCER) {
      res.status(403).json({ success: false, message: 'Not authorized' });
      return;
    }
    const profile = await FreelancerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    res.status(200).json({ success: true, message: 'Profile updated', data: profile });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getClientProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profile = await ClientProfile.findOne({ user: req.params.userId }).populate('user', 'firstName lastName avatar email');
    if (!profile) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Profile found', data: profile });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateClientProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== UserRole.CLIENT) {
      res.status(403).json({ success: false, message: 'Not authorized' });
      return;
    }
    const profile = await ClientProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    res.status(200).json({ success: true, message: 'Profile updated', data: profile });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
