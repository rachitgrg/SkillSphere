import request from 'supertest';
import app from '../src/app';
import { GigStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

describe('public marketplace (1.16)', () => {
  const seed = async () => {
    const client = await createUser(UserRole.CLIENT);
    const open = await createGig(client.user._id, { title: 'React app', skills: ['React', 'Node.js'], budgetMin: 5000, budgetMax: 10000 });
    await createGig(client.user._id, { title: 'Vue app', skills: ['Vue.js'], budgetMin: 20000, budgetMax: 30000 });
    const draft = await createGig(client.user._id, { title: 'Draft', status: GigStatus.DRAFT });
    const privateGig = await createGig(client.user._id, { title: 'Private', visibility: 'private' });
    await createGig(client.user._id, { title: 'Cancelled', status: GigStatus.CANCELLED });
    return { client, open, draft, privateGig };
  };

  it('GET /gigs works without login and lists only open public gigs', async () => {
    await seed();
    const res = await request(app).get('/api/v1/gigs');
    expect(res.status).toBe(200);
    expect(res.body.data.map((g: { title: string }) => g.title).sort()).toEqual(['React app', 'Vue app']);
    expect(res.body.pagination.total).toBe(2);
  });

  it('caps limit at 50', async () => {
    const res = await request(app).get('/api/v1/gigs').query({ limit: 1000 });
    expect(res.body.pagination.limit).toBe(50);
  });

  it('GET /gigs/:id is public for open gigs and hides drafts/private gigs from others', async () => {
    const { client, open, draft, privateGig } = await seed();
    expect((await request(app).get(`/api/v1/gigs/${open.id}`)).status).toBe(200);
    expect((await request(app).get(`/api/v1/gigs/${draft.id}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/gigs/${privateGig.id}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/gigs/${draft.id}`).set(client.auth)).status).toBe(200);
  });

  it('filters by skills given as a comma string or repeated params', async () => {
    await seed();
    const comma = await request(app).get('/api/v1/search/gigs?skills=React,Go');
    expect(comma.status).toBe(200);
    expect(comma.body.data.map((g: { title: string }) => g.title)).toEqual(['React app']);

    const repeated = await request(app).get('/api/v1/search/gigs?skills=Vue.js&skills=Go');
    expect(repeated.status).toBe(200);
    expect(repeated.body.data.map((g: { title: string }) => g.title)).toEqual(['Vue app']);
  });

  it('budget filters use range overlap', async () => {
    await seed();
    // [8000, 12000] overlaps React [5000, 10000] only.
    const res = await request(app).get('/api/v1/gigs').query({ budgetMin: 8000, budgetMax: 12000 });
    expect(res.body.data.map((g: { title: string }) => g.title)).toEqual(['React app']);
    // [25000, ∞) overlaps Vue [20000, 30000] only.
    const high = await request(app).get('/api/v1/search/gigs').query({ minBudget: 25000 });
    expect(high.body.data.map((g: { title: string }) => g.title)).toEqual(['Vue app']);
  });

  it('accepts a 500 KB JSON body (1 MB limit)', async () => {
    const freelancer = await createUser(UserRole.FREELANCER);
    const res = await request(app)
      .put('/api/v1/users/profile')
      .set(freelancer.auth)
      .send({ bio: 'x', padding: 'y'.repeat(500_000) });
    expect(res.status).not.toBe(413);
  });
});
