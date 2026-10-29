import request from 'supertest';
import app from '../src/app';
import Gig from '../src/models/Gig';
import Notification from '../src/models/Notification';
import { GigStatus, NotificationType, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

const setup = async () => {
  const admin = await createUser(UserRole.ADMIN);
  const client = await createUser(UserRole.CLIENT);
  const gig = await createGig(client.user._id, { approvedAt: new Date() }); // open = already approved
  const edit = (body: Record<string, unknown>) => request(app).put(`/api/v1/gigs/${gig.id}`).set(client.auth).send(body);
  const publicIds = async () => (await request(app).get('/api/v1/gigs').expect(200)).body.data.map((g: { _id: string }) => g._id);
  return { admin, client, gig, edit, publicIds };
};

describe('editing an approved gig (P1-5)', () => {
  it('a content change sends it back for approval and hides it from /gigs', async () => {
    const { admin, client, gig, edit, publicIds } = await setup();
    expect(await publicIds()).toContain(gig.id);

    const res = await edit({ title: 'Totally different gig now' }).expect(200);
    expect(res.body.data.status).toBe(GigStatus.PENDING_APPROVAL);
    expect(res.body.message).toMatch(/sent back for approval/);
    expect(await publicIds()).not.toContain(gig.id);

    const notified = await Notification.find({ type: NotificationType.SYSTEM }).lean();
    expect(notified.map((n) => n.recipient.toString()).sort()).toEqual([admin.user.id, client.user.id].sort());

    const queue = await request(app).get('/api/v1/admin/gigs/pending').set(admin.auth).expect(200);
    expect(queue.body.data.map((g: { _id: string }) => g._id)).toContain(gig.id);
  });

  it('deadline/visibility edits, or resending unchanged fields, keep it live', async () => {
    const { gig, edit } = await setup();
    const unchanged = { title: gig.title, description: gig.description, skills: gig.skills, budgetMin: gig.budgetMin, budgetMax: gig.budgetMax };
    await edit({ ...unchanged, deadline: new Date(Date.now() + 30 * 86_400_000).toISOString() }).expect(200);
    expect((await Gig.findById(gig._id))!.status).toBe(GigStatus.OPEN);
  });

  it('re-approval does not send the "new gig" notifications again', async () => {
    const { admin, gig, edit } = await setup();
    const invitee = await createUser(UserRole.FREELANCER);
    await Gig.updateOne({ _id: gig._id }, { $push: { invitations: { freelancer: invitee.user._id, status: 'pending', invitedAt: new Date() } } });
    await edit({ description: 'A rewritten description that changes the scope of the work entirely.' }).expect(200);
    const before = await Notification.countDocuments();
    await request(app).put(`/api/v1/admin/gigs/${gig.id}/approve`).set(admin.auth).expect(200);
    // Only the client's "Gig approved" notice; the invitee was told the first time.
    expect(await Notification.countDocuments()).toBe(before + 1);
    expect((await Gig.findById(gig._id))!.status).toBe(GigStatus.OPEN);
  });

  it('unverified clients cannot edit gigs (same rule as posting)', async () => {
    const { gig } = await setup();
    const owner = await createUser(UserRole.CLIENT, { isVerified: false });
    await Gig.updateOne({ _id: gig._id }, { client: owner.user._id });
    const res = await request(app).put(`/api/v1/gigs/${gig.id}`).set(owner.auth).send({ title: 'Something else entirely' });
    expect(res.status).toBe(403);
  });
});
