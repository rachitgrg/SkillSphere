import { Response } from 'express';
import Payment from '../models/Payment';
import { AuthRequest, UserRole } from '../types';
import mongoose from 'mongoose';

export const getEarningsAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== UserRole.FREELANCER) {
      res.status(403).json({ success: false, message: 'Not authorized' });
      return;
    }

    const earnings = await Payment.aggregate([
      { $match: { freelancer: new mongoose.Types.ObjectId(req.user._id), status: 'released' } },
      { 
        $group: { 
          _id: { month: { $month: "$releasedAt" }, year: { $year: "$releasedAt" } },
          totalAmount: { $sum: "$freelancerAmount" } 
        } 
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    res.status(200).json({ success: true, message: 'Analytics retrieved', data: earnings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSpendingAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== UserRole.CLIENT) {
      res.status(403).json({ success: false, message: 'Not authorized' });
      return;
    }

    const spending = await Payment.aggregate([
      { $match: { client: new mongoose.Types.ObjectId(req.user._id), status: 'released' } },
      { 
        $group: { 
          _id: { month: { $month: "$releasedAt" }, year: { $year: "$releasedAt" } },
          totalAmount: { $sum: "$amount" } 
        } 
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    res.status(200).json({ success: true, message: 'Analytics retrieved', data: spending });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
