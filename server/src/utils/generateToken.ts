import jwt, { SignOptions } from 'jsonwebtoken';
import { JwtPayload } from '../types';
import { env } from '../config/env';

export const generateAccessToken = (payload: { id: string; role: string }): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
};

export const generateRefreshToken = (payload: { id: string }): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
  });
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
};

export const verifyRefreshToken = (token: string): { id: string } => {
  return jwt.verify(
    token,
    env.JWT_REFRESH_SECRET
  ) as { id: string };
};

export const generateTokenPair = (
  userId: string,
  role: string
): { accessToken: string; refreshToken: string } => {
  const accessToken = generateAccessToken({ id: userId, role });
  const refreshToken = generateRefreshToken({ id: userId });
  return { accessToken, refreshToken };
};
