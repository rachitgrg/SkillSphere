import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';

describe('test harness', () => {
  it('serves /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, database: 'connected' });
  });

  it('/health answers 503 when the database is down, so the host restarts the instance (P3-14)', async () => {
    const { host, port, name } = mongoose.connection;
    await mongoose.disconnect();
    try {
      const res = await request(app).get('/health');
      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ success: false, database: 'disconnected' });
    } finally {
      await mongoose.connect(`mongodb://${host}:${port}/${name}`);
    }
    expect((await request(app).get('/health')).status).toBe(200);
  });

  it('uses the in-memory database', () => {
    expect(mongoose.connection.host).toMatch(/127\.0\.0\.1|localhost/);
  });
});
