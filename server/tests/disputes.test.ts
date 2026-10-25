import request from 'supertest';
import app from '../src/app';
import AdminLog from '../src/models/AdminLog';
import Dispute from '../src/models/Dispute';
import Notification from '../src/models/Notification';
import Payment from '../src/models/Payment';
import { AdminAction, GigStatus, NotificationType, PaymentStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

const mockRazorpay = { payments: { refund: jest.fn(async () => ({ id: 'rfnd_1' })) }, orders: { create: jest.fn() } };
jest.mock('../src/config/razorpay', () => ({
  getRazorpay: () => mockRazorpay,
  getRazorpayKeys: () => ({ keyId: 'rzp_test_key', keySecret: 'test_key_secret' }),
}));

beforeEach(() => jest.clearAllMocks());

const setup = async () => {
  const client = await createUser(UserRole.CLIENT);
  const freelancer = await createUser(UserRole.FREELANCER);
  const outsider = await createUser(UserRole.CLIENT);
  const admin = await createUser(UserRole.ADMIN);
  const gig = await createGig(client.user._id, { status: GigStatus.IN_PROGRESS, selectedFreelancer: freelancer.user._id });
  const payment = await Payment.create({
    gig: gig._id,
    client: client.user._id,
    freelancer: freelancer.user._id,
    amount: 10000,
    status: PaymentStatus.ESCROW,
    razorpayPaymentId: 'pay_test_1',
  });
  return { client, freelancer, outsider, admin, gig, payment };
};

const open = (auth: Record<string, string>, body: Record<string, unknown>) =>
  request(app).post('/api/v1/disputes').set(auth).send({ title: 'Work not delivered', description: 'Details…', ...body });

const resolve = (auth: Record<string, string>, id: string, body: Record<string, unknown>) =>
  request(app).put(`/api/v1/disputes/${id}/resolve`).set(auth).send({ resolution: 'Decided', ...body });

describe('POST /api/v1/disputes (1.14)', () => {
  it('derives `against` from the gig and freezes the payment', async () => {
    const { client, freelancer, outsider, gig, payment } = await setup();
    const res = await open(client.auth, { gigId: gig.id, paymentId: payment.id, againstId: outsider.user.id });
    expect(res.status).toBe(201);
    expect(res.body.data.against).toBe(freelancer.user.id);
    expect((await Payment.findById(payment._id))!.status).toBe(PaymentStatus.DISPUTED);
    expect(await Notification.countDocuments({ recipient: freelancer.user._id })).toBe(1);
  });

  it('rejects users who are not gig parties', async () => {
    const { outsider, gig, payment } = await setup();
    const res = await open(outsider.auth, { gigId: gig.id, paymentId: payment.id });
    expect(res.status).toBe(403);
    expect((await Payment.findById(payment._id))!.status).toBe(PaymentStatus.ESCROW);
  });

  it('rejects a payment from another gig', async () => {
    const { client, freelancer, gig } = await setup();
    const otherGig = await createGig(client.user._id, { status: GigStatus.IN_PROGRESS, selectedFreelancer: freelancer.user._id });
    const foreign = await Payment.create({
      gig: otherGig._id, client: client.user._id, freelancer: freelancer.user._id, amount: 500, status: PaymentStatus.ESCROW,
    });
    const res = await open(client.auth, { gigId: gig.id, paymentId: foreign.id });
    expect(res.status).toBe(400);
    expect((await Payment.findById(foreign._id))!.status).toBe(PaymentStatus.ESCROW);
  });

  it('rejects a second open dispute on the same payment', async () => {
    const { client, freelancer, gig, payment } = await setup();
    await open(client.auth, { gigId: gig.id, paymentId: payment.id });
    await Payment.updateOne({ _id: payment._id }, { status: PaymentStatus.ESCROW });
    const res = await open(freelancer.auth, { gigId: gig.id, paymentId: payment.id });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/v1/disputes', () => {
  it('admins see all disputes with a status filter; parties see only theirs', async () => {
    const { client, outsider, admin, gig, payment } = await setup();
    await open(client.auth, { gigId: gig.id, paymentId: payment.id });

    const asAdmin = await request(app).get('/api/v1/disputes').query({ status: 'open' }).set(admin.auth);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.data).toHaveLength(1);
    expect(asAdmin.body.pagination.total).toBe(1);

    const asOutsider = await request(app).get('/api/v1/disputes').set(outsider.auth);
    expect(asOutsider.body.data).toHaveLength(0);
  });
});

describe('PUT /api/v1/disputes/:id/resolve', () => {
  const openDispute = async () => {
    const ctx = await setup();
    const res = await open(ctx.client.auth, { gigId: ctx.gig.id, paymentId: ctx.payment.id });
    return { ...ctx, disputeId: res.body.data._id as string };
  };

  it('refund: calls the Razorpay refund, logs and notifies both parties', async () => {
    const { client, freelancer, admin, payment, disputeId } = await openDispute();
    const res = await resolve(admin.auth, disputeId, { paymentAction: 'refund' });
    expect(res.status).toBe(200);
    expect(mockRazorpay.payments.refund).toHaveBeenCalledWith('pay_test_1', expect.objectContaining({ amount: 1000000 }));
    expect((await Payment.findById(payment._id))!.status).toBe(PaymentStatus.REFUNDED);
    expect(await AdminLog.countDocuments({ action: AdminAction.DISPUTE_RESOLVE })).toBe(1);
    expect(await Notification.countDocuments({ recipient: client.user._id, type: NotificationType.DISPUTE_RESOLVED })).toBe(1);
    expect(await Notification.countDocuments({ recipient: freelancer.user._id, type: NotificationType.DISPUTE_RESOLVED })).toBe(1);
  });

  it('release: pays the freelancer', async () => {
    const { admin, payment, disputeId } = await openDispute();
    const res = await resolve(admin.auth, disputeId, { paymentAction: 'release' });
    expect(res.status).toBe(200);
    expect((await Payment.findById(payment._id))!.status).toBe(PaymentStatus.RELEASED);
    expect(mockRazorpay.payments.refund).not.toHaveBeenCalled();
  });

  it('split: partially refunds and releases the remainder', async () => {
    const { admin, payment, disputeId } = await openDispute();
    const res = await resolve(admin.auth, disputeId, { paymentAction: 'split', refundAmount: 4000 });
    expect(res.status).toBe(200);
    expect(mockRazorpay.payments.refund).toHaveBeenCalledWith('pay_test_1', expect.objectContaining({ amount: 400000 }));
    const updated = await Payment.findById(payment._id);
    expect(updated!.status).toBe(PaymentStatus.RELEASED);
    expect(updated!.amount).toBe(6000);
    expect(updated!.refundedAmount).toBe(4000);
    expect(updated!.freelancerAmount).toBe(5400);
  });

  it('split requires a refundAmount', async () => {
    const { admin, disputeId } = await openDispute();
    expect((await resolve(admin.auth, disputeId, { paymentAction: 'split' })).status).toBe(400);
  });

  it('only admins can resolve, and only once', async () => {
    const { client, admin, disputeId } = await openDispute();
    expect((await resolve(client.auth, disputeId, {})).status).toBe(403);
    expect((await resolve(admin.auth, disputeId, {})).status).toBe(200);
    expect((await resolve(admin.auth, disputeId, {})).status).toBe(409);
    expect((await Dispute.findById(disputeId))!.status).toBe('resolved');
  });
});
