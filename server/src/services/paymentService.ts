import crypto from 'crypto';
import { Types } from 'mongoose';
import { getRazorpay, getRazorpayKeys } from '../config/razorpay';
import { env } from '../config/env';
import Payment from '../models/Payment';
import Gig from '../models/Gig';
import Proposal from '../models/Proposal';
import FreelancerProfile from '../models/FreelancerProfile';
import ClientProfile from '../models/ClientProfile';
import notificationService from './notificationService';
import { GigStatus, IPayment, IUser, MilestoneStatus, NotificationType, PaymentStatus, ProposalStatus } from '../types';
import { HttpError } from '../utils/httpError';
import { formatCurrency } from '../utils/helpers';

const NOT_CONFIGURED = 'Payments not configured';

/** Statuses that hold or have moved money; a milestone with one of these can't be funded again. */
const ACTIVE_STATUSES = [PaymentStatus.ESCROW, PaymentStatus.RELEASED, PaymentStatus.DISPUTED];

const sameId = (a: unknown, b: unknown): boolean => Boolean(a && b && String(a) === String(b));

const isDuplicateKey = (error: unknown) => (error as { code?: number })?.code === 11000;

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
  /** Razorpay key id for Checkout; null in simulated mode. */
  keyId: string | null;
  /** True when no gateway is involved (SIMULATE_PAYMENTS); the client confirms via /payments/:id/simulate. */
  simulated: boolean;
}

/** Razorpay webhook events we act on (subset of the payload). */
interface WebhookEvent {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string; error_description?: string } };
    refund?: { entity: { id: string; payment_id: string; amount: number } };
  };
}

const paymentLink = '/payments';

class PaymentService {
  /** Dev/demo mode without Razorpay: checkout is confirmed by the client and no money moves. */
  isSimulated(): boolean {
    return getRazorpay() === null && env.SIMULATE_PAYMENTS && env.NODE_ENV !== 'production';
  }

