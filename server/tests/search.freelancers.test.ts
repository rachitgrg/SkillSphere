import request from 'supertest';
import app from '../src/app';
import FreelancerProfile from '../src/models/FreelancerProfile';
import { UserRole } from '../src/types';
import { createGig, createUser } from './helpers';
import { env } from '../src/config/env';
import searchService from '../src/services/searchService';

describe('GET /api/v1/search/freelancers?q= (C10)', () => {
  it('returns 200 and ranks text matches', async () => {
    const reactDev = await createUser(UserRole.FREELANCER);
    const designer = await createUser(UserRole.FREELANCER);
    await FreelancerProfile.updateOne(
      { user: reactDev.user._id },
      { title: 'Frontend Engineer', skills: [{ name: 'React', proficiency: 'expert' }] }
    );
    await FreelancerProfile.updateOne(
      { user: designer.user._id },
      { title: 'Brand Designer', skills: [{ name: 'Figma', proficiency: 'advanced' }] }
    );

    const res = await request(app).get('/api/v1/search/freelancers').query({ q: 'react' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].user._id).toBe(reactDev.user.id);
  });
});

describe('advanced search (4.10)', () => {
  const DELHI: [number, number] = [77.2167, 28.6315];
  const NOIDA: [number, number] = [77.391, 28.5355]; // ~20 km
  const MUMBAI: [number, number] = [72.8777, 19.076];

  const make = async (coords: [number, number], extra: Record<string, unknown> = {}) => {
    const f = await createUser(UserRole.FREELANCER);
    await FreelancerProfile.updateOne(
      { user: f.user._id },
      { $set: { title: 'React developer', skills: [{ name: 'React', proficiency: 'expert', yearsOfExperience: 4 }], location: { type: 'Point', coordinates: coords }, ...extra } }
    );
    return f;
  };

  it('filters by radius, sorts by distance and returns distanceKm', async () => {
    const near = await make(DELHI);
    const mid = await make(NOIDA, { availability: 'busy' });
    await make(MUMBAI);

    const res = await request(app).get(`/api/v1/search/freelancers?lat=${DELHI[1]}&lng=${DELHI[0]}&radiusKm=30&sort=distance`).expect(200);
    expect(res.body.data.map((f: { user: { _id: string } }) => f.user._id)).toEqual([near.user.id, mid.user.id]);
    expect(res.body.data[0].distanceKm).toBe(0);
    expect(res.body.data[1].distanceKm).toBeGreaterThan(15);
    expect(res.body.data[0].distanceMeters).toBeUndefined();

    const available = await request(app).get(`/api/v1/search/freelancers?lat=${DELHI[1]}&lng=${DELHI[0]}&radiusKm=30&availability=available`).expect(200);
    expect(available.body.data).toHaveLength(1);

    // Text + geo falls back to a regex (no $text inside $geoNear).
    const text = await request(app).get(`/api/v1/search/freelancers?q=react&lat=${DELHI[1]}&lng=${DELHI[0]}&radiusKm=30`).expect(200);
    expect(text.body.pagination.total).toBe(2);
    expect(text.body.data[0].user.email).toBeUndefined();
    expect(text.body.data[0].user.notificationPreferences).toBeUndefined();
  });

  it('finds gigs near me', async () => {
    const c = await createUser(UserRole.CLIENT);
    await createGig(c.user._id, { title: 'Onsite Delhi', locationType: 'onsite', location: { type: 'Point', coordinates: NOIDA } });
    await createGig(c.user._id, { title: 'Onsite Mumbai', locationType: 'onsite', location: { type: 'Point', coordinates: MUMBAI } });
    await createGig(c.user._id, { title: 'Remote' });
    const res = await request(app).get(`/api/v1/gigs?lat=${DELHI[1]}&lng=${DELHI[0]}&radiusKm=30`).expect(200);
    expect(res.body.data.map((g: { title: string }) => g.title)).toEqual(['Onsite Delhi']);
  });

  it('builds an Atlas $search stage when enabled', () => {
    env.USE_ATLAS_SEARCH = true;
    try {
      const pipeline = searchService.buildFreelancerPipeline({ q: 'react', lat: '28.6', lng: '77.2' }, 1, 10);
      expect(pipeline[0]).toHaveProperty('$search.compound.filter.0.geoWithin.circle.radius', 25_000);
      expect(JSON.stringify(pipeline)).not.toContain('$text');
    } finally {
      env.USE_ATLAS_SEARCH = false;
    }
  });
});
