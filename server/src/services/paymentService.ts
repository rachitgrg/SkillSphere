import crypto from 'crypto';
import razorpayInstance from '../config/razorpay';
import Payment from '../models/Payment';
import { Types } from 'mongoose';
import { PaymentStatus } from '../types';

class PaymentService {
  async createOrder(
    amount: number,
    currency: string = 'INR',
    receipt?: string
  ): Promise<{
    orderId: string;
    amount: number;
    currency: string;
  }> {
    const options = {
      amount: Math.round(amount * 100), // Razorpay expects paise
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
    };

    if (!razorpayInstance) {
      throw new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
    }
    const order = await razorpayInstance.orders.create(options);

    return {
      orderId: order.id,
      amount: order.amount as number,
      currency: order.currency,
    };
  }

  verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string
  ): boolean {
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(body)
      .digest('hex');

    return expectedSignature === signature;
  }

  async processEscrow(paymentId: string): Promise<void> {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    payment.status = PaymentStatus.ESCROW;
    payment.escrowedAt = new Date();
    await payment.save();
  }

  async releasePayment(paymentId: string): Promise<void> {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== PaymentStatus.ESCROW) {
      throw new Error('Payment must be in escrow to be released');
    }

    payment.status = PaymentStatus.RELEASED;
    payment.releasedAt = new Date();
    await payment.save();
  }

  async refundPayment(paymentId: string, reason: string): Promise<void> {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (
      payment.status !== PaymentStatus.ESCROW &&
      payment.status !== PaymentStatus.PENDING
    ) {
      throw new Error('Payment cannot be refunded in its current state');
    }

    // Process refund through Razorpay if payment was captured
    if (payment.razorpayPaymentId) {
      try {
        if (!razorpayInstance) {
          throw new Error('Razorpay is not configured');
        }
        await razorpayInstance.payments.refund(payment.razorpayPaymentId, {
          amount: Math.round(payment.amount * 100),
          notes: { reason },
        });
      } catch (error) {
        console.error('Razorpay refund failed:', error);
        throw new Error('Failed to process refund through payment gateway');
      }
    }

    payment.status = PaymentStatus.REFUNDED;
    payment.refundedAt = new Date();
    payment.refundReason = reason;
    await payment.save();
  }

  async getPaymentsByGig(
    gigId: string
  ): Promise<InstanceType<typeof Payment>[]> {
    return Payment.find({ gig: gigId })
      .populate('client', 'firstName lastName email')
      .populate('freelancer', 'firstName lastName email')
      .sort({ createdAt: -1 });
  }

  async getPaymentStats(userId: string, role: 'client' | 'freelancer') {
    const matchField = role === 'client' ? 'client' : 'freelancer';
    const amountField =
      role === 'client' ? 'amount' : 'freelancerAmount';

    const stats = await Payment.aggregate([
      { $match: { [matchField]: new Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$status',
          total: { $sum: `$${amountField}` },
          count: { $sum: 1 },
        },
      },
    ]);

    const result: Record<string, { total: number; count: number }> = {};
    stats.forEach((s: { _id: string; total: number; count: number }) => {
      result[s._id] = { total: s.total, count: s.count };
    });

    return result;
  }

  async calculatePlatformRevenue(
    startDate?: Date,
    endDate?: Date
  ): Promise<{ totalRevenue: number; totalTransactions: number }> {
    const match: Record<string, unknown> = {
      status: { $in: [PaymentStatus.RELEASED, PaymentStatus.ESCROW] },
    };

    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) (match.createdAt as Record<string, Date>).$gte = startDate;
      if (endDate) (match.createdAt as Record<string, Date>).$lte = endDate;
    }

    const result = await Payment.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$platformFee' },
          totalTransactions: { $sum: 1 },
        },
      },
    ]);

    return {
      totalRevenue: result[0]?.totalRevenue || 0,
      totalTransactions: result[0]?.totalTransactions || 0,
    };
  }

  async getRevenueByMonth(
    months: number = 12
  ): Promise<{ month: string; revenue: number; transactions: number }[]> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const result = await Payment.aggregate([
      {
        $match: {
          status: { $in: [PaymentStatus.RELEASED, PaymentStatus.ESCROW] },
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          revenue: { $sum: '$platformFee' },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    return result.map(
      (r: {
        _id: { year: number; month: number };
        revenue: number;
        transactions: number;
      }) => ({
        month: `${r._id.year}-${String(r._id.month).padStart(2, '0')}`,
        revenue: r.revenue,
        transactions: r.transactions,
      })
    );
  }
}

export default new PaymentService();
