import request from 'supertest';
import app from '../src/app';

describe('env loading and CORS (C4)', () => {
  it('allows the configured client origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not allow other origins', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://evil.example');
    expect(res.headers['access-control-allow-origin']).not.toBe('http://evil.example');
  });
});

describe('env validation', () => {
  const load = (overrides: Record<string, string | undefined>) => {
    const saved = { ...process.env };
    Object.assign(process.env, overrides);
    try {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolateModules needs a sync require
        require('../src/config/env');
      });
    } finally {
      process.env = saved;
    }
  };

  it('rejects short JWT secrets', () => {
    expect(() => load({ JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('refuses placeholder secrets in production', () => {
    expect(() =>
      load({ NODE_ENV: 'production', JWT_SECRET: 'your_jwt_secret_key_here_padded_to_32_chars!!' })
    ).toThrow(/placeholder/);
  });

  it('treats .env.example placeholders as "not configured"', () => {
    let features: Record<string, boolean> = {};
    const saved = { ...process.env };
    Object.assign(process.env, { RAZORPAY_KEY_ID: 'your_razorpay_key_id', RAZORPAY_KEY_SECRET: 'your_razorpay_key_secret' });
    try {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolateModules needs a sync require
        features = require('../src/config/env').features;
      });
    } finally {
      process.env = saved;
    }
    expect(features.razorpay).toBe(false);
  });
});
