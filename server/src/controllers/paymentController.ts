import { Response, NextFunction } from 'express';
import Payment from '../models/Payment';
import Gig from '../models/Gig';
import { AuthRequest, PaymentStatus } from '../types';
import { getRazorpay } from '../config/razorpay';
import { env } from '../config/env';
import crypto from 'crypto';

export const createPaymentIntent = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { gigId, milestoneId, freelancerId, amount, description } = req.body;

    const razorpay = getRazorpay();
    if (!razorpay) {
      res.status(503).json({ success: false, message: 'Payments not configured' });
      return;
    }

    const gig = await Gig.findById(gigId);
    if (!gig) {
      res.status(404).json({ success: false, message: 'Gig not found' });
      return;
    }

    const platformFeePercentage = env.PLATFORM_FEE_PERCENTAGE;
    const platformFee = (amount * platformFeePercentage) / 100;
    const freelancerAmount = amount - platformFee;

    const options = {
      amount: Math.round(amount * 100), // amount in smallest currency unit
      currency: "INR",
      receipt: `receipt_order_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);

    const payment = new Payment({
      gig: gigId,
      milestone: milestoneId,
      client: req.user?._id,
      freelancer: freelancerId,
      amount,
      platformFee,
      freelancerAmount,
      currency: 'INR',
      status: PaymentStatus.PENDING,
      razorpayOrderId: order.id,
      description
    });

    await payment.save();

    res.status(201).json({ success: true, message: 'Payment intent created', data: { payment, order } });
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET || '')
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
      if (payment) {
        payment.status = PaymentStatus.ESCROW;
        payment.razorpayPaymentId = razorpay_payment_id;
        payment.razorpaySignature = razorpay_signature;
        payment.escrowedAt = new Date();
        await payment.save();
        res.status(200).json({ success: true, message: 'Payment verified successfully', data: payment });
      } else {
        res.status(404).json({ success: false, message: 'Payment record not found' });
      }
    } else {
      res.status(400).json({ success: false, message: 'Invalid signature sent!' });
    }
  } catch (error) {
    next(error);
  }
};

export const releasePayment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      res.status(404).json({ success: false, message: 'Payment not found' });
      return;
    }

    if (payment.client.toString() !== req.user?._id.toString()) {
      res.status(403).json({ success: false, message: 'Only the client can release the payment' });
      return;
    }

    if (payment.status !== PaymentStatus.ESCROW) {
      res.status(400).json({ success: false, message: 'Payment must be in escrow to be released' });
      return;
    }

    payment.status = PaymentStatus.RELEASED;
    payment.releasedAt = new Date();
    await payment.save();

    res.status(200).json({ success: true, message: 'Payment released to freelancer', data: payment });
  } catch (error) {
    next(error);
  }
};

export const getPayments = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payments = await Payment.find({
      $or: [{ client: req.user?._id }, { freelancer: req.user?._id }]
    }).populate('gig', 'title').sort({ createdAt: -1 });

    res.status(200).json({ success: true, message: 'Payments retrieved', data: payments });
  } catch (error) {
    next(error);
  }
};
