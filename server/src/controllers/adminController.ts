import { Response } from 'express';
import User from '../models/User';
import Gig from '../models/Gig';
import Payment from '../models/Payment';
import Dispute from '../models/Dispute';
import AdminLog from '../models/AdminLog';
import { AuthRequest, UserRole, AdminAction } from '../types';

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const totalUsers = await User.countDocuments();
    const totalGigs = await Gig.countDocuments();
    const totalPayments = await Payment.countDocuments({ status: 'released' });
    const activeDisputes = await Dispute.countDocuments({ status: { $in: ['open', 'under_review'] } });

    res.status(200).json({
      success: true,
      message: 'Dashboard stats retrieved',
      data: { totalUsers, totalGigs, totalPayments, activeDisputes }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const banUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, reason } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (user.role === UserRole.ADMIN) {
      res.status(403).json({ success: false, message: 'Cannot ban an admin' });
      return;
    }

    user.isBanned = true;
    user.banReason = reason;
    await user.save();

    await AdminLog.create({
      admin: req.user?._id,
      action: AdminAction.USER_BAN,
      targetType: 'user',
      targetId: userId,
      details: reason
    });

    res.status(200).json({ success: true, message: 'User banned successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const unbanUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    user.isBanned = false;
    user.banReason = undefined;
    await user.save();

    await AdminLog.create({
      admin: req.user?._id,
      action: AdminAction.USER_UNBAN,
      targetType: 'user',
      targetId: userId,
      details: 'Ban lifted'
    });

    res.status(200).json({ success: true, message: 'User unbanned successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json({ success: true, message: 'Users retrieved', data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
