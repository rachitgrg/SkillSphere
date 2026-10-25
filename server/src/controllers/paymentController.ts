import { Response, NextFunction } from 'express';
import Payment from '../models/Payment';
import { AuthRequest } from '../types';
import paymentService from '../services/paymentService';

export const createOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await paymentService.createOrder(req.user!, req.body);
    res.status(201).json({ success: true, message: 'Payment order created', data: result });
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const payment = await paymentService.verifyAndEscrow(req.user!, {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });
    res.status(200).json({ success: true, message: 'Payment verified and held in escrow', data: payment });
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

    const released = await paymentService.releasePayment(payment._id.toString());
    res.status(200).json({ success: true, message: 'Payment released to freelancer', data: released });
  } catch (error) {
    next(error);
  }
};

export const getPayments = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payments = await paymentService.getPaymentsForUser(req.user!._id);
    res.status(200).json({ success: true, message: 'Payments retrieved', data: payments });
  } catch (error) {
    next(error);
  }
};
