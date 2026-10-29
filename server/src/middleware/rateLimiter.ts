import rateLimit, { type Options } from 'express-rate-limit';
import { env } from '../config/env';

// Rate limits are disabled under test so suites can make many requests.
const skip = () => env.NODE_ENV === 'test';

/** Per-IP limiter answering in the API's response shape. Keyed on req.ip, so set TRUST_PROXY behind a proxy. */
export const createLimiter = (windowMs: number, max: number, message: string, options: Partial<Options> = {}) =>
  rateLimit({ windowMs, max, message: { success: false, message }, standardHeaders: true, legacyHeaders: false, skip, ...options });

export const generalLimiter = createLimiter(15 * 60 * 1000, 100, 'Too many requests, please try again after 15 minutes');

export const authLimiter = createLimiter(15 * 60 * 1000, 20, 'Too many authentication attempts, please try again after 15 minutes');

// An SPA page load fires several queries at once, so this is generous; authLimiter stays strict.
export const apiLimiter = createLimiter(60 * 1000, 300, 'Too many requests, please try again after 1 minute');

export const uploadLimiter = createLimiter(60 * 60 * 1000, 30, 'Too many uploads, please try again after 1 hour');
