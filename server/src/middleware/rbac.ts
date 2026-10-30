import { Response, NextFunction } from 'express';
import { AuthRequest, UserRole } from '../types';
import { env } from '../config/env';

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Not authorized',
      });
      return;
    }

    if (req.user.needsRoleSelection) {
      res.status(403).json({ success: false, message: 'Choose whether you are a client or a freelancer first' });
      return;
    }

    if (!roles.includes(req.user.role as UserRole)) {
      res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this resource`,
      });
      return;
    }

    next();
  };
};

/** Blocks unverified emails from posting gigs, applying and paying (off when REQUIRE_EMAIL_VERIFICATION=false). */
export const requireVerified = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (env.REQUIRE_EMAIL_VERIFICATION && !req.user?.isVerified) {
    res.status(403).json({ success: false, message: 'Please verify your email address first', code: 'EMAIL_NOT_VERIFIED' });
    return;
  }
  next();
};

