import crypto from 'crypto';
import User from '../models/User';
import { env } from '../config/env';
import { IUser, RefreshSession } from '../types';
import { durationToMs, generateRefreshToken, hashToken, verifyRefreshToken } from '../utils/generateToken';

/** Devices a user can stay signed in on at once; the oldest session is dropped beyond this. */
export const MAX_SESSIONS = 10;
/**
 * After a rotation the previous token still works for this long (returning an access token only),
 * so two tabs refreshing at the same moment don't sign each other out.
 */
export const ROTATION_GRACE_MS = 30_000;

export type RefreshResult =
  | { status: 'rotated'; user: IUser; refreshToken: string }
  | { status: 'grace'; user: IUser } // the browser already holds the newer cookie
  | { status: 'invalid' };

const expiry = () => new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRES_IN));

/**
 * Refresh-token sessions, one per signed-in device ("family"). Only hashes are stored, and every
 * change is a single atomic update so concurrent requests can't overwrite each other.
 */
class SessionService {
  /** Starts a session for a new sign-in and returns its raw refresh token. */
  async create(userId: string, userAgent?: string): Promise<string> {
    const token = generateRefreshToken({ id: userId });
    const now = new Date();
    const session: RefreshSession = {
      hash: hashToken(token),
      family: crypto.randomUUID(),
      expiresAt: expiry(),
      userAgent: userAgent?.slice(0, 200),
      createdAt: now,
    };
    await User.updateOne({ _id: userId }, { $pull: { refreshSessions: { expiresAt: { $lte: now } } } });
    await User.updateOne({ _id: userId }, { $push: { refreshSessions: { $each: [session], $slice: -MAX_SESSIONS } } });
    return token;
  }

  /**
   * Exchanges a refresh token for a rotated one. A token rotated less than ROTATION_GRACE_MS ago
   * gets the grace result; one rotated earlier is a replay (likely theft) and revokes its family.
   */
  async rotate(token: string): Promise<RefreshResult> {
    let userId: string;
    try {
      userId = verifyRefreshToken(token).id;
    } catch {
      return { status: 'invalid' };
    }
    const hash = hashToken(token);
    const next = generateRefreshToken({ id: userId });
    const now = new Date();

    const rotated = await User.findOneAndUpdate(
      { _id: userId, refreshSessions: { $elemMatch: { hash, expiresAt: { $gt: now } } } },
      {
        $set: {
          'refreshSessions.$.hash': hashToken(next),
          'refreshSessions.$.previousHash': hash,
          'refreshSessions.$.rotatedAt': now,
          'refreshSessions.$.expiresAt': expiry(),
        },
      },
      { returnDocument: 'after' }
    );
    if (rotated) return { status: 'rotated', user: rotated, refreshToken: next };

    const previous = await User.findOne({ _id: userId, 'refreshSessions.previousHash': hash }).select('+refreshSessions');
    const session = previous?.refreshSessions?.find((s) => s.previousHash === hash);
    if (!previous || !session) return { status: 'invalid' };
    if (session.rotatedAt && now.getTime() - session.rotatedAt.getTime() <= ROTATION_GRACE_MS) {
      return { status: 'grace', user: previous };
    }
    await User.updateOne({ _id: userId }, { $pull: { refreshSessions: { family: session.family } } });
    return { status: 'invalid' };
  }

  /** Signs out the device holding `token` (logout). */
  async revoke(token: string): Promise<void> {
    try {
      const { id } = verifyRefreshToken(token);
      const hash = hashToken(token);
      await User.updateOne({ _id: id }, { $pull: { refreshSessions: { $or: [{ hash }, { previousHash: hash }] } } });
    } catch {
      // Invalid/expired token: nothing to revoke.
    }
  }

  /** Signs out every device (password change/reset, suspension). */
  async revokeAll(userId: IUser['_id'] | string): Promise<void> {
    await User.updateOne({ _id: userId }, { $set: { refreshSessions: [] } });
  }
}

export default new SessionService();
