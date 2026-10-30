import crypto from 'crypto';
import request from 'supertest';
import app from '../src/app';
import Gig from '../src/models/Gig';
import Payment from '../src/models/Payment';
import Proposal from '../src/models/Proposal';
import { GigStatus, MilestoneStatus, PaymentStatus, ProposalStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

let orderSeq = 0;
const mockRazorpay = {
  orders: { create: jest.fn(async (o: { amount: number }) => ({ id: `order_${++orderSeq}`, ...o })) },
  payments: {
    refund: jest.fn(async () => ({ id: 'rfnd_1' })),
    fetch: jest.fn(async (id: string) => ({ id, status: 'captured' })),
    capture: jest.fn(async (id: string) => ({ id, status: 'captured' })),
  },
};
jest.mock('../src/config/razorpay', () => ({
  getRazorpay: () => mockRazorpay,
  getRazorpayKeys: () => ({ keyId: 'rzp_test_key', keySecret: 'test_key_secret' }),
}));

beforeEach(() => jest.clearAllMocks());

const sign = (orderId: string, paymentId: string) => crypto.createHmac('sha256', 'test_key_secret').update(`${orderId}|${paymentId}`).digest('hex');

/** An in-progress gig with one ₹10,000 milestone and an accepted proposal at that price. */
const setup = async () => {
  const client = await createUser(UserRole.CLIENT);
  const freelancer = await createUser(UserRole.FREELANCER);
  const gig = await createGig(client.user._id, {
    status: GigStatus.IN_PROGRESS,
    selectedFreelancer: freelancer.user._id,
    milestones: [{ title: 'Design', description: 'Mockups', amount: 10000, dueDate: new Date(Date.now() + 7 * 86_400_000) }],
  });
  await Proposal.create({ gig: gig._id, freelancer: freelancer.user._id, coverLetter: 'Hi', proposedAmount: 10000, estimatedDuration: '1 week', status: ProposalStatus.ACCEPTED });
  const milestoneId = gig.milestones[0]._id!.toString();
  const order = () => request(app).post('/api/v1/payments/orders').set(client.auth).send({ gigId: gig.id, milestoneId });
  const verify = (orderId: string, paymentId: string) =>
    request(app).post('/api/v1/payments/verify').set(client.auth).send({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sign(orderId, paymentId) });
  return { client, gig, milestoneId, order, verify };
};

describe('a milestone is funded once (P1-4)', () => {
  it('concurrent "Fund" clicks get the same single order', async () => {
    const { gig, order } = await setup();
    const results = await Promise.all([order(), order(), order()]);
    for (const res of results) expect(res.status).toBe(201);
    expect(new Set(results.map((r) => r.body.data.order.id)).size).toBe(1);
    expect(await Payment.countDocuments({ gig: gig._id })).toBe(1);
  });

  it('an escrowed milestone cannot be ordered again', async () => {
    const { order, verify } = await setup();
    const first = await order().expect(201);
    await verify(first.body.data.order.id, 'pay_1').expect(200);
    const again = await order();
    expect(again.status).toBe(409);
    expect(again.body.message).toMatch(/already funded/);
  });

  it('the database refuses a second live payment for the same milestone', async () => {
    const { client, gig, milestoneId, order } = await setup();
    await order().expect(201);
    await expect(
      Payment.create({ gig: gig._id, milestone: milestoneId, client: client.user._id, freelancer: gig.selectedFreelancer, amount: 10000, status: PaymentStatus.ESCROW })
    ).rejects.toMatchObject({ code: 11000 });
    // Refunded/failed/cancelled history doesn't count.
    await Payment.create({ gig: gig._id, milestone: milestoneId, client: client.user._id, freelancer: gig.selectedFreelancer, amount: 10000, status: PaymentStatus.REFUNDED });
  });

  it('cancelling the gig cancels its unpaid orders, and a capture that still arrives is refunded', async () => {
    const { client, gig, order, verify } = await setup();
    const pending = await order().expect(201);
    await request(app).put(`/api/v1/gigs/${gig.id}/cancel`).set(client.auth).expect(200);
    expect((await Payment.findById(pending.body.data.payment._id))!.status).toBe(PaymentStatus.CANCELLED);

    // The client had Checkout open in another tab and paid anyway.
    const late = await verify(pending.body.data.order.id, 'pay_late').expect(200);
    expect(late.body.data.status).toBe(PaymentStatus.REFUNDED);
    expect(mockRazorpay.payments.refund).toHaveBeenCalledWith('pay_late', expect.objectContaining({ amount: 1_000_000 }));
    expect((await Gig.findById(gig._id))!.milestones[0].status).toBe(MilestoneStatus.PENDING);

    // Verify + webhook for the same capture refund only once.
    await verify(pending.body.data.order.id, 'pay_late').expect(200);
    expect(mockRazorpay.payments.refund).toHaveBeenCalledTimes(1);
  });

  it('a capture for a milestone that another payment already funded is refunded', async () => {
    const { client, gig, milestoneId, verify } = await setup();
    // A stale order (e.g. superseded) and a live escrow for the same milestone.
    const stale = await Payment.create({ gig: gig._id, milestone: milestoneId, client: client.user._id, freelancer: gig.selectedFreelancer, amount: 10000, status: PaymentStatus.CANCELLED, razorpayOrderId: 'order_stale' });
    await Payment.create({ gig: gig._id, milestone: milestoneId, client: client.user._id, freelancer: gig.selectedFreelancer, amount: 10000, status: PaymentStatus.ESCROW });

    const res = await verify('order_stale', 'pay_dupe').expect(200);
    expect(res.body.data.status).toBe(PaymentStatus.REFUNDED);
    expect((await Payment.findById(stale._id))!.refundReason).toMatch(/cancelled/);
    expect(await Payment.countDocuments({ gig: gig._id, status: PaymentStatus.ESCROW })).toBe(1);
  });
});
