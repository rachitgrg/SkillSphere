import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

const trusted = new URL(env.CLIENT_URL).origin;

const originOf = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

/**
 * CSRF guard for the endpoints authenticated by the refresh cookie (/auth/refresh, /auth/logout).
 * Browsers send Origin (or at least Referer) on these POSTs; one that names another site is a
 * cross-site request riding on the cookie and is refused. Requests with neither header come from
 * non-browser clients, which cannot hold a victim's cookie, so they pass. SameSite on the cookie is
 * the first line of defence; this one still holds when COOKIE_SAMESITE=none.
 */
export const requireTrustedOrigin = (req: Request, res: Response, next: NextFunction): void => {
  const origin = originOf(req.get('origin')) ?? originOf(req.get('referer'));
  if (origin && origin !== trusted) {
    res.status(403).json({ success: false, message: 'Cross-site request refused' });
    return;
  }
  next();
};
