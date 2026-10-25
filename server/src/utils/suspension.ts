import { IUser } from '../types';

/**
 * True while the user is banned. A temporary suspension whose `suspendedUntil` has passed
 * is lifted (and saved) on the spot, so expiry needs no background job.
 */
export const isSuspended = async (user: IUser): Promise<boolean> => {
  if (!user.isBanned) return false;
  if (user.suspendedUntil && user.suspendedUntil.getTime() <= Date.now()) {
    user.isBanned = false;
    user.banReason = undefined;
    user.suspendedUntil = undefined;
    await user.save();
    return false;
  }
  return true;
};
