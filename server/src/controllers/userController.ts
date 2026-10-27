import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import User from '../models/User';
import FreelancerProfile from '../models/FreelancerProfile';
import ClientProfile from '../models/ClientProfile';
import { AuthRequest, NOTIFICATION_CATEGORIES, NotificationCategory, NotificationPreferences, UserRole } from '../types';
import { pick } from '../utils/helpers';
import embeddingService from '../services/embeddingService';
import { recordProfileView } from '../services/profileViewService';

/**
 * Fields users may edit; ratings, earnings and counters are server-controlled. The portfolio, resume
 * and verification have their own endpoints (they own uploaded files).
 */
export const FREELANCER_EDITABLE = [
  'title', 'headline', 'skills', 'certifications', 'workExperience', 'education',
  'hourlyRate', 'availability', 'availabilitySlots', 'languages', 'socialLinks', 'location', 'milestonePricing',
] as const;
export const CLIENT_EDITABLE = ['companyName', 'companyWebsite', 'companySize', 'industry', 'description'] as const;
const USER_EDITABLE = ['firstName', 'lastName', 'phone', 'bio', 'location', 'address'] as const;

/** Public user fields shown alongside profiles. */
const PUBLIC_USER_FIELDS = 'firstName lastName avatar bio address role isVerified createdAt lastLogin';

const loadOwnProfile = (userId: Types.ObjectId, role: UserRole) => {
  if (role === UserRole.FREELANCER) return FreelancerProfile.findOne({ user: userId });
  if (role === UserRole.CLIENT) return ClientProfile.findOne({ user: userId });
  return null;
};

/** GET /users/me — the signed-in user plus their role profile. */
export const getMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const profile = await loadOwnProfile(user._id, user.role);
    res.status(200).json({ success: true, message: 'Profile retrieved', data: { user, profile } });
  } catch (error) {
    next(error);
  }
};

/** PUT /users/me — basic account fields (name, phone, bio, address, GeoJSON location). */
export const updateMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user!._id,
      { $set: pick(req.body, USER_EDITABLE) },
      { returnDocument: 'after', runValidators: true }
    );
    res.status(200).json({ success: true, message: 'Profile updated', data: user });
  } catch (error) {
    next(error);
  }
};

/** GET /users/freelancers/:userId — public freelancer profile (hidden for banned/inactive users). */
export const getFreelancerProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findOne({
      _id: req.params.userId,
      role: UserRole.FREELANCER,
      isActive: true,
      isBanned: false,
    }).select(PUBLIC_USER_FIELDS);
    const profile = user && (await FreelancerProfile.findOne({ user: user._id }));
    if (!user || !profile) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }
    await recordProfileView(req, user._id);
    res.status(200).json({ success: true, message: 'Profile found', data: { ...profile.toJSON(), user } });
  } catch (error) {
    next(error);
  }
};

/** PUT /users/freelancers/me */
export const updateFreelancerProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await FreelancerProfile.findOneAndUpdate(
      { user: req.user!._id },
      { $set: pick(req.body, FREELANCER_EDITABLE) },
      { returnDocument: 'after', runValidators: true }
    );
    if (['title', 'headline', 'skills'].some((f) => f in (req.body ?? {}))) {
      embeddingService.queue(() => embeddingService.refreshProfile(req.user!._id));
    }
    res.status(200).json({ success: true, message: 'Profile updated', data: profile });
  } catch (error) {
    next(error);
  }
};

/** Defaults from the User schema, so users created before preferences existed get a full object. */
const withDefaults = (prefs?: Partial<NotificationPreferences>): NotificationPreferences => {
  const base = Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c, true])) as Record<NotificationCategory, boolean>;
  return {
    email: { ...base, messages: false, ...prefs?.email },
    inApp: { ...base, ...prefs?.inApp },
  };
};

/** GET /users/me/notification-preferences */
export const getNotificationPreferences = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.user!._id).select('notificationPreferences').lean();
    res.status(200).json({ success: true, message: 'Notification preferences', data: withDefaults(user?.notificationPreferences) });
  } catch (error) {
    next(error);
  }
};

/** PUT /users/me/notification-preferences { email?: {category: bool}, inApp?: {category: bool} } — partial update. */
export const updateNotificationPreferences = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = req.body as Partial<NotificationPreferences>;
    const $set: Record<string, boolean> = {};
    for (const channel of ['email', 'inApp'] as const) {
      for (const [category, enabled] of Object.entries(body[channel] ?? {})) $set[`notificationPreferences.${channel}.${category}`] = enabled;
    }
    const user = await User.findByIdAndUpdate(req.user!._id, { $set }, { returnDocument: 'after' }).select('notificationPreferences').lean();
    res.status(200).json({ success: true, message: 'Preferences saved', data: withDefaults(user?.notificationPreferences) });
  } catch (error) {
    next(error);
  }
};

/** GET /users/clients/:userId — public client profile. */
export const getClientProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findOne({
      _id: req.params.userId,
      role: UserRole.CLIENT,
      isActive: true,
      isBanned: false,
    }).select(PUBLIC_USER_FIELDS);
    const profile = user && (await ClientProfile.findOne({ user: user._id }));
    if (!user || !profile) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Profile found', data: { ...profile.toJSON(), user } });
  } catch (error) {
    next(error);
  }
};

/** PUT /users/clients/me */
export const updateClientProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await ClientProfile.findOneAndUpdate(
      { user: req.user!._id },
      { $set: pick(req.body, CLIENT_EDITABLE) },
      { returnDocument: 'after', runValidators: true }
    );
    res.status(200).json({ success: true, message: 'Profile updated', data: profile });
  } catch (error) {
    next(error);
  }
};
