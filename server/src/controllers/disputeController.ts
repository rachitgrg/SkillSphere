import { Response } from 'express';
import Dispute from '../models/Dispute';
import Payment from '../models/Payment';
import { AuthRequest, DisputeStatus, PaymentStatus } from '../types';

export const createDispute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { gigId, paymentId, againstId, title, description, evidence } = req.body;

    const dispute = new Dispute({
      gig: gigId,
      payment: paymentId,
      raisedBy: req.user?._id,
      against: againstId,
      title,
      description,
      evidence,
      status: DisputeStatus.OPEN
    });

    await dispute.save();

    if (paymentId) {
      await Payment.findByIdAndUpdate(paymentId, { status: PaymentStatus.DISPUTED });
    }

    res.status(201).json({ success: true, message: 'Dispute opened successfully', data: dispute });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDisputes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const disputes = await Dispute.find({
      $or: [{ raisedBy: req.user?._id }, { against: req.user?._id }]
    }).populate('gig', 'title').sort({ createdAt: -1 });

    res.status(200).json({ success: true, message: 'Disputes retrieved', data: disputes });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resolveDispute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { resolution, adminNotes, paymentAction } = req.body;

    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) {
      res.status(404).json({ success: false, message: 'Dispute not found' });
      return;
    }

    dispute.status = DisputeStatus.RESOLVED;
    dispute.resolution = resolution;
    dispute.adminNotes = adminNotes;
    dispute.resolvedBy = req.user?._id;
    dispute.resolvedAt = new Date();
    await dispute.save();

    if (dispute.payment && paymentAction) {
      if (paymentAction === 'refund') {
        await Payment.findByIdAndUpdate(dispute.payment, { status: PaymentStatus.REFUNDED, refundedAt: new Date() });
      } else if (paymentAction === 'release') {
        await Payment.findByIdAndUpdate(dispute.payment, { status: PaymentStatus.RELEASED, releasedAt: new Date() });
      }
    }

    res.status(200).json({ success: true, message: 'Dispute resolved', data: dispute });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
