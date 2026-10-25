import request from 'supertest';
import app from '../src/app';
import User from '../src/models/User';
import { STRONG_PASSWORD } from './helpers';

const base = { firstName: 'Asha', lastName: 'Rao', email: 'asha@test.dev', password: STRONG_PASSWORD };

describe('POST /api/v1/auth/register (C1)', () => {
  it('rejects role=admin with 400 and creates no user', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ ...base, role: 'admin' });
    expect(res.status).toBe(400);
    expect(await User.countDocuments()).toBe(0);
  });

  it('rejects a weak password with 400', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ ...base, password: 'aaaaaaaa', role: 'client' });
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e: { field: string }) => e.field === 'body.password')).toBe(true);
  });

  it('registers a client', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ ...base, role: 'client' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('client');
  });

  it('defaults to freelancer and creates the freelancer profile', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(base);
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('freelancer');
    const FreelancerProfile = (await import('../src/models/FreelancerProfile')).default;
    expect(await FreelancerProfile.countDocuments({ user: res.body.data.user._id })).toBe(1);
  });

  it('ignores unknown fields such as isVerified', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ ...base, role: 'client', isVerified: true });
    expect(res.status).toBe(201);
    expect(res.body.data.user.isVerified).toBe(false);
  });
});

describe('POST /api/v1/auth/login validation', () => {
  it('rejects a malformed email with 400', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'nope', password: 'x' });
    expect(res.status).toBe(400);
  });
});
