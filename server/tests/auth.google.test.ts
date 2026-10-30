import type { Request } from 'express';
import type { Profile } from 'passport-google-oauth20';
import passport from 'passport';
import request from 'supertest';
import app from '../src/app';
import { env, features } from '../src/config/env';
import { cookieStateStore, findOrCreateGoogleUser } from '../src/config/passport';
import User from '../src/models/User';
import { UserRole } from '../src/types';
import { createUser } from './helpers';

const profile = (email: string, verified: boolean, id = 'g-1'): Profile =>
  ({ id, displayName: 'Asha Rao', name: { givenName: 'Asha', familyName: 'Rao' }, emails: [{ value: email, verified }], photos: [], provider: 'google' }) as unknown as Profile;

describe('Google account linking (P2-9)', () => {
  it('links an existing account only when Google has verified the email', async () => {
    const { user } = await createUser(UserRole.CLIENT);
    const refused = await findOrCreateGoogleUser(profile(user.email, false));
    expect(refused).toEqual({ error: expect.stringMatching(/Verify your email with Google/) });
    expect((await User.findById(user._id))!.googleId).toBeUndefined();

    const linked = await findOrCreateGoogleUser(profile(user.email, true));
    expect('user' in linked && linked.user._id.equals(user._id)).toBe(true);
    expect((await User.findById(user._id))!.googleId).toBe('g-1');
  });

  it('new Google users are verified only if Google says so', async () => {
    const a = await findOrCreateGoogleUser(profile('new-verified@test.dev', true, 'g-2'));
    const b = await findOrCreateGoogleUser(profile('new-unverified@test.dev', false, 'g-3'));
    expect('user' in a && a.user.isVerified).toBe(true);
    expect('user' in b && b.user.isVerified).toBe(false);
  });

  it('the callback shows the reason for a refusal', async () => {
    const authenticate = jest
      .spyOn(passport, 'authenticate')
      .mockImplementation(((_n: string, _o: unknown, done: (e: null, u: false, i: { message: string }) => void) => () =>
        done(null, false, { message: 'Verify your email with Google first, or sign in with your password' })) as never);
    features.google = true;
    try {
      const res = await request(app).get('/api/v1/auth/google/callback').expect(302);
      expect(decodeURIComponent(res.headers.location)).toBe(`${env.CLIENT_URL}/oauth/callback?error=Verify your email with Google first, or sign in with your password`);
    } finally {
      features.google = false;
      authenticate.mockRestore();
    }
  });
});

describe('OAuth state without sessions (P2-9)', () => {
  const fakeReq = (cookies: Record<string, string> = {}) => {
    const res = { cookie: jest.fn(), clearCookie: jest.fn() };
    return { req: { cookies, res } as unknown as Request, res };
  };

  it('stores a random nonce in an httpOnly cookie and accepts it once on the callback', async () => {
    const start = fakeReq();
    const state = await new Promise<string>((resolve) => cookieStateStore.store(start.req, (_e, s) => resolve(s!)));
    expect(state).toMatch(/^[a-f0-9]{48}$/);
    expect(start.res.cookie).toHaveBeenCalledWith('oauthState', state, expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/api/v1/auth/google' }));

    const back = fakeReq({ oauthState: state });
    const ok = await new Promise<boolean>((resolve) => cookieStateStore.verify(back.req, state, (_e, v) => resolve(v)));
    expect(ok).toBe(true);
    expect(back.res.clearCookie).toHaveBeenCalledWith('oauthState', expect.anything());
  });

  it('rejects a missing or different state (login CSRF)', async () => {
    const verify = (cookies: Record<string, string>, state: string) =>
      new Promise<{ ok: boolean; message?: string }>((resolve) =>
        cookieStateStore.verify(fakeReq(cookies).req, state, (_e, ok, info) => resolve({ ok, message: info?.message }))
      );
    expect(await verify({}, 'a'.repeat(48))).toMatchObject({ ok: false, message: expect.stringMatching(/expired or was started elsewhere/) });
    expect((await verify({ oauthState: 'b'.repeat(48) }, 'a'.repeat(48))).ok).toBe(false);
    expect((await verify({ oauthState: 'short' }, 'a'.repeat(48))).ok).toBe(false);
  });
});
