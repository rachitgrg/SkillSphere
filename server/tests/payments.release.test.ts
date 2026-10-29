import request from 'supertest';
import app from '../src/app';
import Gig from '../src/models/Gig';
import Payment from '../src/models/Payment';
import { GigStatus, MilestoneStatus, PaymentStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

/** An in-progress gig with two milestones; the first is escrowed in the given state. */
const setup = async (firstStatus: MilestoneStatus) => {
  const client = await createUser(UserRole.CLIENT);
  const freelancer = await createUser(UserRole.FREELANCER);
  const due = new Date(Date.now() + 7 * 86_400_000);
  const gig = await createGig(client.user._id, {
    status: GigStatus.IN_PROGRESS,
    selectedFreelancer: freelancer.user._id,
    milestones: [
      { title: 'Design', description: 'Mockups', amount: 5000, dueDate: due, status: firstStatus },
      { title: 'Build', description: 'Code', amount: 5000, dueDate: due },
    ],
  });
  const milestone = gig.milestones[0];
  const payment = await Payment.create({ gig: gig._id, milestone: milestone._id, client: client.user._id, freelancer: freelancer.user._id, amount: 5000, status: PaymentStatus.ESCROW });
  const release = (id = payment.id) => request(app).post(`/api/v1/payments/${id}/release`).set(client.auth);
  return { client, freelancer, gig, milestone, payment, release };
};

describe('POST /payments/:id/release keeps milestones consistent (P1-6)', () => {
  it('refuses to release a milestone payment before the work is submitted', async () => {
    for (const status of [MilestoneStatus.FUNDED, MilestoneStatus.IN_PROGRESS]) {
      const { payment, release } = await setup(status);
      const res = await release();
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/approving the milestone/);
      expect((await Payment.findById(payment._id))!.status).toBe(PaymentStatus.ESCROW);
    }
  });

  it('for a submitted milestone, approves it and releases the money together', async () => {
    const { gig, payment, release } = await setup(MilestoneStatus.SUBMITTED);
    const res = await release().expect(200);
    expect(res.body.data.status).toBe(PaymentStatus.RELEASED);
    expect((await Payment.findById(payment._id))!.status).toBe(PaymentStatus.RELEASED);
    expect((await Gig.findById(gig._id))!.milestones[0].status).toBe(MilestoneStatus.APPROVED);
  });

  it('still releases lump-sum (non-milestone) payments directly', async () => {
    const { client, freelancer, gig, release } = await setup(MilestoneStatus.PENDING);
    const lump = await Payment.create({ gig: gig._id, client: client.user._id, freelancer: freelancer.user._id, amount: 2000, status: PaymentStatus.ESCROW });
    const res = await release(lump.id).expect(200);
    expect(res.body.data.status).toBe(PaymentStatus.RELEASED);
  });
});
