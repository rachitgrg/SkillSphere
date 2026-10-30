import request from 'supertest';
import { Types } from 'mongoose';
import app from '../src/app';
import Gig from '../src/models/Gig';
import { UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

describe('GET /api/v1/gigs/:id views (C11)', () => {
  it('increments views atomically even for a legacy document that would fail validation', async () => {
    const viewer = await createUser(UserRole.FREELANCER);
    const client = await createUser(UserRole.CLIENT);
    // Shape produced by the old seed-gigs.js: `type`/`budget` instead of `budgetType`/`budgetMin`.
    const { insertedId } = await Gig.collection.insertOne({
      client: client.user._id,
      title: 'Legacy gig',
      description: 'Inserted without budgetType',
      category: 'Web Development',
      skills: ['React'],
      type: 'fixed',
      budget: 5000,
      status: 'open',
      views: 0,
    });

    const first = await request(app).get(`/api/v1/gigs/${insertedId}`).set(viewer.auth);
    expect(first.status).toBe(200);
    expect(first.body.data.views).toBe(1);

    await request(app).get(`/api/v1/gigs/${insertedId}`).set(viewer.auth); // same viewer, same day
    expect((await Gig.collection.findOne({ _id: insertedId }))!.views).toBe(1);
  });

  it('counts each other viewer once a day, and never the owner or admins (P2-7)', async () => {
    const owner = await createUser(UserRole.CLIENT);
    const admin = await createUser(UserRole.ADMIN);
    const [f1, f2] = await Promise.all([createUser(UserRole.FREELANCER), createUser(UserRole.FREELANCER)]);
    const gig = await createGig(owner.user._id);
    const view = (auth?: Record<string, string>) => {
      const req = request(app).get(`/api/v1/gigs/${gig.id}`);
      return (auth ? req.set(auth) : req).expect(200);
    };

    for (let i = 0; i < 3; i++) await view(owner.auth); // owner refreshing their own gig
    await view(admin.auth);
    await view(f1.auth);
    await view(f1.auth); // React Query refetch
    await view(f2.auth);
    await view(); // anonymous visitor
    await view(); // same browser again
    expect((await Gig.findById(gig._id))!.views).toBe(3);
  });

  it('returns 404 for an unknown gig', async () => {
    const viewer = await createUser(UserRole.FREELANCER);
    const res = await request(app).get(`/api/v1/gigs/${new Types.ObjectId()}`).set(viewer.auth);
    expect(res.status).toBe(404);
  });
});
