import jwt, { SignOptions } from 'jsonwebtoken';
import { JwtPayload } from '../types';

export const generateAccessToken = (payload: { id: string; role: string }): string => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'secret', {
    expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as SignOptions['expiresIn'],
  });
};

export const generateRefreshToken = (payload: { id: string }): string => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'refresh-secret', {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
  });
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, process.env.JWT_SECRET || 'secret') as JwtPayload;
};

export const verifyRefreshToken = (token: string): { id: string } => {
  return jwt.verify(
    token,
    process.env.JWT_REFRESH_SECRET || 'refresh-secret'
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
