import request from 'supertest';
import app from '../src/app';
import FreelancerProfile from '../src/models/FreelancerProfile';
import User from '../src/models/User';
import { UserRole } from '../src/types';
import { createUser } from './helpers';

const PUNE = { type: 'Point', coordinates: [73.8567, 18.5204] };
const DELHI = { type: 'Point', coordinates: [77.209, 28.6139] };
const coords = (doc: { location?: { coordinates?: number[] } } | null) => doc?.location?.coordinates;

describe('one source of truth for a freelancer location (P2-13)', () => {
  it('PUT /users/freelancers/me updates the profile and copies it to the account', async () => {
    const { user, auth } = await createUser(UserRole.FREELANCER);
    await request(app).put('/api/v1/users/freelancers/me').set(auth).send({ location: PUNE }).expect(200);
    expect(coords(await FreelancerProfile.findOne({ user: user._id }).lean())).toEqual(PUNE.coordinates);
    expect(coords(await User.findById(user._id).lean())).toEqual(PUNE.coordinates);
  });

  it('PUT /users/me from a freelancer also moves the profile (what search uses)', async () => {
    const { user, auth } = await createUser(UserRole.FREELANCER);
    await request(app).put('/api/v1/users/me').set(auth).send({ location: DELHI }).expect(200);
    expect(coords(await FreelancerProfile.findOne({ user: user._id }).lean())).toEqual(DELHI.coordinates);

    const near = await request(app).get('/api/v1/search/freelancers').query({ lat: 28.61, lng: 77.2, radiusKm: 10 }).expect(200);
    expect(near.body.data.map((f: { user: { _id: string } | string }) => (typeof f.user === 'string' ? f.user : f.user._id))).toContain(user.id);
  });

  it("a client's location stays on the account", async () => {
    const { user, auth } = await createUser(UserRole.CLIENT);
    await request(app).put('/api/v1/users/me').set(auth).send({ location: PUNE }).expect(200);
    expect(coords(await User.findById(user._id).lean())).toEqual(PUNE.coordinates);
  });
});
