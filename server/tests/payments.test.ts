import crypto from 'crypto';
import request from 'supertest';
import app from '../src/app';
import Gig from '../src/models/Gig';
import Payment from '../src/models/Payment';
import Proposal from '../src/models/Proposal';
import { GigStatus, PaymentStatus, ProposalStatus, UserRole } from '../src/types';
import { createUser } from './helpers';

// Razorpay is mocked: no network, and tests can toggle "configured".
const mockState = { configured: true, orderSeq: 0 };
const mockRazorpay = {
  orders: {
    create: jest.fn(async (o: { amount: number; currency: string }) => ({ id: `order_${++mockState.orderSeq}`, ...o })),
  },
  payments: { refund: jest.fn(async () => ({ id: 'rfnd_1' })) },
};
jest.mock('../src/config/razorpay', () => ({
  getRazorpay: () => (mockState.configured ? mockRazorpay : null),
  getRazorpayKeys: () => (mockState.configured ? { keyId: 'rzp_test_key', keySecret: 'test_key_secret' } : null),
}));

const sign = (orderId: string, paymentId: string) =>
  crypto.createHmac('sha256', 'test_key_secret').update(`${orderId}|${paymentId}`).digest('hex');

const setup = async () => {
  const client = await createUser(UserRole.CLIENT);
  const otherClient = await createUser(UserRole.CLIENT);
  const freelancer = await createUser(UserRole.FREELANCER);
  const otherFreelancer = await createUser(UserRole.FREELANCER);

  const gig = await Gig.create({
    client: client.user._id,
    title: 'Build a React dashboard',
    description: 'Charts and tables',
    category: 'Web Development',
    skills: ['React'],
    budgetType: 'fixed',
    budgetMin: 5000,
    budgetMax: 10000,
    duration: '2 weeks',
    experienceLevel: 'intermediate',
    status: GigStatus.IN_PROGRESS,
    selectedFreelancer: freelancer.user._id,
    milestones: [
      { title: 'Design', description: 'Wireframes', amount: 4000, dueDate: new Date(Date.now() + 86400000) },
      { title: 'Build', description: 'Implementation', amount: 5000, dueDate: new Date(Date.now() + 2 * 86400000) },
    ],
  });
  await Proposal.create({
    gig: gig._id,
    freelancer: freelancer.user._id,
    coverLetter: 'I can do it',
    proposedAmount: 9000,
    estimatedDuration: '2 weeks',
    status: ProposalStatus.ACCEPTED,
  });
  const milestoneId = gig.milestones[0]._id!.toString();
  return { client, otherClient, freelancer, otherFreelancer, gig, milestoneId };
};

const order = (auth: Record<string, string>, body: Record<string, unknown>) =>
  request(app).post('/api/v1/payments/orders').set(auth).send(body);

beforeEach(() => {
  mockState.configured = true;
  jest.clearAllMocks();
});

