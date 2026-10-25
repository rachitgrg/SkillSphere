import { Response, NextFunction } from 'express';
import User from '../models/User';
import FreelancerProfile from '../models/FreelancerProfile';
import ClientProfile from '../models/ClientProfile';
import { AuthRequest, UserRole } from '../types';
import { pick } from '../utils/helpers';

/** Fields users may edit; ratings, earnings and counters are server-controlled. */
export const FREELANCER_EDITABLE = [
  'title', 'headline', 'skills', 'portfolio', 'certifications', 'workExperience', 'education',
  'hourlyRate', 'availability', 'availabilitySlots', 'languages', 'socialLinks', 'location', 'milestonePricing',
] as const;
export const CLIENT_EDITABLE = ['companyName', 'companyWebsite', 'companySize', 'industry', 'description'] as const;
const USER_EDITABLE = ['firstName', 'lastName', 'phone', 'bio', 'location', 'address'] as const;

export const getUserById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'User found', data: user });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?._id;
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: pick(req.body, USER_EDITABLE) },
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    res.status(200).json({ success: true, message: 'Profile updated', data: user });
  } catch (error) {
    next(error);
  }
};

export const getFreelancerProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await FreelancerProfile.findOne({ user: req.params.userId }).populate('user', 'firstName lastName avatar email');
    if (!profile) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Profile found', data: profile });
  } catch (error) {
    next(error);
  }
};

export const updateFreelancerProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user?.role !== UserRole.FREELANCER) {
      res.status(403).json({ success: false, message: 'Not authorized' });
      return;
    }
    const profile = await FreelancerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: pick(req.body, FREELANCER_EDITABLE) },
      { returnDocument: 'after', runValidators: true }
    );
    res.status(200).json({ success: true, message: 'Profile updated', data: profile });
  } catch (error) {
    next(error);
  }
};

export const getClientProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await ClientProfile.findOne({ user: req.params.userId }).populate('user', 'firstName lastName avatar email');
    if (!profile) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Profile found', data: profile });
  } catch (error) {
    next(error);
  }
};

export const updateClientProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user?.role !== UserRole.CLIENT) {
      res.status(403).json({ success: false, message: 'Not authorized' });
      return;
    }
    const profile = await ClientProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: pick(req.body, CLIENT_EDITABLE) },
      { returnDocument: 'after', runValidators: true }
    );
    res.status(200).json({ success: true, message: 'Profile updated', data: profile });
  } catch (error) {
    next(error);
  }
};
