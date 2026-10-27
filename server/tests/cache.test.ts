import request from 'supertest';
import app from '../src/app';
import cacheService from '../src/services/cacheService';
import * as redisConfig from '../src/config/redis';
import { GigStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

/** Minimal stand-in for a connected node-redis client. */
const fakeRedis = () => {
  const store = new Map<string, string>();
  return {
    store,
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => void store.set(key, value)),
    del: jest.fn(async (keys: string[]) => keys.forEach((k) => store.delete(k))),
    async *scanIterator({ MATCH }: { MATCH: string }) {
      const prefix = MATCH.replace(/\*$/, '');
      for (const key of [...store.keys()]) if (key.startsWith(prefix)) yield key;
    },
  };
};

beforeEach(() => {
  cacheService.setEnabled(true);
  cacheService.clear();
});
afterEach(() => {
  cacheService.setEnabled(false);
  jest.restoreAllMocks();
});

describe('cacheService (4.16)', () => {
  it('memory backend: wrap computes once per key until it expires or is invalidated', async () => {
    const compute = jest.fn(async () => ({ n: 1 }));
    expect(await cacheService.wrap('search:a', 60, compute)).toEqual({ n: 1 });
    expect(await cacheService.wrap('search:a', 60, compute)).toEqual({ n: 1 });
    expect(compute).toHaveBeenCalledTimes(1);

    await cacheService.invalidate('search:');
    await cacheService.wrap('search:a', 60, compute);
    expect(compute).toHaveBeenCalledTimes(2);

    await cacheService.set('short', 1, 0);
    expect(await cacheService.get('short')).toBeUndefined();
  });

  it('redis backend: stores JSON with a TTL under the app prefix and invalidates by scan', async () => {
    const redis = fakeRedis();
    jest.spyOn(redisConfig, 'getRedis').mockReturnValue(redis as never);

    await cacheService.wrap('admin:stats', 60, async () => ({ users: 3 }));
    expect(redis.set).toHaveBeenCalledWith('skillsphere:admin:stats', '{"users":3}', { EX: 60 });
    expect(await cacheService.get('admin:stats')).toEqual({ users: 3 });

    await cacheService.invalidate('admin:');
    expect(redis.store.size).toBe(0);
  });

  it('treats Redis failures as cache misses', async () => {
    const redis = fakeRedis();
    redis.get.mockRejectedValue(new Error('connection lost'));
    redis.set.mockRejectedValue(new Error('connection lost'));
    jest.spyOn(redisConfig, 'getRedis').mockReturnValue(redis as never);

    await expect(cacheService.wrap('trending:30', 60, async () => ['React'])).resolves.toEqual(['React']);
  });
});

describe('cached endpoints', () => {
  it('admin stats are cached and refreshed when a gig is approved', async () => {
    const admin = await createUser(UserRole.ADMIN);
    const client = await createUser(UserRole.CLIENT);
    const gig = await createGig(client.user._id, { status: GigStatus.PENDING_APPROVAL });

    const first = await request(app).get('/api/v1/admin/stats').set(admin.auth).expect(200);
    expect(first.body.data.gigs.pendingApproval).toBe(1);

    await createGig(client.user._id, { status: GigStatus.PENDING_APPROVAL });
    const cached = await request(app).get('/api/v1/admin/stats').set(admin.auth).expect(200);
    expect(cached.body.data.gigs.pendingApproval).toBe(1);

    await request(app).put(`/api/v1/admin/gigs/${gig._id}/approve`).set(admin.auth).expect(200);
    const fresh = await request(app).get('/api/v1/admin/stats').set(admin.auth).expect(200);
    expect(fresh.body.data.gigs.pendingApproval).toBe(1);
    expect(fresh.body.data.gigs.open).toBe(1);
  });

  it('an approved gig appears in cached gig search immediately', async () => {
    const admin = await createUser(UserRole.ADMIN);
    const client = await createUser(UserRole.CLIENT);
    const gig = await createGig(client.user._id, { status: GigStatus.PENDING_APPROVAL, title: 'Kotlin payments app' });

    const before = await request(app).get('/api/v1/search/gigs').query({ q: 'Kotlin' }).expect(200);
    expect(before.body.data).toHaveLength(0);

    await request(app).put(`/api/v1/admin/gigs/${gig._id}/approve`).set(admin.auth).expect(200);
    const after = await request(app).get('/api/v1/search/gigs').query({ q: 'Kotlin' }).expect(200);
    expect(after.body.data.map((g: { _id: string }) => g._id)).toEqual([gig.id]);
  });

  it('freelancer search refreshes after a profile edit', async () => {
    const freelancer = await createUser(UserRole.FREELANCER);
    const search = () => request(app).get('/api/v1/search/freelancers').query({ minRate: 500 }).expect(200);

    expect((await search()).body.data).toHaveLength(0);
    await request(app).put('/api/v1/users/freelancers/me').set(freelancer.auth).send({ hourlyRate: 800 }).expect(200);
    expect((await search()).body.data).toHaveLength(1);
  });
});
