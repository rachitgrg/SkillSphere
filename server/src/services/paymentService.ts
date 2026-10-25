import crypto from 'crypto';
import { Types } from 'mongoose';
import { getRazorpay, getRazorpayKeys } from '../config/razorpay';
import Payment from '../models/Payment';
import Gig from '../models/Gig';
import Proposal from '../models/Proposal';
import { IPayment, IUser, PaymentStatus, ProposalStatus } from '../types';
import { HttpError } from '../utils/httpError';

const NOT_CONFIGURED = 'Payments not configured';

/** Statuses that hold or have moved money; a milestone with one of these can't be funded again. */
const ACTIVE_STATUSES = [PaymentStatus.ESCROW, PaymentStatus.RELEASED, PaymentStatus.DISPUTED];

const sameId = (a: unknown, b: unknown): boolean => Boolean(a && b && String(a) === String(b));

/** Constant-time comparison of two hex HMAC digests. */
export const safeEqualHex = (a: string, b: string): boolean => {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};

export interface CreateOrderInput {
  gigId: string;
  milestoneId?: string;
  freelancerId?: string;
  amount?: number;
  description?: string;
}

export interface OrderResult {
  payment: IPayment;
  order: { id: string; amount: number; currency: string };
  keyId: string;
}

class PaymentService {
  isConfigured(): boolean {
    return getRazorpay() !== null;
  }

  /** Throws 503 when Razorpay keys are missing. */
  assertConfigured() {
    const razorpay = getRazorpay();
    const keys = getRazorpayKeys();
    if (!razorpay || !keys) throw new HttpError(503, NOT_CONFIGURED);
    return { razorpay, keys };
  }

