import request from 'supertest';
import { Types } from 'mongoose';
import app from '../src/app';
import Gig from '../src/models/Gig';
import Payment from '../src/models/Payment';
import Proposal from '../src/models/Proposal';
import { GigStatus, PaymentStatus, ProposalStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

const addProposal = (gigId: Types.ObjectId, freelancerId: Types.ObjectId) =>
  Proposal.create({ gig: gigId, freelancer: freelancerId, coverLetter: 'Hi', proposedAmount: 5000, estimatedDuration: '1 week' });

describe('DELETE /api/v1/gigs/:id (1.15)', () => {
  it('deletes an open gig and cascades its proposals', async () => {
    const client = await createUser(UserRole.CLIENT);
    const freelancer = await createUser(UserRole.FREELANCER);
    const gig = await createGig(client.user._id);
    await addProposal(gig._id, freelancer.user._id);

    const res = await request(app).delete(`/api/v1/gigs/${gig.id}`).set(client.auth);
    expect(res.status).toBe(200);
    expect(await Gig.exists({ _id: gig._id })).toBeNull();
    expect(await Proposal.countDocuments({ gig: gig._id })).toBe(0);
  });

  it('refuses to delete a gig that has started (suggests cancelling)', async () => {
    const client = await createUser(UserRole.CLIENT);
    const gig = await createGig(client.user._id, { status: GigStatus.IN_PROGRESS });
    const res = await request(app).delete(`/api/v1/gigs/${gig.id}`).set(client.auth);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/cancel/i);
  });

  it('refuses to delete a gig with money in escrow', async () => {
    const client = await createUser(UserRole.CLIENT);
    const freelancer = await createUser(UserRole.FREELANCER);
    const gig = await createGig(client.user._id);
    await Payment.create({ gig: gig._id, client: client.user._id, freelancer: freelancer.user._id, amount: 100, status: PaymentStatus.ESCROW });
    const res = await request(app).delete(`/api/v1/gigs/${gig.id}`).set(client.auth);
    expect(res.status).toBe(409);
    expect(await Gig.exists({ _id: gig._id })).not.toBeNull();
  });

  it('only the owner (or an admin) can delete', async () => {
    const client = await createUser(UserRole.CLIENT);
    const other = await createUser(UserRole.CLIENT);
    const gig = await createGig(client.user._id);
    expect((await request(app).delete(`/api/v1/gigs/${gig.id}`).set(other.auth)).status).toBe(403);
  });
});

describe('PUT /api/v1/gigs/:id/cancel (1.15)', () => {
  it('cancels the gig and rejects open proposals', async () => {
    const client = await createUser(UserRole.CLIENT);
    const freelancer = await createUser(UserRole.FREELANCER);
    const gig = await createGig(client.user._id);
    const proposal = await addProposal(gig._id, freelancer.user._id);

    const res = await request(app).put(`/api/v1/gigs/${gig.id}/cancel`).set(client.auth);
    expect(res.status).toBe(200);
    expect((await Gig.findById(gig._id))!.status).toBe(GigStatus.CANCELLED);
    expect((await Proposal.findById(proposal._id))!.status).toBe(ProposalStatus.REJECTED);
  });

  it('refuses while money is held in escrow', async () => {
    const client = await createUser(UserRole.CLIENT);
    const freelancer = await createUser(UserRole.FREELANCER);
    const gig = await createGig(client.user._id, { status: GigStatus.IN_PROGRESS, selectedFreelancer: freelancer.user._id });
    await Payment.create({ gig: gig._id, client: client.user._id, freelancer: freelancer.user._id, amount: 100, status: PaymentStatus.ESCROW });
    expect((await request(app).put(`/api/v1/gigs/${gig.id}/cancel`).set(client.auth)).status).toBe(409);
  });

  it('refuses completed gigs and non-owners', async () => {
    const client = await createUser(UserRole.CLIENT);
    const other = await createUser(UserRole.CLIENT);
    const done = await createGig(client.user._id, { status: GigStatus.COMPLETED });
    expect((await request(app).put(`/api/v1/gigs/${done.id}/cancel`).set(client.auth)).status).toBe(409);
    const open = await createGig(client.user._id);
    expect((await request(app).put(`/api/v1/gigs/${open.id}/cancel`).set(other.auth)).status).toBe(403);
  });
});
