import request from 'supertest';
import app from '../src/app';
import FreelancerProfile from '../src/models/FreelancerProfile';
import Gig from '../src/models/Gig';
import { GigStatus, UserRole } from '../src/types';
import { escapeRegex } from '../src/utils/helpers';
import { createUser } from './helpers';

describe('escapeRegex (C9)', () => {
  it('matches metacharacters literally', () => {
    for (const s of ['C++', 'C#', 'Node.js', '(a+)+$', '[x]']) {
      expect(new RegExp(`^${escapeRegex(s)}$`).test(s)).toBe(true);
    }
    expect(new RegExp(escapeRegex('Node.js')).test('Nodexjs')).toBe(false);
  });
});

describe('AI matching with special-character skills (C9)', () => {
  it('returns 200 for a gig with skills C++, C#, Node.js', async () => {
    const client = await createUser(UserRole.CLIENT);
    const freelancer = await createUser(UserRole.FREELANCER);
    await FreelancerProfile.updateOne(
      { user: freelancer.user._id },
      { skills: [{ name: 'C++', proficiency: 'expert', yearsOfExperience: 5 }] }
    );
    const gig = await Gig.create({
      client: client.user._id,
      title: 'Systems work',
      description: 'Low-level code',
      category: 'Software',
      skills: ['C++', 'C#', 'Node.js'],
      budgetType: 'fixed',
      budgetMin: 1000,
      budgetMax: 2000,
      duration: '1 month',
      experienceLevel: 'expert',
      status: GigStatus.OPEN,
    });

    const res = await request(app).get(`/api/v1/ai/gigs/${gig.id}/matches`).set(client.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
