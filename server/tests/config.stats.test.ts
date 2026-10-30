import request from 'supertest';
import app from '../src/app';
import FreelancerProfile from '../src/models/FreelancerProfile';
import cacheService from '../src/services/cacheService';
import { GigStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

describe('GET /config/stats (P3-7)', () => {
  beforeEach(() => cacheService.invalidate('config:'));

  it('returns live public counts without login', async () => {
    const client = await createUser(UserRole.CLIENT);
    const verified = await createUser(UserRole.FREELANCER);
    await createUser(UserRole.FREELANCER);
    await FreelancerProfile.updateOne({ user: verified.user._id }, { 'verification.status': 'verified' });
    await createGig(client.user._id, { category: 'Web Development' });
    await createGig(client.user._id, { category: 'Web Development' });
    await createGig(client.user._id, { category: 'UI/UX Design' });
    await createGig(client.user._id, { category: 'Web Development', visibility: 'private' }); // not public
    await createGig(client.user._id, { status: GigStatus.COMPLETED });
    await createGig(client.user._id, { status: GigStatus.PENDING_APPROVAL });

    const res = await request(app).get('/api/v1/config/stats').expect(200);
    expect(res.body.data).toEqual({
      openGigs: 3,
      verifiedFreelancers: 1,
      completedProjects: 1,
      averageRating: null,
      categories: [
        { category: 'Web Development', openGigs: 2 },
        { category: 'UI/UX Design', openGigs: 1 },
      ],
    });
  });
});
