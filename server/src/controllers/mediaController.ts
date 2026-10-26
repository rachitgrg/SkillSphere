import { Response, NextFunction } from 'express';
import User from '../models/User';
import FreelancerProfile from '../models/FreelancerProfile';
import uploadService from '../services/uploadService';
import { uploadedFiles } from '../middleware/upload';
import { AuthRequest } from '../types';

/** POST /users/me/avatar — field `avatar` (image, 5 MB). */
export const uploadAvatar = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stored = await uploadService.uploadFile(req.file!, 'avatars', { avatar: true });
    const user = await User.findByIdAndUpdate(req.user!._id, { $set: { avatar: stored.url } }, { returnDocument: 'after' });
    res.status(200).json({ success: true, message: 'Avatar updated', data: user });
  } catch (error) {
    next(error);
  }
};

/** POST /users/freelancers/me/resume — field `resume` (PDF/DOC/DOCX, 5 MB). Replaces the previous file. */
export const uploadResume = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stored = await uploadService.uploadFile(req.file!, 'resumes');
    const previous = await FreelancerProfile.findOneAndUpdate(
      { user: req.user!._id },
      { $set: { resume: { url: stored.url, publicId: stored.publicId, name: stored.name, size: stored.size, mimeType: stored.mimeType, uploadedAt: new Date() } } }
    ).select('resume');
    await uploadService.deleteFile(previous?.resume?.publicId, 'raw');
    const profile = await FreelancerProfile.findOne({ user: req.user!._id });
    res.status(200).json({ success: true, message: 'Resume uploaded', data: profile });
  } catch (error) {
    next(error);
  }
};

/** DELETE /users/freelancers/me/resume */
export const deleteResume = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const previous = await FreelancerProfile.findOneAndUpdate({ user: req.user!._id }, { $unset: { resume: 1 } }).select('resume');
    await uploadService.deleteFile(previous?.resume?.publicId, 'raw');
    const profile = await FreelancerProfile.findOne({ user: req.user!._id });
    res.status(200).json({ success: true, message: 'Resume removed', data: profile });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /users/freelancers/me/portfolio — multipart: title, description, url?, technologies?, `images` (up to 6);
 * or JSON with `imageUrls` instead of files.
 */
export const addPortfolioItem = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stored = await uploadService.uploadFiles(uploadedFiles(req), 'portfolio');
    const { title, description, url, technologies, imageUrls = [] } = req.body as {
      title: string;
      description: string;
      url?: string;
      technologies?: string[];
      imageUrls?: string[];
    };
    const profile = await FreelancerProfile.findOneAndUpdate(
      { user: req.user!._id },
      {
        $push: {
          portfolio: {
            title,
            description,
            url: url || undefined,
            technologies: technologies ?? [],
            images: [...stored.map((f) => f.url), ...imageUrls].slice(0, 6),
            imagePublicIds: stored.map((f) => f.publicId),
            completedAt: new Date(),
          },
        },
      },
      { returnDocument: 'after', runValidators: true }
    );
    res.status(201).json({ success: true, message: 'Portfolio item added', data: profile });
  } catch (error) {
    next(error);
  }
};

/** DELETE /users/freelancers/me/portfolio/:itemId — also deletes its images. */
export const deletePortfolioItem = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const before = await FreelancerProfile.findOneAndUpdate(
      { user: req.user!._id, 'portfolio._id': req.params.itemId },
      { $pull: { portfolio: { _id: req.params.itemId } } }
    ).select('+portfolio.imagePublicIds');
    if (!before) {
      res.status(404).json({ success: false, message: 'Portfolio item not found' });
      return;
    }
    const item = before.portfolio.find((p) => p._id?.toString() === req.params.itemId);
    await Promise.all((item?.imagePublicIds ?? []).map((id) => uploadService.deleteFile(id, 'image')));
    const profile = await FreelancerProfile.findOne({ user: req.user!._id });
    res.status(200).json({ success: true, message: 'Portfolio item removed', data: profile });
  } catch (error) {
    next(error);
  }
};

/** POST /users/freelancers/me/verification-request — `documents` (ID or portfolio proof, up to 3) + message. */
export const requestVerification = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const current = await FreelancerProfile.findOne({ user: req.user!._id }).select('verification');
    if (!current) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }
    if (['pending', 'verified'].includes(current.verification?.status)) {
      res.status(409).json({ success: false, message: `Verification is already ${current.verification.status}` });
      return;
    }

    const stored = await uploadService.uploadFiles(uploadedFiles(req), 'verification');
    const profile = await FreelancerProfile.findOneAndUpdate(
      { user: req.user!._id },
      {
        $set: {
          verification: {
            status: 'pending',
            documents: stored.map(({ url, publicId, name, mimeType }) => ({ url, publicId, name, mimeType })),
            message: (req.body as { message?: string }).message,
            requestedAt: new Date(),
          },
        },
      },
      { returnDocument: 'after' }
    );
    res.status(200).json({ success: true, message: 'Verification requested', data: profile });
  } catch (error) {
    next(error);
  }
};
