import Lock from '../models/Lock';
import { HttpError } from './httpError';
import { delay } from './helpers';

const LOCK_TTL_MS = 10_000;

/**
 * Runs `fn` while holding the named lock. Retries briefly, then answers 409 so the caller can retry.
 * A lock left behind by a crash is taken over once it has expired.
 */
export const withLock = async <T>(key: string, fn: () => Promise<T>, attempts = 20): Promise<T> => {
  for (let i = 0; i < attempts; i += 1) {
    const now = new Date();
    try {
      await Lock.deleteOne({ _id: key, expiresAt: { $lt: now } });
      await Lock.create({ _id: key, expiresAt: new Date(now.getTime() + LOCK_TTL_MS) });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      await delay(25 + Math.random() * 50);
      continue;
    }
    try {
      return await fn();
    } finally {
      await Lock.deleteOne({ _id: key });
    }
  }
  throw new HttpError(409, 'Another change is in progress, please try again');
};
