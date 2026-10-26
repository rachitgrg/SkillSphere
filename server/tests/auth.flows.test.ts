import request from 'supertest';
import { authenticator } from 'otplib';
import app from '../src/app';
import { env } from '../src/config/env';
import User from '../src/models/User';
import { decrypt } from '../src/utils/crypto';
import { UserRole } from '../src/types';
import { createUser, STRONG_PASSWORD } from './helpers';

// Capture the tokens that would be emailed.
const sent: { kind: 'verify' | 'reset'; to: string; token: string }[] = [];
jest.mock('../src/utils/sendEmail', () => ({
  sendVerificationEmail: jest.fn(async (to: string, token: string) => void sent.push({ kind: 'verify', to, token })),
  sendPasswordResetEmail: jest.fn(async (to: string, token: string) => void sent.push({ kind: 'reset', to, token })),
  sendEmail: jest.fn(async () => undefined),
}));

beforeEach(() => {
  sent.length = 0;
});

const lastToken = (kind: 'verify' | 'reset') => sent.filter((s) => s.kind === kind).at(-1)!.token;

describe('email verification (4.1)', () => {
  const register = () =>
    request(app).post('/api/v1/auth/register').send({ firstName: 'Ira', lastName: 'Sen', email: 'ira@test.dev', password: STRONG_PASSWORD, role: 'client' });

  it('emails a token on register, stores only its hash, and verifies with it', async () => {
    const res = await register();
    expect(res.body.data.user.isVerified).toBe(false);
    const token = lastToken('verify');
    const stored = await User.findOne({ email: 'ira@test.dev' }).select('+emailVerificationToken');
    expect(stored!.emailVerificationToken).toBeDefined();
    expect(stored!.emailVerificationToken).not.toBe(token);

    const verify = await request(app).get(`/api/v1/auth/verify-email/${token}`);
    expect(verify.status).toBe(200);
    expect((await User.findOne({ email: 'ira@test.dev' }))!.isVerified).toBe(true);

    // Tokens are single use.
    expect((await request(app).get(`/api/v1/auth/verify-email/${token}`)).status).toBe(400);
  });

  it('unverified users cannot post gigs', async () => {
    const res = await register();
    const post = await request(app)
      .post('/api/v1/gigs')
      .set('Authorization', `Bearer ${res.body.data.token}`)
      .send({ title: 'Test gig title', description: 'd', category: 'Web', skills: ['React'], budgetType: 'fixed', budgetMin: 1, budgetMax: 2, duration: '1 week', experienceLevel: 'entry' });
    expect(post.status).toBe(403);
    expect(post.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('lets unverified users through when REQUIRE_EMAIL_VERIFICATION is off', async () => {
    const res = await register();
    env.REQUIRE_EMAIL_VERIFICATION = false;
    try {
      const post = await request(app)
        .post('/api/v1/gigs')
        .set('Authorization', `Bearer ${res.body.data.token}`)
        .send({ title: 'Test gig title', description: 'd', category: 'Web', skills: ['React'], budgetType: 'fixed', budgetMin: 1, budgetMax: 2, duration: '1 week', experienceLevel: 'entry' });
      expect(post.body.code).not.toBe('EMAIL_NOT_VERIFIED');
      expect((await request(app).get('/api/v1/auth/providers')).body.data.emailVerification).toBe(false);
    } finally {
      env.REQUIRE_EMAIL_VERIFICATION = true;
    }
  });

  it('resends a fresh link', async () => {
    const res = await register();
    await request(app).post('/api/v1/auth/resend-verification').set('Authorization', `Bearer ${res.body.data.token}`).expect(200);
    expect(sent.filter((s) => s.kind === 'verify')).toHaveLength(2);
  });
});

describe('password reset (4.1)', () => {
  it('always answers 200 and only emails existing accounts', async () => {
    const unknown = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'nobody@test.dev' });
    expect(unknown.status).toBe(200);
    expect(sent).toHaveLength(0);
  });

  it('resets the password and revokes existing sessions', async () => {
    const user = await createUser(UserRole.FREELANCER);
    await request(app).post('/api/v1/auth/login').send({ email: user.user.email, password: STRONG_PASSWORD });
    await request(app).post('/api/v1/auth/forgot-password').send({ email: user.user.email }).expect(200);

    const token = lastToken('reset');
    const reset = await request(app).post(`/api/v1/auth/reset-password/${token}`).send({ password: 'Brand New 1Pass' });
    expect(reset.status).toBe(200);
    expect((await User.findById(user.user._id).select('+refreshToken'))!.refreshToken).toBeUndefined();

    expect((await request(app).post('/api/v1/auth/login').send({ email: user.user.email, password: STRONG_PASSWORD })).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').send({ email: user.user.email, password: 'Brand New 1Pass' })).status).toBe(200);
    expect((await request(app).post(`/api/v1/auth/reset-password/${token}`).send({ password: 'Another 1Pass' })).status).toBe(400);
  });
});

describe('two-factor authentication (4.1)', () => {
  const enable2fa = async () => {
    const user = await createUser(UserRole.CLIENT);
    const setup = await request(app).post('/api/v1/auth/2fa/setup').set(user.auth);
    expect(setup.status).toBe(200);
    expect(setup.body.data.qrCode).toMatch(/^data:image\/png;base64,/);

    const stored = await User.findById(user.user._id).select('+twoFactorSecret');
    const secret = decrypt(stored!.twoFactorSecret!);
    expect(stored!.twoFactorSecret).not.toContain(secret); // encrypted at rest

    expect((await request(app).post('/api/v1/auth/2fa/enable').set(user.auth).send({ code: '000000' })).status).toBe(400);
    const enabled = await request(app).post('/api/v1/auth/2fa/enable').set(user.auth).send({ code: authenticator.generate(secret) });
    expect(enabled.status).toBe(200);
    expect(enabled.body.data.backupCodes).toHaveLength(8);
    return { user, secret, backupCodes: enabled.body.data.backupCodes as string[] };
  };

  const login = (email: string) => request(app).post('/api/v1/auth/login').send({ email, password: STRONG_PASSWORD });

  it('login asks for a code and issues no session until it is verified', async () => {
    const { user, secret } = await enable2fa();
    const first = await login(user.user.email);
    expect(first.body.data).toMatchObject({ twoFactorRequired: true });
    expect(first.body.data.token).toBeUndefined();
    expect(first.headers['set-cookie']).toBeUndefined();

    // The challenge token is not an access token.
    expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${first.body.data.tempToken}`)).status).toBe(401);

    expect((await request(app).post('/api/v1/auth/2fa/verify').send({ tempToken: first.body.data.tempToken, code: '123456' })).status).toBe(400);
    const verified = await request(app).post('/api/v1/auth/2fa/verify').send({ tempToken: first.body.data.tempToken, code: authenticator.generate(secret) });
    expect(verified.status).toBe(200);
    expect(verified.body.data.token).toEqual(expect.any(String));
  });

  it('backup codes work once', async () => {
    const { user, backupCodes } = await enable2fa();
    const challenge = async () => (await login(user.user.email)).body.data.tempToken;
    expect((await request(app).post('/api/v1/auth/2fa/verify').send({ tempToken: await challenge(), code: backupCodes[0] })).status).toBe(200);
    expect((await request(app).post('/api/v1/auth/2fa/verify').send({ tempToken: await challenge(), code: backupCodes[0] })).status).toBe(400);
  });

  it('disabling requires the password and a code', async () => {
    const { user, secret } = await enable2fa();
    expect((await request(app).post('/api/v1/auth/2fa/disable').set(user.auth).send({ password: 'wrong', code: authenticator.generate(secret) })).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/2fa/disable').set(user.auth).send({ password: STRONG_PASSWORD, code: authenticator.generate(secret) })).status).toBe(200);
    expect((await login(user.user.email)).body.data.token).toEqual(expect.any(String));
  });
});

describe('Google sign-in (4.1)', () => {
  it('reports the provider as disabled and answers 503 without keys', async () => {
    expect((await request(app).get('/api/v1/auth/providers')).body.data).toEqual({ google: false, emailVerification: true });
    expect((await request(app).get('/api/v1/auth/google')).status).toBe(503);
  });

  it('users who still need to choose a role pick it once, then get a profile', async () => {
    const user = await createUser(UserRole.FREELANCER, { needsRoleSelection: true });
    // Role-gated routes are blocked until the role is chosen.
    expect((await request(app).get('/api/v1/proposals/mine').set(user.auth)).status).toBe(403);

    const chosen = await request(app).post('/api/v1/auth/choose-role').set(user.auth).send({ role: 'client' });
    expect(chosen.status).toBe(200);
    expect(chosen.body.data.user.role).toBe('client');
    expect((await request(app).post('/api/v1/auth/choose-role').set(user.auth).send({ role: 'freelancer' })).status).toBe(409);
  });
});
