import crypto from 'crypto';
import ClientProfile from '../src/models/ClientProfile';
import FreelancerProfile from '../src/models/FreelancerProfile';
import Gig from '../src/models/Gig';
import Payment from '../src/models/Payment';
import paymentService, { safeEqualHex } from '../src/services/paymentService';
import { env } from '../src/config/env';
import { GigStatus, MilestoneStatus, PaymentStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

const KEY_SECRET = 'unit_test_key_secret';
const WEBHOOK_SECRET = 'unit_test_webhook_secret';
const mockRazorpay = {
  payments: { refund: jest.fn(async () => ({ id: 'rfnd_1' })), fetch: jest.fn(async (id: string) => ({ id, status: 'captured' })), capture: jest.fn(async (id: string) => ({ id, status: 'captured' })) },
  orders: { create: jest.fn() },
};
jest.mock('../src/config/razorpay', () => ({
  getRazorpay: () => mockRazorpay,
  getRazorpayKeys: () => ({ keyId: 'rzp_test_key', keySecret: 'unit_test_key_secret', webhookSecret: 'unit_test_webhook_secret' }),
}));

beforeEach(() => jest.clearAllMocks());

const hmac = (secret: string, data: string | Buffer) => crypto.createHmac('sha256', secret).update(data).digest('hex');

/** An escrowed ₹10,000 payment for the first milestone of an in-progress gig. */
const escrowed = async (overrides: Record<string, unknown> = {}) => {
  const client = await createUser(UserRole.CLIENT);
  const freelancer = await createUser(UserRole.FREELANCER);
  const gig = await createGig(client.user._id, {
    status: GigStatus.IN_PROGRESS,
    selectedFreelancer: freelancer.user._id,
    milestones: [{ title: 'Design', description: 'Mockups', amount: 10000, dueDate: new Date(Date.now() + 7 * 86_400_000), status: MilestoneStatus.FUNDED }],
  });
  const payment = await Payment.create({
    gig: gig._id,
    milestone: gig.milestones[0]._id,
    client: client.user._id,
    freelancer: freelancer.user._id,
    amount: 10000,
    status: PaymentStatus.ESCROW,
    razorpayPaymentId: 'pay_real_1',
    ...overrides,
  });
  return { client, freelancer, gig, payment };
};

describe('paymentService signatures', () => {
  it('safeEqualHex compares digests of equal length only', () => {
    expect(safeEqualHex('abc123', 'abc123')).toBe(true);
    expect(safeEqualHex('abc123', 'abc124')).toBe(false);
    expect(safeEqualHex('abc123', 'abc12')).toBe(false);
  });

  it('verifies the Checkout signature over "orderId|paymentId"', () => {
    const good = hmac(KEY_SECRET, 'order_1|pay_1');
    expect(paymentService.verifyPaymentSignature('order_1', 'pay_1', good)).toBe(true);
    expect(paymentService.verifyPaymentSignature('order_1', 'pay_2', good)).toBe(false);
  });

  it('rejects a webhook with a bad signature without touching payments', async () => {
    const { payment } = await escrowed({ status: PaymentStatus.PENDING, razorpayOrderId: 'order_w', razorpayPaymentId: undefined });
    const body = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_w', order_id: 'order_w' } } } }));
    expect(await paymentService.handleWebhook(body, 'deadbeef')).toBe(false);
    expect((await Payment.findById(payment._id))!.status).toBe(PaymentStatus.PENDING);

    expect(await paymentService.handleWebhook(body, hmac(WEBHOOK_SECRET, body))).toBe(true);
    expect((await Payment.findById(payment._id))!.status).toBe(PaymentStatus.ESCROW);
  });
});

describe('paymentService money movements', () => {
  it('computes the platform fee and freelancer share from the amount', async () => {
    const { payment } = await escrowed();
    const fee = Math.round(10000 * env.PLATFORM_FEE_PERCENTAGE) / 100;
    expect(payment.platformFee).toBe(fee);
    expect(payment.freelancerAmount).toBe(10000 - fee);
  });

  it('release: credits earnings/spend, queues a payout, and cannot run twice', async () => {
    const { client, freelancer, payment } = await escrowed();
    const released = await paymentService.releasePayment(payment._id);
    expect(released.status).toBe(PaymentStatus.RELEASED);

    expect((await FreelancerProfile.findOne({ user: freelancer.user._id }))!.totalEarnings).toBe(payment.freelancerAmount);
    expect((await ClientProfile.findOne({ user: client.user._id }))!.totalSpent).toBe(10000);
    expect((await Payment.findById(payment._id))!.payout?.status).toBe('queued');

    await expect(paymentService.releasePayment(payment._id)).rejects.toMatchObject({ statusCode: 400 });
    expect((await FreelancerProfile.findOne({ user: freelancer.user._id }))!.totalEarnings).toBe(payment.freelancerAmount);
  });

  it('release refuses disputed payments unless the admin resolution allows it', async () => {
    const { payment } = await escrowed({ status: PaymentStatus.DISPUTED });
    await expect(paymentService.releasePayment(payment._id)).rejects.toMatchObject({ statusCode: 400 });
    await expect(paymentService.releasePayment(payment._id, { allowDisputed: true })).resolves.toMatchObject({ status: PaymentStatus.RELEASED });
  });

  it('refund: calls Razorpay in paise and reopens the milestone for funding', async () => {
    const { gig, payment } = await escrowed();
    await paymentService.refundPayment(payment._id, 'Client cancelled');

    expect(mockRazorpay.payments.refund).toHaveBeenCalledWith('pay_real_1', { amount: 1_000_000, notes: { reason: 'Client cancelled' } });
    expect((await Payment.findById(payment._id))!.status).toBe(PaymentStatus.REFUNDED);
    expect((await Gig.findById(gig._id))!.milestones[0].status).toBe(MilestoneStatus.PENDING);
    await expect(paymentService.refundPayment(payment._id, 'again')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refund of a simulated capture skips the gateway; gateway failures surface as 502', async () => {
    const sim = await escrowed({ razorpayPaymentId: 'sim_pay_1' });
    await paymentService.refundPayment(sim.payment._id, 'Demo');
    expect(mockRazorpay.payments.refund).not.toHaveBeenCalled();

    const real = await escrowed();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRazorpay.payments.refund.mockRejectedValueOnce(new Error('gateway down'));
    await expect(paymentService.refundPayment(real.payment._id, 'x')).rejects.toMatchObject({ statusCode: 502 });
    expect((await Payment.findById(real.payment._id))!.status).toBe(PaymentStatus.ESCROW);
  });

  it('split: refunds part, releases the rest and recomputes fees on what was paid out', async () => {
    const { freelancer, payment } = await escrowed({ status: PaymentStatus.DISPUTED });
    await expect(paymentService.splitPayment(payment._id, 10000, 'x')).rejects.toMatchObject({ statusCode: 400 });
    await expect(paymentService.splitPayment(payment._id, 0, 'x')).rejects.toMatchObject({ statusCode: 400 });

    const split = await paymentService.splitPayment(payment._id, 4000, 'Half delivered');
    expect(mockRazorpay.payments.refund).toHaveBeenCalledWith('pay_real_1', { amount: 400_000, notes: { reason: 'Half delivered' } });
    expect(split).toMatchObject({ status: PaymentStatus.RELEASED, amount: 6000, refundedAmount: 4000 });
    expect(split.platformFee).toBe(Math.round(6000 * env.PLATFORM_FEE_PERCENTAGE) / 100);
    expect((await FreelancerProfile.findOne({ user: freelancer.user._id }))!.totalEarnings).toBe(split.freelancerAmount);
  });

  it('processPayouts marks queued payouts processed exactly once', async () => {
    const { payment } = await escrowed();
    await paymentService.releasePayment(payment._id);

    expect(await paymentService.processPayouts()).toBe(1);
    const paid = await Payment.findById(payment._id);
    expect(paid!.payout).toMatchObject({ status: 'processed' });
    expect(paid!.payout!.reference).toMatch(/^sim_payout_/);
    expect(await paymentService.processPayouts()).toBe(0);
  });

  it('processPayouts reports what it processed, not what it found (P3-3)', async () => {
    const { payment } = await escrowed();
    await paymentService.releasePayment(payment._id);
    // Two overlapping runs see the same queued payout; only one may pay it and count it.
    const counts = await Promise.all([paymentService.processPayouts(), paymentService.processPayouts()]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(1);
  });

  it('refunding a never-captured pending payment cancels it instead (P2-2)', async () => {
    const { payment } = await escrowed();
    await Payment.updateOne({ _id: payment._id }, { $set: { status: PaymentStatus.PENDING }, $unset: { razorpayPaymentId: 1 } });
    const cancelled = await paymentService.refundPayment(payment._id, 'Client changed their mind');
    expect(cancelled.status).toBe(PaymentStatus.CANCELLED);
    expect(cancelled.refundedAt).toBeUndefined();
    expect(cancelled.failureReason).toBe('Client changed their mind');
    expect(mockRazorpay.payments.refund).not.toHaveBeenCalled();
    expect(await Payment.countDocuments({ status: PaymentStatus.REFUNDED })).toBe(0);
  });
});
