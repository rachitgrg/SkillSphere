import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';

describe('test harness', () => {
  it('serves /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('uses the in-memory database', () => {
    expect(mongoose.connection.host).toMatch(/127\.0\.0\.1|localhost/);
  });
});