  /**
   * Creates a Razorpay order + pending Payment for funding escrow on a gig.
   * Only the gig's client may fund it, only for the hired freelancer, and the amount
   * comes from the milestone (or must fit within the accepted proposal amount).
   */
  async createOrder(user: IUser, input: CreateOrderInput): Promise<OrderResult> {
    const { razorpay, keys } = this.assertConfigured();

    const gig = await Gig.findById(input.gigId);
    if (!gig) throw new HttpError(404, 'Gig not found');
    if (!sameId(gig.client, user._id)) throw new HttpError(403, 'Only the gig owner can fund this gig');
    if (!gig.selectedFreelancer) throw new HttpError(409, 'Hire a freelancer before funding this gig');
    if (input.freelancerId && !sameId(input.freelancerId, gig.selectedFreelancer)) {
      throw new HttpError(400, 'Freelancer is not the one hired for this gig');
    }

    let amount: number;
    let milestoneId: Types.ObjectId | undefined;

    if (input.milestoneId) {
      const milestone = gig.milestones.find((m) => sameId(m._id, input.milestoneId));
      if (!milestone) throw new HttpError(404, 'Milestone not found');
      if (input.amount !== undefined && input.amount !== milestone.amount) {
        throw new HttpError(400, 'Amount must equal the milestone amount');
      }
      amount = milestone.amount;
      milestoneId = milestone._id;

      const existing = await Payment.findOne({
        gig: gig._id,
        milestone: milestoneId,
        status: { $in: [...ACTIVE_STATUSES, PaymentStatus.PENDING] },
      });
      if (existing && existing.status !== PaymentStatus.PENDING) {
        throw new HttpError(409, 'This milestone is already funded');
      }
      // Re-opening checkout for an unpaid order reuses it instead of creating duplicates.
      if (existing?.razorpayOrderId) {
        return {
          payment: existing,
          order: { id: existing.razorpayOrderId, amount: Math.round(existing.amount * 100), currency: existing.currency },
          keyId: keys.keyId,
        };
      }
    } else {
      if (!input.amount || input.amount <= 0) throw new HttpError(400, 'Amount is required');
      const proposal = await Proposal.findOne({
        gig: gig._id,
        freelancer: gig.selectedFreelancer,
        status: ProposalStatus.ACCEPTED,
      });
      if (!proposal) throw new HttpError(409, 'No accepted proposal for this gig');
      const agreed = proposal.finalAmount ?? proposal.proposedAmount;
      const [funded] = await Payment.aggregate<{ total: number }>([
        { $match: { gig: gig._id, status: { $in: ACTIVE_STATUSES } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      if ((funded?.total ?? 0) + input.amount > agreed) {
        throw new HttpError(400, 'Amount exceeds the accepted proposal amount');
      }
      amount = input.amount;
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      receipt: `gig_${gig._id.toString().slice(-12)}_${Date.now()}`,
      notes: { gigId: gig._id.toString(), milestoneId: milestoneId?.toString() ?? '' },
    });

    const payment = await Payment.create({
      gig: gig._id,
      milestone: milestoneId,
      client: user._id,
      freelancer: gig.selectedFreelancer,
      amount,
      currency: 'INR',
      status: PaymentStatus.PENDING,
      razorpayOrderId: order.id,
      description: input.description,
    });

    return {
      payment,
      order: { id: order.id, amount: Number(order.amount), currency: order.currency },
      keyId: keys.keyId,
    };
  }

  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    const { keys } = this.assertConfigured();
    const expected = crypto
      .createHmac('sha256', keys.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return safeEqualHex(expected, signature);
  }

  /** Verifies Checkout's signature and moves the caller's payment into escrow. Idempotent. */
  async verifyAndEscrow(
    user: IUser,
    input: { orderId: string; paymentId: string; signature: string }
  ): Promise<IPayment> {
    this.assertConfigured();

    const payment = await Payment.findOne({ razorpayOrderId: input.orderId });
    if (!payment) throw new HttpError(404, 'Payment record not found');
    if (!sameId(payment.client, user._id)) throw new HttpError(403, 'This payment does not belong to you');
    if (!this.verifyPaymentSignature(input.orderId, input.paymentId, input.signature)) {
      throw new HttpError(400, 'Invalid payment signature');
    }

    if (payment.status === PaymentStatus.PENDING) {
      payment.status = PaymentStatus.ESCROW;
      payment.razorpayPaymentId = input.paymentId;
      payment.razorpaySignature = input.signature;
      payment.escrowedAt = new Date();
      await payment.save();
    }
    return payment;
  }

  /**
   * Moves an escrowed payment to released. Caller-level authorization happens in the controller;
   * `allowDisputed` is for admin dispute resolution only.
   */
  async releasePayment(paymentId: string, options: { allowDisputed?: boolean } = {}): Promise<IPayment> {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new HttpError(404, 'Payment not found');
    const releasable = options.allowDisputed ? [PaymentStatus.ESCROW, PaymentStatus.DISPUTED] : [PaymentStatus.ESCROW];
    if (!releasable.includes(payment.status)) {
      throw new HttpError(400, 'Payment must be in escrow to be released');
    }

    payment.status = PaymentStatus.RELEASED;
    payment.releasedAt = new Date();
    await payment.save();
    return payment;
  }

  /** Refunds through Razorpay (test mode) when money was captured, then marks the payment refunded. */
  async refundPayment(paymentId: string, reason: string, amount?: number): Promise<IPayment> {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new HttpError(404, 'Payment not found');

    if (![PaymentStatus.ESCROW, PaymentStatus.PENDING, PaymentStatus.DISPUTED].includes(payment.status)) {
      throw new HttpError(400, 'Payment cannot be refunded in its current state');
    }

    if (payment.razorpayPaymentId) {
      const { razorpay } = this.assertConfigured();
      try {
        await razorpay.payments.refund(payment.razorpayPaymentId, {
          amount: Math.round((amount ?? payment.amount) * 100),
          notes: { reason },
        });
      } catch (error) {
        console.error('Razorpay refund failed:', error);
        throw new HttpError(502, 'Failed to process refund through payment gateway');
      }
    }

    payment.status = PaymentStatus.REFUNDED;
    payment.refundedAt = new Date();
    payment.refundReason = reason;
    await payment.save();
    return payment;
  }

  /**
   * Dispute split: refunds `refundAmount` to the client (partial Razorpay refund) and releases
   * the remainder to the freelancer. The payment amount shrinks so fees are recomputed on what was paid out.
   */
  async splitPayment(paymentId: string, refundAmount: number, reason: string): Promise<IPayment> {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new HttpError(404, 'Payment not found');
    if (![PaymentStatus.ESCROW, PaymentStatus.DISPUTED].includes(payment.status)) {
      throw new HttpError(400, 'Only escrowed or disputed payments can be split');
    }
    if (refundAmount <= 0 || refundAmount >= payment.amount) {
      throw new HttpError(400, 'Refund amount must be between 0 and the payment amount');
    }

    if (payment.razorpayPaymentId) {
      const { razorpay } = this.assertConfigured();
      try {
        await razorpay.payments.refund(payment.razorpayPaymentId, {
          amount: Math.round(refundAmount * 100),
          notes: { reason },
        });
      } catch (error) {
        console.error('Razorpay partial refund failed:', error);
        throw new HttpError(502, 'Failed to process refund through payment gateway');
      }
    }

    payment.amount = Math.round((payment.amount - refundAmount) * 100) / 100;
    payment.refundedAmount = refundAmount;
    payment.refundedAt = new Date();
    payment.refundReason = reason;
    payment.status = PaymentStatus.RELEASED;
    payment.releasedAt = new Date();
    await payment.save();
    return payment;
  }

  async getPaymentsForUser(userId: Types.ObjectId | string): Promise<IPayment[]> {
    return Payment.find({ $or: [{ client: userId }, { freelancer: userId }] })
      .populate('gig', 'title')
      .sort({ createdAt: -1 });
  }

  async getPaymentsByGig(gigId: string): Promise<IPayment[]> {
    return Payment.find({ gig: gigId })
      .populate('client', 'firstName lastName email')
      .populate('freelancer', 'firstName lastName email')
      .sort({ createdAt: -1 });
  }

  async getPaymentStats(userId: string, role: 'client' | 'freelancer') {
    const matchField = role === 'client' ? 'client' : 'freelancer';
    const amountField = role === 'client' ? 'amount' : 'freelancerAmount';

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
