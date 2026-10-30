import request from 'supertest';
import app from '../src/app';
import Notification from '../src/models/Notification';
import Proposal from '../src/models/Proposal';
import { GigStatus, ProposalStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

const setup = async () => {
  const client = await createUser(UserRole.CLIENT);
  const freelancer = await createUser(UserRole.FREELANCER);
  const outsider = await createUser(UserRole.FREELANCER);
  const gig = await createGig(client.user._id);
  const proposal = await Proposal.create({
    gig: gig._id, freelancer: freelancer.user._id, coverLetter: 'Hi', proposedAmount: 9000, estimatedDuration: '2 weeks',
  });
  return { client, freelancer, outsider, gig, proposal };
};

const negotiate = (auth: Record<string, string>, id: string, amount: number, message = 'Counter') =>
  request(app).post(`/api/v1/proposals/${id}/negotiate`).set(auth).send({ amount, message });

describe('POST /api/v1/proposals/:id/negotiate (4.5)', () => {
  it('records counter-offers from both sides and hires at the last agreed amount', async () => {
    const { client, freelancer, gig, proposal } = await setup();

    const counter = await negotiate(client.auth, proposal.id, 7000, 'Can you do 7k?');
    expect(counter.status).toBe(200);
    expect(counter.body.data.status).toBe(ProposalStatus.NEGOTIATING);
    expect(await Notification.countDocuments({ recipient: freelancer.user._id })).toBe(1);

    const reply = await negotiate(freelancer.auth, proposal.id, 8000, 'Meet at 8k?');
    expect(reply.body.data.negotiationHistory).toHaveLength(2);
    expect(reply.body.data.finalAmount).toBe(8000);

    const accepted = await request(app).put(`/api/v1/proposals/${proposal.id}/status`).set(client.auth).send({ status: 'accepted' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.finalAmount).toBe(8000);
    expect(gig.id).toBeDefined();
  });

  it('rejects outsiders and closed proposals', async () => {
    const { client, outsider, gig, proposal } = await setup();
    expect((await negotiate(outsider.auth, proposal.id, 5000)).status).toBe(403);

    await Proposal.updateOne({ _id: proposal._id }, { status: ProposalStatus.WITHDRAWN });
    expect((await negotiate(client.auth, proposal.id, 5000)).status).toBe(409);

    await Proposal.updateOne({ _id: proposal._id }, { status: ProposalStatus.PENDING });
    const { default: Gig } = await import('../src/models/Gig');
    await Gig.updateOne({ _id: gig._id }, { status: GigStatus.IN_PROGRESS });
    expect((await negotiate(client.auth, proposal.id, 5000)).status).toBe(409);
  });

  it('validates the amount', async () => {
    const { client, proposal } = await setup();
    expect((await negotiate(client.auth, proposal.id, -1)).status).toBe(400);
  });
});

describe('POST /api/v1/proposals/:id/accept-offer (P2-4)', () => {
  const acceptOffer = (auth: Record<string, string>, id: string) => request(app).post(`/api/v1/proposals/${id}/accept-offer`).set(auth);

  it("the freelancer agrees to the client's counter without posting a fake counter-offer", async () => {
    const { client, freelancer, proposal } = await setup();
    await negotiate(client.auth, proposal.id, 7000, 'Can you do 7k?').expect(200);

    const res = await acceptOffer(freelancer.auth, proposal.id).expect(200);
    expect(res.body.data.agreedAt).toEqual(expect.any(String));
    expect(res.body.data.status).toBe(ProposalStatus.NEGOTIATING);
    expect(res.body.data.negotiationHistory).toHaveLength(1); // no echo entry
    expect(res.body.data.finalAmount).toBe(7000);
    expect(await Notification.countDocuments({ recipient: client.user._id, title: 'Offer accepted' })).toBe(1);

    // The client hires at the agreed amount.
    const hired = await request(app).put(`/api/v1/proposals/${proposal.id}/status`).set(client.auth).send({ status: 'accepted' }).expect(200);
    expect(hired.body.data.finalAmount).toBe(7000);
  });

  it('only works on a counter-offer from the client, and a new counter clears the agreement', async () => {
    const { client, freelancer, outsider, proposal } = await setup();
    await acceptOffer(freelancer.auth, proposal.id).expect(409); // nothing offered yet

    await negotiate(freelancer.auth, proposal.id, 8500, 'How about 8.5k?').expect(200);
    await acceptOffer(freelancer.auth, proposal.id).expect(409); // own offer

    await negotiate(client.auth, proposal.id, 8000, '8k?').expect(200);
    await acceptOffer(outsider.auth, proposal.id).expect(404);
    await acceptOffer(client.auth, proposal.id).expect(403); // freelancers only
    await acceptOffer(freelancer.auth, proposal.id).expect(200);

    const countered = await negotiate(client.auth, proposal.id, 7500, 'Actually, 7.5k?').expect(200);
    expect(countered.body.data.agreedAt).toBeUndefined();
  });
});
