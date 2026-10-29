import request from 'supertest';
import app from '../src/app';
import { STRONG_PASSWORD, createUser } from './helpers';
import { UserRole } from '../src/types';

const CLIENT = 'http://localhost:5173'; // tests/env.ts CLIENT_URL

const loginCookie = async () => {
  const { user } = await createUser(UserRole.CLIENT);
  const res = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: STRONG_PASSWORD }).expect(200);
  return ([] as string[]).concat(res.headers['set-cookie']).find((c) => c.startsWith('refreshToken='))!.split(';')[0];
};

describe('CSRF guard on cookie-authenticated endpoints', () => {
  it('refuses refresh and logout from another origin or referer', async () => {
    const cookie = await loginCookie();
    for (const path of ['/api/v1/auth/refresh', '/api/v1/auth/logout']) {
      await request(app).post(path).set('Cookie', cookie).set('Origin', 'https://evil.example').expect(403);
      await request(app).post(path).set('Cookie', cookie).set('Referer', 'https://evil.example/page').expect(403);
    }
  });

  it('allows the SPA origin and non-browser clients without Origin/Referer', async () => {
    const cookie = await loginCookie();
    await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).set('Origin', CLIENT).expect(200);
    const again = await loginCookie();
    await request(app).post('/api/v1/auth/refresh').set('Cookie', again).expect(200);
  });
});

describe('security headers', () => {
  it('API responses carry a deny-all CSP and the usual helmet headers', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['content-security-policy']).toBe("default-src 'none';frame-ancestors 'none';base-uri 'none';form-action 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('Swagger UI gets a policy that lets it load its own assets', async () => {
    const res = await request(app).get('/api/docs/');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
  });
});

describe('COOKIE_SAMESITE', () => {
  it('none forces Secure on the refresh cookie', () => {
    jest.isolateModules(() => {
      process.env.COOKIE_SAMESITE = 'none';
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { setRefreshCookie } = require('../src/utils/generateToken') as typeof import('../src/utils/generateToken');
        const cookie = jest.fn();
        setRefreshCookie({ cookie } as never, 'token');
        expect(cookie).toHaveBeenCalledWith('refreshToken', 'token', expect.objectContaining({ sameSite: 'none', secure: true, httpOnly: true }));
      } finally {
        delete process.env.COOKIE_SAMESITE;
      }
    });
  });
});