describe('POST /api/v1/payments/orders', () => {
  it('returns 503 when Razorpay is not configured (1.4)', async () => {
    const { client, gig, milestoneId } = await setup();
    mockState.configured = false;
    const res = await order(client.auth, { gigId: gig.id, milestoneId });
    expect(res.status).toBe(503);
    expect(res.body.message).toBe('Payments not configured');
  });

  it('creates an order for the milestone amount and the hired freelancer', async () => {
    const { client, freelancer, gig, milestoneId } = await setup();
    const res = await order(client.auth, { gigId: gig.id, milestoneId });
    expect(res.status).toBe(201);
    expect(res.body.data.payment.amount).toBe(4000);
    expect(res.body.data.payment.platformFee).toBe(400);
    expect(res.body.data.payment.freelancer).toBe(freelancer.user.id);
    expect(res.body.data.order.amount).toBe(400000);
    expect(res.body.data.keyId).toBe('rzp_test_key');
  });

  it('reuses the pending order when checkout is reopened', async () => {
    const { client, gig, milestoneId } = await setup();
    const first = await order(client.auth, { gigId: gig.id, milestoneId });
    const second = await order(client.auth, { gigId: gig.id, milestoneId });
    expect(second.status).toBe(201);
    expect(second.body.data.order.id).toBe(first.body.data.order.id);
    expect(await Payment.countDocuments()).toBe(1);
  });

  it('rejects a client who does not own the gig (C5)', async () => {
    const { otherClient, gig, milestoneId } = await setup();
    const res = await order(otherClient.auth, { gigId: gig.id, milestoneId });
    expect(res.status).toBe(403);
    expect(mockRazorpay.orders.create).not.toHaveBeenCalled();
  });

  it('rejects freelancers', async () => {
    const { freelancer, gig, milestoneId } = await setup();
    const res = await order(freelancer.auth, { gigId: gig.id, milestoneId });
    expect(res.status).toBe(403);
  });

  it('rejects a freelancerId that is not the hired freelancer', async () => {
    const { client, otherFreelancer, gig, milestoneId } = await setup();
    const res = await order(client.auth, { gigId: gig.id, milestoneId, freelancerId: otherFreelancer.user.id });
    expect(res.status).toBe(400);
  });

  it('rejects an amount different from the milestone amount', async () => {
    const { client, gig, milestoneId } = await setup();
    const res = await order(client.auth, { gigId: gig.id, milestoneId, amount: 1 });
    expect(res.status).toBe(400);
  });

  it('rejects funding a milestone that is already in escrow', async () => {
    const { client, freelancer, gig, milestoneId } = await setup();
    await Payment.create({
      gig: gig._id,
      milestone: milestoneId,
      client: client.user._id,
      freelancer: freelancer.user._id,
      amount: 4000,
      status: PaymentStatus.ESCROW,
    });
    const res = await order(client.auth, { gigId: gig.id, milestoneId });
    expect(res.status).toBe(409);
  });

  it('allows funding again after the earlier payment was refunded', async () => {
    const { client, freelancer, gig, milestoneId } = await setup();
    await Payment.create({
      gig: gig._id,
      milestone: milestoneId,
      client: client.user._id,
      freelancer: freelancer.user._id,
      amount: 4000,
      status: PaymentStatus.REFUNDED,
    });
    const res = await order(client.auth, { gigId: gig.id, milestoneId });
    expect(res.status).toBe(201);
  });

  it('rejects a free-form amount above the accepted proposal', async () => {
    const { client, gig } = await setup();
    const res = await order(client.auth, { gigId: gig.id, amount: 9001 });
    expect(res.status).toBe(400);
  });

  it('rejects funding before a freelancer is hired', async () => {
    const { client, gig, milestoneId } = await setup();
    await Gig.updateOne({ _id: gig._id }, { $unset: { selectedFreelancer: 1 } });
    const res = await order(client.auth, { gigId: gig.id, milestoneId });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/v1/payments/verify', () => {
  const createOrder = async () => {
    const ctx = await setup();
    const res = await order(ctx.client.auth, { gigId: ctx.gig.id, milestoneId: ctx.milestoneId });
    return { ...ctx, orderId: res.body.data.order.id as string };
  };

  const verify = (auth: Record<string, string>, orderId: string, signature: string) =>
    request(app).post('/api/v1/payments/verify').set(auth).send({
      razorpay_order_id: orderId,
      razorpay_payment_id: 'pay_1',
      razorpay_signature: signature,
    });

  it('moves the payment into escrow with a valid signature', async () => {
    const { client, orderId } = await createOrder();
    const res = await verify(client.auth, orderId, sign(orderId, 'pay_1'));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(PaymentStatus.ESCROW);
  });

  it('rejects an invalid signature', async () => {
    const { client, orderId } = await createOrder();
    const res = await verify(client.auth, orderId, 'deadbeef');
    expect(res.status).toBe(400);
    expect((await Payment.findOne({ razorpayOrderId: orderId }))!.status).toBe(PaymentStatus.PENDING);
  });

  it('rejects verifying a payment that belongs to another client (C5)', async () => {
    const { otherClient, orderId } = await createOrder();
    const res = await verify(otherClient.auth, orderId, sign(orderId, 'pay_1'));
    expect(res.status).toBe(403);
  });
});
