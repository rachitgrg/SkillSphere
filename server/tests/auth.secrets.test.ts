import request from 'supertest';
import app from '../src/app';
import User from '../src/models/User';
import { STRONG_PASSWORD } from './helpers';

const SECRET_KEYS = [
  'password',
  'refreshToken',
  'refreshSessions',
  'twoFactorSecret',
  'passwordResetToken',
  'passwordResetExpires',
  'emailVerificationToken',
  'emailVerificationExpires',
  '__v',
];

const expectNoSecrets = (user: Record<string, unknown>) => {
  for (const key of SECRET_KEYS) expect(user).not.toHaveProperty(key);
};

describe('auth responses never contain secrets (C2)', () => {
  const body = { firstName: 'Ravi', lastName: 'K', email: 'ravi@test.dev', password: STRONG_PASSWORD, role: 'client' };

  it('register response', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(body);
    expect(res.status).toBe(201);
    expectNoSecrets(res.body.data.user);
    expect(JSON.stringify(res.body)).not.toContain('$2a$');
  });

  it('login and /me responses', async () => {
    await request(app).post('/api/v1/auth/register').send(body);
    await User.updateOne(
      { email: body.email },
      { twoFactorSecret: 'SECRET', passwordResetToken: 'tok', emailVerificationToken: 'tok' }
    );

    const login = await request(app).post('/api/v1/auth/login').send({ email: body.email, password: STRONG_PASSWORD });
    expect(login.status).toBe(200);
    expectNoSecrets(login.body.data.user);
    expect(JSON.stringify(login.body)).not.toContain('$2a$');

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.data.token}`);
    expect(me.status).toBe(200);
    expectNoSecrets(me.body.data);
  });
});
