import { Request } from 'express';
import { Types } from 'mongoose';
import AdminLog from '../models/AdminLog';
import { AdminAction, IAdminLog } from '../types';

/** Records an admin mutation (who, what, on which target, from where). */
export const logAdminAction = async (
  req: Request,
  entry: {
    action: AdminAction;
    targetType: IAdminLog['targetType'];
    targetId: Types.ObjectId | string;
    details: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> => {
  await AdminLog.create({ ...entry, admin: req.user!._id, ipAddress: req.ip });
};
