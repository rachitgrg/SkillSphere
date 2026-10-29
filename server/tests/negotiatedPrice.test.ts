import request from 'supertest';
import app from '../src/app';
import Gig from '../src/models/Gig';
import Payment from '../src/models/Payment';
import Proposal from '../src/models/Proposal';
import { scaleAmounts } from '../src/controllers/proposalController';
import { PaymentStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

const mockRazorpay = { orders: { create: jest.fn(async (o: { amount: number }) => ({ id: `order_${o.amount}_${Math.random()}`, ...o })) } };
jest.mock('../src/config/razorpay', () => ({
  getRazorpay: () => mockRazorpay,
  getRazorpayKeys: () => ({ keyId: 'rzp_test_key', keySecret: 'test_key_secret' }),
}));

const due = () => new Date(Date.now() + 14 * 86_400_000);

/** Gig posted with 2 × ₹10,000 milestones (budget ₹20,000) and a proposal for `bid`. */
const setup = async (bid: number, gigOverrides: Record<string, unknown> = {}) => {
  const client = await createUser(UserRole.CLIENT);
  const freelancer = await createUser(UserRole.FREELANCER);
  const gig = await createGig(client.user._id, {
    budgetMin: 10000,
    budgetMax: 20000,
    milestones: [
      { title: 'Design', description: 'Mockups', amount: 10000, dueDate: due() },
      { title: 'Build', description: 'Code', amount: 10000, dueDate: due() },
    ],
    ...gigOverrides,
  });
  const proposal = await Proposal.create({ gig: gig._id, freelancer: freelancer.user._id, coverLetter: 'Hi', proposedAmount: bid, estimatedDuration: '2 weeks' });
  const accept = () => request(app).put(`/api/v1/proposals/${proposal.id}/status`).set(client.auth).send({ status: 'accepted' });
  const fund = (milestoneId: unknown) => request(app).post('/api/v1/payments/orders').set(client.auth).send({ gigId: gig.id, milestoneId: String(milestoneId) });
  return { client, freelancer, gig, proposal, accept, fund };
};

describe('negotiated price reaches the milestones (P0-4)', () => {
  it('scales the gig milestones to the agreed amount on hire, and checkout charges the new amounts', async () => {
    const { gig, accept, fund } = await setup(16000);
    await accept().expect(200);

    const hired = await Gig.findById(gig._id);
    expect(hired!.milestones.map((m) => m.amount)).toEqual([8000, 8000]);

    const order = await fund(hired!.milestones[0]._id).expect(201);
    expect(order.body.data.payment.amount).toBe(8000);
    expect(order.body.data.order.amount).toBe(800000); // paise
  });

  it('uses the last counter-offer, with the rounding remainder on the last milestone', async () => {
    const { client, gig, proposal, accept } = await setup(16000, {
      milestones: [
        { title: 'A', description: 'a', amount: 5000, dueDate: due() },
        { title: 'B', description: 'b', amount: 5000, dueDate: due() },
        { title: 'C', description: 'c', amount: 5000, dueDate: due() },
      ],
    });
    await request(app).post(`/api/v1/proposals/${proposal.id}/negotiate`).set(client.auth).send({ amount: 10000, message: 'Can you do 10k?' }).expect(200);
    await accept().expect(200);
    const amounts = (await Gig.findById(gig._id))!.milestones.map((m) => m.amount);
    expect(amounts).toEqual([3333.33, 3333.33, 3333.34]);
  });

  it('leaves milestones alone when they already add up to the agreed amount', async () => {
    const { gig, accept } = await setup(20000);
    await accept().expect(200);
    expect((await Gig.findById(gig._id))!.milestones.map((m) => m.amount)).toEqual([10000, 10000]);
  });

  it('does not scale an hourly gig: the bid is a rate, not a total', async () => {
    const { gig, accept } = await setup(1500, { budgetType: 'hourly' });
    await accept().expect(200);
    expect((await Gig.findById(gig._id))!.milestones.map((m) => m.amount)).toEqual([10000, 10000]);
  });

  it('createOrder refuses a milestone that would push funding past the agreed amount', async () => {
    const { gig, accept, fund } = await setup(16000);
    await accept().expect(200);
    const hired = (await Gig.findById(gig._id))!;
    await Payment.create({ gig: gig._id, milestone: hired.milestones[0]._id, client: hired.client, freelancer: hired.selectedFreelancer, amount: 8000, status: PaymentStatus.ESCROW });
    // Someone edits the second milestone behind the API's back: 8,000 + 9,000 > 16,000.
    await Gig.updateOne({ _id: gig._id, 'milestones._id': hired.milestones[1]._id }, { $set: { 'milestones.$.amount': 9000 } });
    const res = await fund(hired.milestones[1]._id).expect(409);
    expect(res.body.message).toMatch(/exceed the agreed amount/);
  });
});

describe('scaleAmounts', () => {
  it('scales proportionally to 2 dp and keeps the exact total', () => {
    expect(scaleAmounts([10000, 10000], 16000)).toEqual([8000, 8000]);
    expect(scaleAmounts([1000, 2000, 3000], 7000)).toEqual([1166.67, 2333.33, 3500]);
    const odd = scaleAmounts([1, 1, 1], 100);
    expect(Math.round(odd.reduce((a, b) => a + b, 0) * 100)).toBe(10000);
    expect(scaleAmounts([], 500)).toEqual([]);
  });
});