  isConfigured(): boolean {
    return getRazorpay() !== null || this.isSimulated();
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
    const simulated = this.isSimulated();
    const gateway = simulated ? null : this.assertConfigured();

    const gig = await Gig.findById(input.gigId);
    if (!gig) throw new HttpError(404, 'Gig not found');
    if (!sameId(gig.client, user._id)) throw new HttpError(403, 'Only the gig owner can fund this gig');
    if (!gig.selectedFreelancer) throw new HttpError(409, 'Hire a freelancer before funding this gig');
    if (gig.status !== GigStatus.IN_PROGRESS) throw new HttpError(409, `A ${gig.status.replace('_', ' ')} gig cannot be funded`);
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

      // Milestones never add up to more than the agreed price (they are scaled to it on hire).
      if (gig.budgetType === 'fixed') {
        const proposal = await Proposal.findOne({ gig: gig._id, freelancer: gig.selectedFreelancer, status: ProposalStatus.ACCEPTED });
        if (proposal) {
          const agreed = proposal.finalAmount ?? proposal.proposedAmount;
          const [funded] = await Payment.aggregate<{ total: number }>([
            { $match: { gig: gig._id, milestone: { $ne: milestoneId }, status: { $in: ACTIVE_STATUSES } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ]);
          if ((funded?.total ?? 0) + amount > agreed + 0.005) {
            throw new HttpError(409, 'Funding this milestone would exceed the agreed amount');
          }
        }
      }

      if (await Payment.exists({ gig: gig._id, milestone: milestoneId, status: { $in: ACTIVE_STATUSES } })) {
        throw new HttpError(409, 'This milestone is already funded');
      }
      // Re-opening checkout for an unpaid order reuses it instead of creating duplicates.
      const pending = await Payment.findOne({ gig: gig._id, milestone: milestoneId, status: PaymentStatus.PENDING });
      if (pending?.razorpayOrderId) return this.orderResult(pending, gateway?.keys.keyId ?? null, simulated);
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

    const orderId = gateway
      ? (
          await gateway.razorpay.orders.create({
            amount: Math.round(amount * 100), // paise
            currency: 'INR',
            receipt: `gig_${gig._id.toString().slice(-12)}_${Date.now()}`,
            notes: { gigId: gig._id.toString(), milestoneId: milestoneId?.toString() ?? '' },
          })
        ).id
      : `sim_order_${crypto.randomBytes(8).toString('hex')}`;

    let payment: IPayment;
    try {
      payment = await Payment.create({
        gig: gig._id,
        milestone: milestoneId,
        client: user._id,
        freelancer: gig.selectedFreelancer,
        amount,
        currency: 'INR',
        status: PaymentStatus.PENDING,
        razorpayOrderId: orderId,
        description: input.description,
      });
    } catch (error) {
      // A concurrent request created this milestone's order first (unique index): hand that one back.
      if (!isDuplicateKey(error)) throw error;
      const winner = await Payment.findOne({ gig: gig._id, milestone: milestoneId, status: PaymentStatus.PENDING });
      if (!winner?.razorpayOrderId) throw new HttpError(409, 'This milestone is already funded');
      payment = winner;
    }
    return this.orderResult(payment, gateway?.keys.keyId ?? null, simulated);
  }

  private orderResult(payment: IPayment, keyId: string | null, simulated: boolean): OrderResult {
    return {
      payment,
      order: { id: payment.razorpayOrderId!, amount: Math.round(payment.amount * 100), currency: payment.currency },
      keyId,
      simulated,
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

  /**
   * Pending → escrow (idempotent): marks the milestone funded and tells both parties.
   * Called from Checkout verification, the webhook and simulated checkout.
   */
  async markEscrowed(payment: IPayment, gatewayPaymentId: string, signature?: string): Promise<IPayment> {
    const current = await Payment.findById(payment._id);
    if (!current || ![PaymentStatus.PENDING, PaymentStatus.CANCELLED].includes(current.status)) return current ?? payment; // already handled

    // Money arrived for an order that can no longer be fulfilled: give it straight back.
    const gig = await Gig.findById(current.gig).select('title milestones status');
    if (current.status === PaymentStatus.CANCELLED || !gig || gig.status === GigStatus.CANCELLED) {
      return this.refundStrayCapture(current, gatewayPaymentId, 'The order was cancelled before the payment completed');
    }

    let updated: IPayment | null;
    try {
      updated = await Payment.findOneAndUpdate(
        { _id: payment._id, status: PaymentStatus.PENDING },
        {
          $set: {
            status: PaymentStatus.ESCROW,
            razorpayPaymentId: gatewayPaymentId,
            ...(signature && { razorpaySignature: signature }),
            escrowedAt: new Date(),
          },
          $unset: { failureReason: 1 },
        },
        { returnDocument: 'after' }
      );
    } catch (error) {
      // Another payment for this milestone is already live (unique index).
      if (!isDuplicateKey(error)) throw error;
      return this.refundStrayCapture(current, gatewayPaymentId, 'This milestone was already funded');
    }
    if (!updated) return (await Payment.findById(payment._id)) ?? payment; // handled concurrently

    // Older unpaid orders for the same milestone can no longer be used.
    if (updated.milestone) {
      await Payment.updateMany(
        { gig: updated.gig, milestone: updated.milestone, status: PaymentStatus.PENDING, _id: { $ne: updated._id } },
        { $set: { status: PaymentStatus.CANCELLED } }
      );
    }
    if (updated.milestone) {
      await Gig.updateOne(
        { _id: updated.gig, milestones: { $elemMatch: { _id: updated.milestone, status: MilestoneStatus.PENDING } } },
        { $set: { 'milestones.$.status': MilestoneStatus.FUNDED } }
      );
    }
    const what = this.describe(updated, gig);
    await Promise.all([
      notificationService.create({
        recipient: updated.freelancer.toString(),
        sender: updated.client.toString(),
        type: NotificationType.PAYMENT_ESCROW,
        title: 'Milestone funded',
        message: `${formatCurrency(updated.amount)} for ${what} is now held in escrow — you can start work.`,
        data: { gigId: updated.gig.toString(), paymentId: updated._id.toString() },
        link: `/projects/${updated.gig}`,
        category: 'payments',
      }),
      notificationService.create({
        recipient: updated.client.toString(),
        type: NotificationType.PAYMENT_RECEIVED,
        title: 'Payment received',
        message: `Your payment of ${formatCurrency(updated.amount)} for ${what} is held safely in escrow.`,
        data: { gigId: updated.gig.toString(), paymentId: updated._id.toString() },
        link: paymentLink,
        category: 'payments',
      }),
    ]);
    return updated;
  }

  /**
   * Refunds a capture that arrived for an order that is cancelled or whose milestone is already
   * funded, and records the payment as refunded. Idempotent through markEscrowed's status check.
   */
  private async refundStrayCapture(payment: IPayment, gatewayPaymentId: string, reason: string): Promise<IPayment> {
    if (!gatewayPaymentId.startsWith('sim_')) {
      const { razorpay } = this.assertConfigured();
      await razorpay.payments.refund(gatewayPaymentId, { amount: Math.round(payment.amount * 100), notes: { reason } });
    }
    const refunded = await Payment.findByIdAndUpdate(
      payment._id,
      { $set: { status: PaymentStatus.REFUNDED, razorpayPaymentId: gatewayPaymentId, refundedAt: new Date(), refundReason: reason } },
      { returnDocument: 'after' }
    );
    await notificationService.create({
      recipient: payment.client.toString(),
      type: NotificationType.PAYMENT_REFUNDED,
      title: 'Payment refunded',
      message: `Your payment of ${formatCurrency(payment.amount)} was refunded automatically. ${reason}.`,
      data: { gigId: payment.gig.toString(), paymentId: payment._id.toString() },
      link: paymentLink,
      category: 'payments',
    });
    return refunded ?? payment;
  }

  /** "milestone “X” of “Gig”" or "“Gig”", for notification text. */
  private describe(payment: IPayment, gig: { title: string; milestones: { _id?: Types.ObjectId; title: string }[] } | null): string {
    const milestone = payment.milestone && gig?.milestones.find((m) => sameId(m._id, payment.milestone));
    return milestone ? `milestone "${milestone.title}" of "${gig!.title}"` : `"${gig?.title ?? 'your gig'}"`;
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
    return this.markEscrowed(payment, input.paymentId, input.signature);
  }

  /** Simulated mode only: the client confirms the "test checkout" and the payment goes to escrow. */
  async simulateCapture(user: IUser, paymentId: string): Promise<IPayment> {
    if (!this.isSimulated()) throw new HttpError(503, 'Simulated payments are disabled');
    const payment = await Payment.findById(paymentId);
    if (!payment || !sameId(payment.client, user._id)) throw new HttpError(404, 'Payment not found');
    if (payment.status !== PaymentStatus.PENDING) throw new HttpError(409, `Payment is already ${payment.status}`);
    return this.markEscrowed(payment, `sim_pay_${crypto.randomBytes(8).toString('hex')}`);
  }

  /**
   * Moves an escrowed payment to released. Caller-level authorization happens in the controller;
   * `allowDisputed` is for admin dispute resolution only.
   */
  async releasePayment(paymentId: string | Types.ObjectId, options: { allowDisputed?: boolean } = {}): Promise<IPayment> {
    const releasable = options.allowDisputed ? [PaymentStatus.ESCROW, PaymentStatus.DISPUTED] : [PaymentStatus.ESCROW];
    const payment = await Payment.findOneAndUpdate(
      { _id: paymentId, status: { $in: releasable } },
      { $set: { status: PaymentStatus.RELEASED, releasedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!payment) {
      const exists = await Payment.exists({ _id: paymentId });
      throw new HttpError(exists ? 400 : 404, exists ? 'Payment must be in escrow to be released' : 'Payment not found');
    }
    await this.afterRelease(payment);
    return payment;
  }

  /**
   * Bookkeeping once money is released: lifetime earnings/spend, a queued (simulated) payout,
   * and notifications to both parties.
   */
  private async afterRelease(payment: IPayment): Promise<void> {
    await Promise.all([
      FreelancerProfile.updateOne({ user: payment.freelancer }, { $inc: { totalEarnings: payment.freelancerAmount } }),
      ClientProfile.updateOne({ user: payment.client }, { $inc: { totalSpent: payment.amount } }),
      Payment.updateOne({ _id: payment._id }, { $set: { payout: { status: 'queued', queuedAt: new Date() } } }),
    ]);
    const gig = await Gig.findById(payment.gig).select('title milestones');
    const what = this.describe(payment, gig);
    await Promise.all([
      notificationService.create({
        recipient: payment.freelancer.toString(),
        type: NotificationType.PAYMENT_RELEASED,
        title: 'Payment released',
        message: `${formatCurrency(payment.freelancerAmount)} for ${what} was released to you (after the ${env.PLATFORM_FEE_PERCENTAGE}% platform fee). Payout is on its way.`,
        data: { gigId: payment.gig.toString(), paymentId: payment._id.toString() },
        link: paymentLink,
        category: 'payments',
      }),
      notificationService.create({
        recipient: payment.client.toString(),
        type: NotificationType.PAYMENT_RELEASED,
        title: 'Payment released',
        message: `You released ${formatCurrency(payment.amount)} for ${what}.`,
        data: { gigId: payment.gig.toString(), paymentId: payment._id.toString() },
        link: paymentLink,
        category: 'payments',
      }),
    ]);
  }

  /** Refunds through Razorpay (test mode) when money was captured, then marks the payment refunded. */
  async refundPayment(paymentId: string | Types.ObjectId, reason: string, amount?: number): Promise<IPayment> {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new HttpError(404, 'Payment not found');

    if (![PaymentStatus.ESCROW, PaymentStatus.PENDING, PaymentStatus.DISPUTED].includes(payment.status)) {
      throw new HttpError(400, 'Payment cannot be refunded in its current state');
    }

    // Simulated captures ("sim_pay_…") never touched a gateway.
    if (payment.razorpayPaymentId && !payment.razorpayPaymentId.startsWith('sim_')) {
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

    const wasCaptured = payment.status !== PaymentStatus.PENDING;
    payment.status = PaymentStatus.REFUNDED;
    payment.refundedAt = new Date();
    payment.refundReason = reason;
    await payment.save();

    // A refunded milestone can be funded again.
    if (payment.milestone) {
      await Gig.updateOne(
        { _id: payment.gig, milestones: { $elemMatch: { _id: payment.milestone, status: MilestoneStatus.FUNDED } } },
        { $set: { 'milestones.$.status': MilestoneStatus.PENDING } }
      );
    }
    if (wasCaptured) {
      const gig = await Gig.findById(payment.gig).select('title milestones');
      const what = this.describe(payment, gig);
      await Promise.all(
        [payment.client, payment.freelancer].map((recipient) =>
          notificationService.create({
            recipient: recipient.toString(),
            type: NotificationType.PAYMENT_REFUNDED,
            title: 'Payment refunded',
            message: `${formatCurrency(amount ?? payment.amount)} for ${what} was refunded to the client. Reason: ${reason}`,
            data: { gigId: payment.gig.toString(), paymentId: payment._id.toString() },
            link: paymentLink,
            category: 'payments',
          })
        )
      );
    }
    return payment;
  }

  /**
   * Dispute split: refunds `refundAmount` to the client (partial Razorpay refund) and releases
   * the remainder to the freelancer. The payment amount shrinks so fees are recomputed on what was paid out.
   */
  async splitPayment(paymentId: string | Types.ObjectId, refundAmount: number, reason: string): Promise<IPayment> {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new HttpError(404, 'Payment not found');
    if (![PaymentStatus.ESCROW, PaymentStatus.DISPUTED].includes(payment.status)) {
      throw new HttpError(400, 'Only escrowed or disputed payments can be split');
    }
    if (refundAmount <= 0 || refundAmount >= payment.amount) {
      throw new HttpError(400, 'Refund amount must be between 0 and the payment amount');
    }

    if (payment.razorpayPaymentId && !payment.razorpayPaymentId.startsWith('sim_')) {
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
    await this.afterRelease(payment);
    return payment;
  }

  /**
   * Razorpay webhook (raw body + X-Razorpay-Signature, HMAC-SHA256 with RAZORPAY_WEBHOOK_SECRET).
   * Handles payment.captured, payment.failed and refund.processed; every branch is idempotent.
   * Returns false when the signature is invalid.
   */
  async handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<boolean> {
    const secret = getRazorpayKeys()?.webhookSecret;
    if (!secret) throw new HttpError(503, 'Webhook secret not configured');
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!signature || !safeEqualHex(expected, signature)) return false;

    const event = JSON.parse(rawBody.toString('utf8')) as WebhookEvent;
    const entity = event.payload.payment?.entity;

    if (event.event === 'payment.captured' && entity) {
      const payment = await Payment.findOne({ razorpayOrderId: entity.order_id });
      if (payment) await this.markEscrowed(payment, entity.id);
    } else if (event.event === 'payment.failed' && entity) {
      await Payment.updateOne(
        { razorpayOrderId: entity.order_id, status: PaymentStatus.PENDING },
        { $set: { status: PaymentStatus.FAILED, failureReason: entity.error_description ?? 'Payment failed' } }
      );
    } else if (event.event === 'refund.processed' && event.payload.refund) {
      // Refunds we start are already marked; this catches ones issued from the Razorpay dashboard.
      await Payment.updateOne(
        { razorpayPaymentId: event.payload.refund.entity.payment_id, status: { $in: [PaymentStatus.ESCROW, PaymentStatus.DISPUTED] } },
        { $set: { status: PaymentStatus.REFUNDED, refundedAt: new Date(), refundReason: 'Refunded via Razorpay' } }
      );
    }
    return true;
  }

  /**
   * Processes queued payouts. Test mode has no real payout rail (RazorpayX/Route need KYC), so a
   * payout is *simulated*: it gets a reference and is marked processed. Returns how many were processed.
   */
  async processPayouts(limit = 100): Promise<number> {
    const queued = await Payment.find({ status: PaymentStatus.RELEASED, 'payout.status': 'queued' }).limit(limit);
    for (const payment of queued) {
      const reference = `sim_payout_${crypto.randomBytes(6).toString('hex')}`;
      const done = await Payment.updateOne(
        { _id: payment._id, 'payout.status': 'queued' },
        { $set: { 'payout.status': 'processed', 'payout.processedAt': new Date(), 'payout.reference': reference } }
      );
      if (!done.modifiedCount) continue;
      await notificationService.create({
        recipient: payment.freelancer.toString(),
        type: NotificationType.PAYOUT_PROCESSED,
        title: 'Payout sent',
        message: `${formatCurrency(payment.freelancerAmount)} was paid out to your account (ref ${reference}).`,
        data: { paymentId: payment._id.toString(), reference },
        link: paymentLink,
        category: 'payments',
      });
    }
    return queued.length;
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

  /**
   * Platform fees earned: released payments only (money in escrow can still be refunded), dated by
   * when they were released.
   */
  async calculatePlatformRevenue(
    startDate?: Date,
    endDate?: Date
  ): Promise<{ totalRevenue: number; totalTransactions: number }> {
    const match: Record<string, unknown> = { status: PaymentStatus.RELEASED };

    if (startDate || endDate) {
      match.releasedAt = {};
      if (startDate) (match.releasedAt as Record<string, Date>).$gte = startDate;
      if (endDate) (match.releasedAt as Record<string, Date>).$lte = endDate;
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

}

export default new PaymentService();
