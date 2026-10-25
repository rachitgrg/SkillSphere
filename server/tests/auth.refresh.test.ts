import request from 'supertest';
import app from '../src/app';
import User from '../src/models/User';
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
    const user = await User.findOne({ email: creds.email }).select('+refreshToken');
    expect(user!.refreshToken).toBe(hashToken(raw));
    expect(user!.refreshToken).not.toBe(raw);
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

  it('rejects reuse of an old refresh token and revokes the session', async () => {
    const original = refreshCookie(await register());
    const rotated = refreshCookie(await refresh(original));

    const reuse = await refresh(original);
    expect(reuse.status).toBe(401);

    // The legitimate (rotated) token is revoked too, forcing a fresh login.
    const after = await refresh(rotated);
    expect(after.status).toBe(401);
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
  });

  it('login rejects deactivated accounts', async () => {
    await register();
    await User.updateOne({ email: creds.email }, { isActive: false });
    const res = await request(app).post('/api/v1/auth/login').send(creds);
    expect(res.status).toBe(403);
  });
});
