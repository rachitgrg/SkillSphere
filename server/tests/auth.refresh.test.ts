import request from 'supertest';
import app from '../src/app';
import User from '../src/models/User';
import { MAX_SESSIONS, ROTATION_GRACE_MS } from '../src/services/sessionService';
import { hashToken } from '../src/utils/generateToken';
import { STRONG_PASSWORD } from './helpers';

const creds = { email: 'neha@test.dev', password: STRONG_PASSWORD };

/** Returns the raw refresh cookie value from a response. */
const refreshCookie = (res: request.Response): string => {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith('refreshToken='));
  if (!cookie) throw new Error('no refresh cookie');
  return cookie.split(';')[0].split('=')[1];
};

const register = () =>
  request(app)
    .post('/api/v1/auth/register')
    .send({ firstName: 'Neha', lastName: 'S', role: 'freelancer', ...creds });

const refresh = (token?: string) => {
  const req = request(app).post('/api/v1/auth/refresh');
  return token ? req.set('Cookie', `refreshToken=${token}`) : req;
};

describe('refresh tokens (C6)', () => {
  it('sets an httpOnly refresh cookie scoped to /api/v1/auth and never returns it in the body', async () => {
    const res = await register();
    const cookie = ([] as string[]).concat(res.headers['set-cookie']).find((c) => c.startsWith('refreshToken='))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(res.body.data.refreshToken).toBeUndefined();
    expect(res.body.data.token).toEqual(expect.any(String));
  });

  it('stores only a hash of the refresh token', async () => {
    const res = await register();
    const raw = refreshCookie(res);
    const user = await User.findOne({ email: creds.email }).select('+refreshSessions');
    expect(user!.refreshSessions).toHaveLength(1);
    expect(user!.refreshSessions![0].hash).toBe(hashToken(raw));
    expect(JSON.stringify(user!.refreshSessions)).not.toContain(raw);
  });

  it('issues a new access token and rotates the refresh token', async () => {
    const raw = refreshCookie(await register());
    const res = await refresh(raw);
    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe(creds.email);

    const rotated = refreshCookie(res);
    expect(rotated).not.toBe(raw);

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${res.body.data.token}`);
    expect(me.status).toBe(200);
  });

  /** Pretends the last rotation of every session happened longer ago than the grace window. */
  const ageRotations = () =>
    User.updateOne({ email: creds.email }, { $set: { 'refreshSessions.$[].rotatedAt': new Date(Date.now() - ROTATION_GRACE_MS - 1000) } });

  it('replaying a token rotated more than 30 s ago revokes only that device', async () => {
    const laptop = refreshCookie(await register());
    const phone = refreshCookie(await request(app).post('/api/v1/auth/login').send(creds).expect(200));
    const rotated = refreshCookie(await refresh(laptop).expect(200));
    await ageRotations();

    await refresh(laptop).expect(401); // replay: likely stolen
    await refresh(rotated).expect(401); // the laptop's whole session family is gone
    await refresh(phone).expect(200); // the phone stays signed in
  });

  it('keeps several devices signed in at once (P1-3)', async () => {
    const laptop = refreshCookie(await register());
    const phone = refreshCookie(await request(app).post('/api/v1/auth/login').send(creds).expect(200));
    await refresh(laptop).expect(200);
    await refresh(phone).expect(200);
    const user = await User.findOne({ email: creds.email }).select('+refreshSessions');
    expect(user!.refreshSessions).toHaveLength(2);
  });

  it('two tabs refreshing with the same cookie at once both succeed (P1-3)', async () => {
    const raw = refreshCookie(await register());
    const [a, b] = await Promise.all([refresh(raw), refresh(raw)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body.data.token).toEqual(expect.any(String));
    expect(b.body.data.token).toEqual(expect.any(String));
    // Exactly one rotated (and set the new cookie); the other used the grace window and set none.
    const cookies = [a, b].map((r) => ([] as string[]).concat(r.headers['set-cookie'] ?? []).find((c) => c.startsWith('refreshToken=')));
    expect(cookies.filter(Boolean)).toHaveLength(1);
    // The rotated cookie keeps working.
    await refresh(refreshCookie(cookies[0] ? a : b)).expect(200);
  });

  it(`keeps at most ${MAX_SESSIONS} sessions, dropping the oldest`, async () => {
    const first = refreshCookie(await register());
    for (let i = 0; i < MAX_SESSIONS; i++) await request(app).post('/api/v1/auth/login').send(creds).expect(200);
    const user = await User.findOne({ email: creds.email }).select('+refreshSessions');
    expect(user!.refreshSessions).toHaveLength(MAX_SESSIONS);
    await refresh(first).expect(401);
  });

  it('change-password signs out the other devices but keeps this one', async () => {
    const laptop = await register();
    const phone = refreshCookie(await request(app).post('/api/v1/auth/login').send(creds).expect(200));
    const changed = await request(app)
      .put('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${laptop.body.data.token}`)
      .send({ currentPassword: STRONG_PASSWORD, newPassword: 'Another 1Strong' })
      .expect(200);
    await refresh(phone).expect(401);
    await refresh(refreshCookie(changed)).expect(200);
  });

  it('rejects a missing or forged token', async () => {
    expect((await refresh()).status).toBe(401);
    expect((await refresh('not-a-jwt')).status).toBe(401);
  });

  it('logout revokes the refresh token and clears the cookie', async () => {
    const raw = refreshCookie(await register());
    const res = await request(app).post('/api/v1/auth/logout').set('Cookie', `refreshToken=${raw}`);
    expect(res.status).toBe(200);
    expect(([] as string[]).concat(res.headers['set-cookie']).join(';')).toMatch(/refreshToken=;/);
    expect((await refresh(raw)).status).toBe(401);
    expect((await User.findOne({ email: creds.email }).select('+refreshSessions'))!.refreshSessions).toEqual([]);
  });

  it('login rejects deactivated accounts', async () => {
    await register();
    await User.updateOne({ email: creds.email }, { isActive: false });
    const res = await request(app).post('/api/v1/auth/login').send(creds);
    expect(res.status).toBe(403);
  });
});
