import request from 'supertest';
import app from '../src/app';
import FreelancerProfile from '../src/models/FreelancerProfile';
import { UserRole } from '../src/types';
import { createUser } from './helpers';

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
