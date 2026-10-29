import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Response } from 'express';
import { JwtPayload, RefreshTokenPayload } from '../types';
import { env } from '../config/env';

export const REFRESH_COOKIE = 'refreshToken';
const REFRESH_COOKIE_PATH = '/api/v1/auth';
/** Carries the 2FA challenge after Google sign-in, so the token never appears in a URL. */
export const TWO_FACTOR_COOKIE = 'twoFactorChallenge';
const TWO_FACTOR_COOKIE_PATH = '/api/v1/auth/2fa';
const TWO_FACTOR_COOKIE_MAX_AGE = 5 * 60_000; // matches the challenge token's lifetime

export const generateAccessToken = (payload: { id: string; role: string }): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
};

/** A random jti makes every issued refresh token unique, so rotation always changes it. */
export const generateRefreshToken = (payload: { id: string }): string => {
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
  });
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
};

/** Refresh tokens are stored hashed so a database leak doesn't hand out sessions. */
export const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

const DURATION_UNITS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** Parses "15m" / "7d" / "3600" (seconds) into milliseconds. */
export const durationToMs = (value: string): number => {
  const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration: ${value}`);
  return Number(match[1]) * DURATION_UNITS[match[2] ?? 's'];
};

/** SameSite=None cookies are only accepted with Secure. */
const cookieOptions = (path = REFRESH_COOKIE_PATH) => ({
  httpOnly: true,
  sameSite: env.COOKIE_SAMESITE,
  secure: env.NODE_ENV === 'production' || env.COOKIE_SAMESITE === 'none',
  path,
});

export const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie(REFRESH_COOKIE, token, { ...cookieOptions(), maxAge: durationToMs(env.JWT_REFRESH_EXPIRES_IN) });
};

export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
};

export const setTwoFactorCookie = (res: Response, challenge: string): void => {
  res.cookie(TWO_FACTOR_COOKIE, challenge, { ...cookieOptions(TWO_FACTOR_COOKIE_PATH), maxAge: TWO_FACTOR_COOKIE_MAX_AGE });
};

export const clearTwoFactorCookie = (res: Response): void => {
  res.clearCookie(TWO_FACTOR_COOKIE, cookieOptions(TWO_FACTOR_COOKIE_PATH));
};
