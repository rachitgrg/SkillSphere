import crypto from 'crypto';
import { env } from '../config/env';

/** URL-safe random token (sent in emails); only its hash is stored. */
export const randomToken = (bytes = 32): string => crypto.randomBytes(bytes).toString('hex');

export const sha256 = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

/**
 * AES-256-GCM for secrets at rest (TOTP seeds). The key comes from TWO_FACTOR_ENCRYPTION_KEY,
 * or is derived from JWT_SECRET when that isn't set — rotating JWT_SECRET then requires users to
 * set up 2FA again.
 */
const key = () => crypto.createHash('sha256').update(env.TWO_FACTOR_ENCRYPTION_KEY ?? `${env.JWT_SECRET}:2fa`).digest();

export const encrypt = (plain: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
};

export const decrypt = (payload: string): string => {
  const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
};
