import { Request, Response, NextFunction } from 'express';
import Payment from '../models/Payment';
import Gig from '../models/Gig';
import { getRazorpayKeys } from '../config/razorpay';
import { AuthRequest, MilestoneStatus, PaymentStatus, UserRole } from '../types';
import { buildPaginationResponse, parsePaginationParams } from '../utils/helpers';
import paymentService from '../services/paymentService';
import { env } from '../config/env';

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

/** GET /payments — the caller's transaction history (admins: everything), filterable by status and gig. */
export const getPayments = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
    const filter: Record<string, unknown> =
      user.role === UserRole.ADMIN ? {} : { $or: [{ client: user._id }, { freelancer: user._id }] };
    if (typeof req.query.status === 'string' && (Object.values(PaymentStatus) as string[]).includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (typeof req.query.gig === 'string') filter.gig = req.query.gig;

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate('gig', 'title')
        .populate('client', 'firstName lastName avatar')
        .populate('freelancer', 'firstName lastName avatar')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Payment.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, message: 'Payments retrieved', data: payments, pagination: buildPaginationResponse(total, page, limit) });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /payments/config — the public Razorpay key id for Checkout. `simulated` means checkout is
 * confirmed in-app without a gateway (SIMULATE_PAYMENTS, development only).
 */
export const getPaymentConfig = (_req: AuthRequest, res: Response): void => {
  const keys = getRazorpayKeys();
  const simulated = paymentService.isSimulated();
  res.status(200).json({
    success: true,
    message: 'Payment configuration',
    data: { enabled: Boolean(keys) || simulated, simulated, keyId: keys?.keyId ?? null, currency: 'INR', autoReleaseDays: env.AUTO_RELEASE_DAYS },
  });
};

/** POST /payments/:id/simulate — simulated mode only: confirm the test checkout (pending → escrow). */
export const simulatePayment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payment = await paymentService.simulateCapture(req.user!, String(req.params.id));
    res.status(200).json({ success: true, message: 'Simulated payment captured; funds held in escrow', data: payment });
  } catch (error) {
    next(error);
  }
};

/** POST /payments/webhook — Razorpay events (raw body; mounted before express.json in app.ts). */
export const razorpayWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!Buffer.isBuffer(req.body)) {
      res.status(400).json({ success: false, message: 'Expected a raw JSON body' });
      return;
    }
    const ok = await paymentService.handleWebhook(req.body, req.header('x-razorpay-signature'));
    if (!ok) {
      res.status(400).json({ success: false, message: 'Invalid webhook signature' });
      return;
    }
    res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    next(error);
  }
};

const csvCell = (value: unknown): string => {
  const text = value === undefined || value === null ? '' : value instanceof Date ? value.toISOString() : String(value);
  // Quote, and neutralise spreadsheet formulas (=, +, -, @) so exported text can't execute.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** GET /payments/export?status= — the caller's transactions as CSV (admins: all). */
export const exportPayments = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const filter: Record<string, unknown> = user.role === UserRole.ADMIN ? {} : { $or: [{ client: user._id }, { freelancer: user._id }] };
    if (typeof req.query.status === 'string' && (Object.values(PaymentStatus) as string[]).includes(req.query.status)) {
      filter.status = req.query.status;
    }
    const payments = await Payment.find(filter)
      .populate<{ gig: { title: string } | null }>('gig', 'title')
      .populate<{ client: { firstName: string; lastName: string } | null }>('client', 'firstName lastName')
      .populate<{ freelancer: { firstName: string; lastName: string } | null }>('freelancer', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const header = ['Date', 'Gig', 'Client', 'Freelancer', 'Status', 'Amount (INR)', 'Platform fee', 'Freelancer amount', 'Refunded', 'Payout', 'Payout reference', 'Order id', 'Payment id'];
    const rows = payments.map((p) => [
      p.createdAt,
      p.gig?.title,
      p.client && `${p.client.firstName} ${p.client.lastName}`,
      p.freelancer && `${p.freelancer.firstName} ${p.freelancer.lastName}`,
      p.status,
      p.amount,
      p.platformFee,
      p.freelancerAmount,
      p.refundedAmount ?? (p.status === PaymentStatus.REFUNDED ? p.amount : ''),
      p.payout?.status,
      p.payout?.reference,
      p.razorpayOrderId,
      p.razorpayPaymentId,
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="skillsphere-transactions-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.status(200).send(`\uFEFF${csv}`); // BOM so Excel reads ₹ and names as UTF-8
  } catch (error) {
    next(error);
  }
};

/** GET /payments/summary — totals by status for the caller (client: amounts paid; freelancer: earnings). */
export const getPaymentSummary = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const role = user.role === UserRole.CLIENT ? 'client' : 'freelancer';
    const byStatus = await paymentService.getPaymentStats(user._id.toString(), role);
    const total = (status: PaymentStatus) => byStatus[status]?.total ?? 0;

    const [fees] = await Payment.aggregate<{ fees: number }>([
      { $match: { [role]: user._id, status: PaymentStatus.RELEASED } },
      { $group: { _id: null, fees: { $sum: '$platformFee' } } },
    ]);

    res.status(200).json({
      success: true,
      message: 'Payment summary',
      data: {
        inEscrow: total(PaymentStatus.ESCROW) + total(PaymentStatus.DISPUTED),
        released: total(PaymentStatus.RELEASED),
        refunded: total(PaymentStatus.REFUNDED),
        pending: total(PaymentStatus.PENDING),
        fees: fees?.fees ?? 0,
        byStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /payments/:id/refund — the client gets escrowed money back before work on that milestone
 * has started. Refunds after work starts go through a dispute.
 */
export const refundPayment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment || payment.client.toString() !== req.user!._id.toString()) {
      res.status(404).json({ success: false, message: 'Payment not found' });
      return;
    }
    if (payment.status !== PaymentStatus.ESCROW) {
      res.status(409).json({ success: false, message: 'Only payments held in escrow can be refunded' });
      return;
    }

    if (payment.milestone) {
      const gig = await Gig.findById(payment.gig).select('milestones');
      const milestone = gig?.milestones.find((m) => m._id?.toString() === payment.milestone!.toString());
      if (milestone && ![MilestoneStatus.PENDING, MilestoneStatus.FUNDED].includes(milestone.status)) {
        res.status(409).json({ success: false, message: 'Work on this milestone has started; open a dispute instead' });
        return;
      }
    }

    const refunded = await paymentService.refundPayment(payment._id.toString(), req.body.reason || 'Refunded by client before work started');
    res.status(200).json({ success: true, message: 'Payment refunded', data: refunded });
  } catch (error) {
    next(error);
  }
};
