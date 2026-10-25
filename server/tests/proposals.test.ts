import request from 'supertest';
import app from '../src/app';
import Gig from '../src/models/Gig';
import Notification from '../src/models/Notification';
import Proposal from '../src/models/Proposal';
import { GigStatus, ProposalStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

const proposalBody = (gigId: string, extra: Record<string, unknown> = {}) => ({
  gigId,
  coverLetter: 'I can build this.',
  proposedAmount: 8000,
  estimatedDuration: '2 weeks',
  ...extra,
});

const apply = (auth: Record<string, string>, body: Record<string, unknown>) =>
  request(app).post('/api/v1/proposals').set(auth).send(body);

const setStatus = (auth: Record<string, string>, id: string, status: string) =>
  request(app).put(`/api/v1/proposals/${id}/status`).set(auth).send({ status });

describe('POST /api/v1/proposals (1.12)', () => {
  it('creates a proposal, bumps the gig counters and notifies the client', async () => {
    const client = await createUser(UserRole.CLIENT);
    const freelancer = await createUser(UserRole.FREELANCER);
    const gig = await createGig(client.user._id);

    const res = await apply(freelancer.auth, proposalBody(gig.id));
    expect(res.status).toBe(201);
    const updated = await Gig.findById(gig._id);
    expect(updated!.totalProposals).toBe(1);
    expect(updated!.proposals).toHaveLength(1);
    expect(await Notification.countDocuments({ recipient: client.user._id })).toBe(1);
  });

  it('rejects proposals on gigs that are not open', async () => {
    const client = await createUser(UserRole.CLIENT);
    const freelancer = await createUser(UserRole.FREELANCER);
    for (const status of [GigStatus.IN_PROGRESS, GigStatus.COMPLETED, GigStatus.DRAFT, GigStatus.CANCELLED]) {
      const gig = await createGig(client.user._id, { status });
      const res = await apply(freelancer.auth, proposalBody(gig.id));
      expect(res.status).toBe(409);
    }
  });

  it('returns 409 for a duplicate submission', async () => {
    const client = await createUser(UserRole.CLIENT);
    const freelancer = await createUser(UserRole.FREELANCER);
    const gig = await createGig(client.user._id);
    expect((await apply(freelancer.auth, proposalBody(gig.id))).status).toBe(201);
    expect((await apply(freelancer.auth, proposalBody(gig.id))).status).toBe(409);
  });

  it('only freelancers can apply', async () => {
    const client = await createUser(UserRole.CLIENT);
    const gig = await createGig(client.user._id);
    expect((await apply(client.auth, proposalBody(gig.id))).status).toBe(403);
  });

  it('validates the body', async () => {
    const freelancer = await createUser(UserRole.FREELANCER);
    const res = await apply(freelancer.auth, { gigId: 'x', proposedAmount: -1 });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/v1/proposals/:id/status (1.12)', () => {
  const setup = async (gigOverrides: Record<string, unknown> = {}) => {
    const client = await createUser(UserRole.CLIENT);
    const a = await createUser(UserRole.FREELANCER);
    const b = await createUser(UserRole.FREELANCER);
    const gig = await createGig(client.user._id, gigOverrides);
    const pa = await apply(a.auth, proposalBody(gig.id, {
      milestones: [{ title: 'Phase 1', description: 'Setup', amount: 4000, dueDate: '2030-01-01' }],
    }));
    const pb = await apply(b.auth, proposalBody(gig.id));
    return { client, a, b, gig, pa: pa.body.data._id as string, pb: pb.body.data._id as string };
  };

  it('accepting hires the freelancer, copies milestones and auto-rejects the others', async () => {
    const { client, a, b, gig, pa, pb } = await setup();
    const res = await setStatus(client.auth, pa, 'accepted');
    expect(res.status).toBe(200);
    expect(res.body.data.finalAmount).toBe(8000);

    const updated = await Gig.findById(gig._id);
    expect(updated!.status).toBe(GigStatus.IN_PROGRESS);
    expect(updated!.selectedFreelancer!.toString()).toBe(a.user.id);
    expect(updated!.milestones).toHaveLength(1);
    expect(updated!.milestones[0].title).toBe('Phase 1');

    expect((await Proposal.findById(pb))!.status).toBe(ProposalStatus.REJECTED);
    expect(await Notification.countDocuments({ recipient: a.user._id })).toBe(1);
    expect(await Notification.countDocuments({ recipient: b.user._id })).toBe(1);
  });

  it('keeps the gig milestones when the gig already defines them', async () => {
    const { client, gig, pa } = await setup({
      milestones: [{ title: 'Client milestone', description: 'x', amount: 9000, dueDate: new Date('2030-01-01') }],
    });
    await setStatus(client.auth, pa, 'accepted');
    const updated = await Gig.findById(gig._id);
    expect(updated!.milestones.map((m) => m.title)).toEqual(['Client milestone']);
  });

  it('a second accept is rejected with 409', async () => {
    const { client, pa, pb } = await setup();
    expect((await setStatus(client.auth, pa, 'accepted')).status).toBe(200);
    expect((await setStatus(client.auth, pb, 'accepted')).status).toBe(409);
  });

  it('concurrent accepts hire exactly one freelancer', async () => {
    const { client, gig, pa, pb } = await setup();
    await Proposal.updateOne({ _id: pb }, { status: ProposalStatus.PENDING });
    const results = await Promise.all([setStatus(client.auth, pa, 'accepted'), setStatus(client.auth, pb, 'accepted')]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await Proposal.countDocuments({ gig: gig._id, status: ProposalStatus.ACCEPTED })).toBe(1);
  });

  it('rejects unknown statuses', async () => {
    const { client, pa } = await setup();
    expect((await setStatus(client.auth, pa, 'withdrawn')).status).toBe(400);
    expect((await setStatus(client.auth, pa, 'banana')).status).toBe(400);
  });

  it('only the gig owner can change the status', async () => {
    const { pa } = await setup();
    const other = await createUser(UserRole.CLIENT);
    expect((await setStatus(other.auth, pa, 'accepted')).status).toBe(403);
    const admin = await createUser(UserRole.ADMIN);
    expect((await setStatus(admin.auth, pa, 'accepted')).status).toBe(403);
  });

  it('rejecting notifies the freelancer and leaves the gig open', async () => {
    const { client, a, gig, pa } = await setup();
    expect((await setStatus(client.auth, pa, 'rejected')).status).toBe(200);
    expect((await Gig.findById(gig._id))!.status).toBe(GigStatus.OPEN);
    expect(await Notification.countDocuments({ recipient: a.user._id })).toBe(1);
  });
});
