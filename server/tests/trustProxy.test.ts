import express from 'express';
import request from 'supertest';
import { createLimiter } from '../src/middleware/rateLimiter';

/** A tiny app with the real app's proxy setting and a 2-request limiter that is active under test. */
const limitedApp = (trustProxy: number) => {
  const app = express();
  app.set('trust proxy', trustProxy);
  app.use(createLimiter(60_000, 2, 'Too many requests', { skip: () => false }));
  app.get('/', (req, res) => {
    res.json({ ip: req.ip });
  });
  return app;
};

describe('TRUST_PROXY (P1-1)', () => {
  it('the app sets trust proxy from TRUST_PROXY', () => {
    jest.isolateModules(() => {
      process.env.TRUST_PROXY = '1';
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const app = (require('../src/app') as typeof import('../src/app')).default;
        expect(app.get('trust proxy')).toBe(1);
      } finally {
        delete process.env.TRUST_PROXY;
      }
    });
  });

  it('with one trusted hop, clients behind the proxy get separate rate-limit buckets', async () => {
    const app = limitedApp(1);
    const from = (ip: string) => request(app).get('/').set('X-Forwarded-For', ip);
    expect((await from('203.0.113.1').expect(200)).body.ip).toBe('203.0.113.1');
    await from('203.0.113.1').expect(200);
    await from('203.0.113.1').expect(429);
    await from('203.0.113.2').expect(200); // a different user is not throttled
  });

  it('without it, X-Forwarded-For is ignored and everyone shares the proxy bucket', async () => {
    const app = limitedApp(0);
    await request(app).get('/').set('X-Forwarded-For', '203.0.113.1').expect(200);
    await request(app).get('/').set('X-Forwarded-For', '203.0.113.2').expect(200);
    const third = await request(app).get('/').set('X-Forwarded-For', '203.0.113.3');
    expect(third.status).toBe(429);
    expect(third.body).toEqual({ success: false, message: 'Too many requests' });
  });
});
