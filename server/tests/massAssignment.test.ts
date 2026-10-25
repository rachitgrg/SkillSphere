import request from 'supertest';
import app from '../src/app';
import ClientProfile from '../src/models/ClientProfile';
import FreelancerProfile from '../src/models/FreelancerProfile';
import Gig from '../src/models/Gig';
import User from '../src/models/User';
import { GigStatus, UserRole } from '../src/types';
import { createUser } from './helpers';

const gigBody = {
  title: 'Landing page',
  description: 'A simple landing page',
  category: 'Web Development',
  skills: ['HTML', 'CSS'],
  budgetType: 'fixed' as const,
  budgetMin: 2000,
  budgetMax: 5000,
  duration: '1 week',
  experienceLevel: 'entry' as const,
};

describe('mass assignment (C8)', () => {
  it('freelancers cannot set their own rating, reviews or earnings', async () => {
    const freelancer = await createUser(UserRole.FREELANCER);
    const res = await request(app)
      .put('/api/v1/users/freelancers/me')
      .set(freelancer.auth)
      .send({
        title: 'Senior React Developer',
        hourlyRate: 1500,
        averageRating: 5,
        totalReviews: 999,
        totalEarnings: 10_000_000,
        completedGigs: 50,
        user: '000000000000000000000000',
      });
    expect(res.status).toBe(200);

    const profile = await FreelancerProfile.findOne({ user: freelancer.user._id });
    expect(profile!.title).toBe('Senior React Developer');
    expect(profile!.hourlyRate).toBe(1500);
    expect(profile!.averageRating).toBe(0);
    expect(profile!.totalReviews).toBe(0);
    expect(profile!.totalEarnings).toBe(0);
    expect(profile!.completedGigs).toBe(0);
  });

  it('freelancers can update the allowed profile sections', async () => {
    const freelancer = await createUser(UserRole.FREELANCER);
    const res = await request(app)
      .put('/api/v1/users/freelancers/me')
      .set(freelancer.auth)
      .send({
        skills: [{ name: 'React', proficiency: 'expert', yearsOfExperience: 4 }],
        workExperience: [{ title: 'Dev', company: 'Acme', startDate: '2022-01-01', description: 'Built things' }],
        availabilitySlots: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.skills[0].name).toBe('React');
    expect(res.body.data.workExperience).toHaveLength(1);
  });

  it('clients cannot set totalSpent or paymentVerified', async () => {
    const client = await createUser(UserRole.CLIENT);
    const res = await request(app)
      .put('/api/v1/users/clients/me')
      .set(client.auth)
      .send({ companyName: 'Acme', totalSpent: 1e9, paymentVerified: true, averageRating: 5 });
    expect(res.status).toBe(200);
    const profile = await ClientProfile.findOne({ user: client.user._id });
    expect(profile!.companyName).toBe('Acme');
    expect(profile!.totalSpent).toBe(0);
    expect(profile!.paymentVerified).toBe(false);
  });

  it('users cannot change their role or verification via profile update', async () => {
    const freelancer = await createUser(UserRole.FREELANCER, { isVerified: false });
    const res = await request(app)
      .put('/api/v1/users/me')
      .set(freelancer.auth)
      .send({ bio: 'Hi', role: 'admin', isVerified: true, isBanned: false });
    expect(res.status).toBe(200);
    const user = await User.findById(freelancer.user._id);
    expect(user!.bio).toBe('Hi');
    expect(user!.role).toBe(UserRole.FREELANCER);
    expect(user!.isVerified).toBe(false);
  });

  it('profile location must be a valid GeoJSON point', async () => {
    const freelancer = await createUser(UserRole.FREELANCER);
    const bad = await request(app)
      .put('/api/v1/users/me')
      .set(freelancer.auth)
      .send({ location: { type: 'Point', coordinates: [500, 12] } });
    expect(bad.status).toBe(400);

    const good = await request(app)
      .put('/api/v1/users/me')
      .set(freelancer.auth)
      .send({ location: { type: 'Point', coordinates: [77.59, 12.97] } });
    expect(good.status).toBe(200);
  });

  it('gig creation ignores status, views and client', async () => {
    const client = await createUser(UserRole.CLIENT);
    const other = await createUser(UserRole.CLIENT);
    const res = await request(app)
      .post('/api/v1/gigs')
      .set(client.auth)
      .send({ ...gigBody, status: GigStatus.COMPLETED, views: 123456, client: other.user.id, totalProposals: 40 });
    expect(res.status).toBe(201);
    const gig = await Gig.findById(res.body.data._id);
    expect(gig!.status).not.toBe(GigStatus.COMPLETED);
    expect(gig!.views).toBe(0);
    expect(gig!.totalProposals).toBe(0);
    expect(gig!.client.toString()).toBe(client.user.id);
  });

  it('gig owners cannot set status, views or selectedFreelancer on update', async () => {
    const client = await createUser(UserRole.CLIENT);
    const freelancer = await createUser(UserRole.FREELANCER);
    const gig = await Gig.create({ ...gigBody, client: client.user._id, status: GigStatus.OPEN });

    const res = await request(app)
      .put(`/api/v1/gigs/${gig.id}`)
      .set(client.auth)
      .send({ title: 'Updated', status: GigStatus.COMPLETED, views: 123456, selectedFreelancer: freelancer.user.id });
    expect(res.status).toBe(200);

    const updated = await Gig.findById(gig._id);
    expect(updated!.title).toBe('Updated');
    expect(updated!.status).toBe(GigStatus.OPEN);
    expect(updated!.views).toBe(0);
    expect(updated!.selectedFreelancer).toBeUndefined();
  });

  it('gigs cannot be edited once work has started', async () => {
    const client = await createUser(UserRole.CLIENT);
    const gig = await Gig.create({ ...gigBody, client: client.user._id, status: GigStatus.IN_PROGRESS });
    const res = await request(app).put(`/api/v1/gigs/${gig.id}`).set(client.auth).send({ title: 'Changed' });
    expect(res.status).toBe(409);
  });

  it('gig update still enforces budgetMax >= budgetMin', async () => {
    const client = await createUser(UserRole.CLIENT);
    const gig = await Gig.create({ ...gigBody, client: client.user._id, status: GigStatus.OPEN });
    const res = await request(app).put(`/api/v1/gigs/${gig.id}`).set(client.auth).send({ budgetMax: 100 });
    expect(res.status).toBe(400);
  });
});
