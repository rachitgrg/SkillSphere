import request from 'supertest';
import { Types } from 'mongoose';
import app from '../src/app';
import Gig from '../src/models/Gig';
import { UserRole } from '../src/types';
import { createUser } from './helpers';

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

    await request(app).get(`/api/v1/gigs/${insertedId}`).set(viewer.auth);
    expect((await Gig.collection.findOne({ _id: insertedId }))!.views).toBe(2);
  });

  it('returns 404 for an unknown gig', async () => {
    const viewer = await createUser(UserRole.FREELANCER);
    const res = await request(app).get(`/api/v1/gigs/${new Types.ObjectId()}`).set(viewer.auth);
    expect(res.status).toBe(404);
  });
});
