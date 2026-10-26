import crypto from 'crypto';
import request from 'supertest';
import app from '../src/app';
import { env, features } from '../src/config/env';
import ClientProfile from '../src/models/ClientProfile';
import FreelancerProfile from '../src/models/FreelancerProfile';
import Gig from '../src/models/Gig';
import Notification from '../src/models/Notification';
import Payment from '../src/models/Payment';
import paymentService from '../src/services/paymentService';
import projectService from '../src/services/projectService';
import { GigStatus, MilestoneStatus, NotificationType, PaymentStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

const DAY = 86_400_000;

const setup = async () => {
  const client = await createUser(UserRole.CLIENT);
  const freelancer = await createUser(UserRole.FREELANCER);
  const outsider = await createUser(UserRole.FREELANCER);
  const gig = await createGig(client.user._id, {
    status: GigStatus.IN_PROGRESS,
    selectedFreelancer: freelancer.user._id,
    budgetMax: 20000,
    milestones: [
      { title: 'Design', description: 'Screens', amount: 8000, dueDate: new Date(Date.now() + 10 * DAY) },
      { title: 'Build', description: 'Code', amount: 12000, dueDate: new Date(Date.now() + 20 * DAY) },
    ],
  });
  await ClientProfile.updateOne({ user: client.user._id }, { $set: { activeGigs: 1 } });
  const [m1, m2] = gig.milestones.map((m) => m._id!.toString());
  const base = `/api/v1/gigs/${gig._id}`;
  return { client, freelancer, outsider, gig, m1, m2, base };
};

/** Client funds a milestone through simulated checkout. */
const fund = async (auth: Record<string, string>, gigId: unknown, milestoneId: string) => {
  const order = await request(app).post('/api/v1/payments/orders').set(auth).send({ gigId, milestoneId }).expect(201);
  expect(order.body.data.simulated).toBe(true);
  await request(app).post(`/api/v1/payments/${order.body.data.payment._id}/simulate`).set(auth).expect(200);
  return order.body.data.payment._id as string;
};

describe('project progress + escrow flow (4.7 / 4.14)', () => {
  beforeEach(() => {
    env.SIMULATE_PAYMENTS = true;
  });
  afterEach(() => {
    env.SIMULATE_PAYMENTS = false;
  });

  it('runs fund → start → submit → changes → approve → payout → complete', async () => {
    const { client, freelancer, outsider, gig, m1, m2, base } = await setup();
    const status = async (mid: string) => (await Gig.findById(gig._id))!.milestones.find((m) => m._id!.toString() === mid)!.status;

    await request(app).get(`${base}/progress`).set(outsider.auth).expect(404);
    await request(app).put(`${base}/milestones/${m1}/start`).set(freelancer.auth).expect(409); // not funded

    const p1 = await fund(client.auth, gig._id, m1);
    expect(await status(m1)).toBe(MilestoneStatus.FUNDED);
    expect(await Notification.countDocuments({ recipient: freelancer.user._id, type: NotificationType.PAYMENT_ESCROW })).toBe(1);
    await request(app).post('/api/v1/payments/orders').set(client.auth).send({ gigId: gig._id, milestoneId: m1 }).expect(409);

    await request(app).put(`${base}/milestones/${m1}/start`).set(client.auth).expect(403);
    await request(app).put(`${base}/milestones/${m1}/start`).set(freelancer.auth).expect(200);
    await request(app).put(`${base}/milestones/${m1}/progress`).set(freelancer.auth).send({ percent: 60 }).expect(200);
    await request(app).post(`${base}/progress-logs`).set(freelancer.auth).send({ message: 'Wireframes done', milestoneId: m1 }).expect(201);
    await request(app).post(`${base}/progress-logs`).set(client.auth).send({ message: 'Looks great' }).expect(201);

    let progress = await request(app).get(`${base}/progress`).set(client.auth).expect(200);
    expect(progress.body.data.party).toBe('client');
    expect(progress.body.data.progress).toMatchObject({ paidPercent: 0, progressPercent: 24 }); // 8000*60 / 20000
    expect(progress.body.data.gig.progressLogs[0].author.firstName).toBe('Test');
    expect(progress.body.data.payments).toHaveLength(1);

    await request(app).put(`${base}/milestones/${m1}/submit`).set(freelancer.auth).send({ note: 'v1' }).expect(200);
    await request(app).put(`${base}/milestones/${m1}/request-changes`).set(client.auth).send({ note: 'Bigger logo' }).expect(200);
    expect(await status(m1)).toBe(MilestoneStatus.CHANGES_REQUESTED);
    await request(app).put(`${base}/milestones/${m1}/approve`).set(client.auth).expect(409);
    await request(app).put(`${base}/milestones/${m1}/submit`).set(freelancer.auth).send({ note: 'v2' }).expect(200);
    await request(app).put(`${base}/milestones/${m1}/approve`).set(freelancer.auth).expect(403);
    await request(app).put(`${base}/milestones/${m1}/approve`).set(client.auth).expect(200);
    await request(app).put(`${base}/milestones/${m1}/approve`).set(client.auth).expect(409);

    const released = await Payment.findById(p1);
    expect(released).toMatchObject({ status: PaymentStatus.RELEASED, payout: expect.objectContaining({ status: 'queued' }) });
    expect((await FreelancerProfile.findOne({ user: freelancer.user._id }))!.totalEarnings).toBe(7200); // 10% fee
    expect((await ClientProfile.findOne({ user: client.user._id }))!.totalSpent).toBe(8000);

    expect(await paymentService.processPayouts()).toBe(1);
    expect((await Payment.findById(p1))!.payout).toMatchObject({ status: 'processed', reference: expect.stringMatching(/^sim_payout_/) });
    expect(await Notification.countDocuments({ recipient: freelancer.user._id, type: NotificationType.PAYOUT_PROCESSED })).toBe(1);
    expect(await paymentService.processPayouts()).toBe(0);

    await request(app).put(`${base}/complete`).set(client.auth).expect(409); // M2 open
    await fund(client.auth, gig._id, m2);
    await request(app).put(`${base}/milestones/${m2}/start`).set(freelancer.auth).expect(200);
    await request(app).put(`${base}/milestones/${m2}/submit`).set(freelancer.auth).send({}).expect(200);
    await request(app).put(`${base}/milestones/${m2}/approve`).set(client.auth).expect(200);

    const done = await Gig.findById(gig._id);
    expect(done!.status).toBe(GigStatus.COMPLETED);
    expect((await FreelancerProfile.findOne({ user: freelancer.user._id }))!.completedGigs).toBe(1);
    expect(await ClientProfile.findOne({ user: client.user._id })).toMatchObject({ completedGigs: 1, activeGigs: 0 });
    expect(await Notification.countDocuments({ type: NotificationType.GIG_COMPLETED })).toBe(2);
    progress = await request(app).get(`${base}/progress`).set(freelancer.auth).expect(200);
    expect(progress.body.data.progress).toMatchObject({ paidPercent: 100, progressPercent: 100 });
  });

  it('refunding a funded (not started) milestone makes it fundable again', async () => {
    const { client, gig, m1 } = await setup();
    const paymentId = await fund(client.auth, gig._id, m1);
    await request(app).post(`/api/v1/payments/${paymentId}/refund`).set(client.auth).send({ reason: 'Changed scope' }).expect(200);
    expect((await Gig.findById(gig._id))!.milestones[0].status).toBe(MilestoneStatus.PENDING);
    await fund(client.auth, gig._id, m1);
  });

  it('auto-approves milestones the client ignores and sends deadline reminders once', async () => {
    const { client, freelancer, gig, m1 } = await setup();
    const paymentId = await fund(client.auth, gig._id, m1);
    await projectService.start((await Gig.findById(gig._id))!, m1);
    await projectService.submit((await Gig.findById(gig._id))!, m1, 'done', []);

    expect(await projectService.autoReleaseOverdue()).toBe(0);
    const later = new Date(Date.now() + (env.AUTO_RELEASE_DAYS + 1) * DAY);
    expect(await projectService.autoReleaseOverdue(later)).toBe(1);
    expect((await Payment.findById(paymentId))!.status).toBe(PaymentStatus.RELEASED);

    // M2 is due in 20 days: "due soon" 19 days from now, "overdue" after 21.
    expect(await projectService.sendDeadlineReminders(new Date(Date.now() + 19 * DAY))).toBe(1);
    expect(await projectService.sendDeadlineReminders(new Date(Date.now() + 19 * DAY))).toBe(0);
    expect(await projectService.sendDeadlineReminders(new Date(Date.now() + 21 * DAY))).toBe(1);
    expect(await Notification.countDocuments({ recipient: freelancer.user._id, type: NotificationType.DEADLINE_REMINDER })).toBe(2);
  });

  it('exports CSV with formula-safe cells', async () => {
    const { client, gig, m1 } = await setup();
    await Gig.updateOne({ _id: gig._id }, { $set: { title: '=HYPERLINK("x")' } });
    await fund(client.auth, gig._id, m1);
    const res = await request(app).get('/api/v1/payments/export').set(client.auth).expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('"Date","Gig"');
    expect(res.text).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe('payments without Razorpay or simulation', () => {
  it('answer 503', async () => {
    const { client, gig, m1 } = await setup();
    await request(app).post('/api/v1/payments/orders').set(client.auth).send({ gigId: gig._id, milestoneId: m1 }).expect(503);
    const cfg = await request(app).get('/api/v1/payments/config').set(client.auth).expect(200);
    expect(cfg.body.data).toMatchObject({ enabled: false, simulated: false });
  });
});

describe('Razorpay webhook (4.7)', () => {
  const secret = 'whsec_test_secret';
  beforeEach(() => {
    Object.assign(env, { RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: 'test_secret', RAZORPAY_WEBHOOK_SECRET: secret });
    features.razorpay = true;
  });
  afterEach(() => {
    Object.assign(env, { RAZORPAY_KEY_ID: undefined, RAZORPAY_KEY_SECRET: undefined, RAZORPAY_WEBHOOK_SECRET: undefined });
    features.razorpay = false;
  });

  const send = (body: object, signature?: string) => {
    const raw = JSON.stringify(body);
    return request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', signature ?? crypto.createHmac('sha256', secret).update(raw).digest('hex'))
      .send(raw);
  };

  it('captures, fails and refunds idempotently and rejects bad signatures', async () => {
    const { client, freelancer, gig, m1 } = await setup();
    const pending = await Payment.create({ gig: gig._id, milestone: m1, client: client.user._id, freelancer: freelancer.user._id, amount: 8000, razorpayOrderId: 'order_1' });
    const failing = await Payment.create({ gig: gig._id, client: client.user._id, freelancer: freelancer.user._id, amount: 100, razorpayOrderId: 'order_2' });

    const captured = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1' } } } };
    await send(captured, 'deadbeef').expect(400);
    await send(captured).expect(200);
    await send(captured).expect(200); // replay is harmless
    expect(await Payment.findById(pending._id)).toMatchObject({ status: PaymentStatus.ESCROW, razorpayPaymentId: 'pay_1' });
    expect((await Gig.findById(gig._id))!.milestones[0].status).toBe(MilestoneStatus.FUNDED);
    expect(await Notification.countDocuments({ type: NotificationType.PAYMENT_ESCROW })).toBe(1);

    await send({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_2', order_id: 'order_2', error_description: 'Card declined' } } } }).expect(200);
    expect(await Payment.findById(failing._id)).toMatchObject({ status: PaymentStatus.FAILED, failureReason: 'Card declined' });

    await send({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_1', payment_id: 'pay_1', amount: 800000 } } } }).expect(200);
    expect((await Payment.findById(pending._id))!.status).toBe(PaymentStatus.REFUNDED);
  });
});
