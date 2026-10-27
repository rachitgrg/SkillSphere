import request from 'supertest';
import app from '../src/app';
import Payment from '../src/models/Payment';
import ProfileView from '../src/models/ProfileView';
import Review from '../src/models/Review';
import { GigStatus, PaymentStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

const categories = { quality: 5, communication: 4, timeliness: 5, professionalism: 4, value: 4 };

describe('profile views (4.15)', () => {
  it('counts each viewer once per day and ignores the freelancer viewing their own profile', async () => {
    const freelancer = await createUser(UserRole.FREELANCER);
    const client = await createUser(UserRole.CLIENT);
    const url = `/api/v1/users/freelancers/${freelancer.user._id}`;

    await request(app).get(url).set(client.auth).expect(200);
    await request(app).get(url).set(client.auth).expect(200);
    await request(app).get(url).set(freelancer.auth).expect(200);
    await request(app).get(url).set('User-Agent', 'visitor-a').expect(200);
    await request(app).get(url).set('User-Agent', 'visitor-a').expect(200);
    await request(app).get(url).set('User-Agent', 'visitor-b').expect(200);

    const docs = await ProfileView.find({ freelancer: freelancer.user._id });
    expect(docs).toHaveLength(1);
    expect(docs[0].count).toBe(3);

    const res = await request(app).get('/api/v1/analytics/freelancer?period=30d').set(freelancer.auth).expect(200);
    expect(res.body.data.profileViews.total).toBe(3);
    expect(res.body.data.profileViews.series).toHaveLength(31);
    expect(res.body.data.profileViews.series.at(-1).views).toBe(3);
    expect(JSON.stringify(res.body.data)).not.toContain('viewers');
  });

  it('groups views by month for the 12m period', async () => {
    const freelancer = await createUser(UserRole.FREELANCER);
    const lastMonth = new Date();
    lastMonth.setUTCDate(1);
    lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
    lastMonth.setUTCHours(0, 0, 0, 0);
    await ProfileView.create([
      { freelancer: freelancer.user._id, day: lastMonth, count: 4 },
      { freelancer: freelancer.user._id, day: new Date(lastMonth.getTime() + 86_400_000), count: 2 },
    ]);
    const res = await request(app).get('/api/v1/analytics/freelancer?period=12m').set(freelancer.auth).expect(200);
    expect(res.body.data.profileViews).toEqual({ total: 6, series: [{ date: lastMonth.toISOString().slice(0, 7), views: 6 }] });
  });
});

describe('GET /api/v1/analytics/freelancer', () => {
  it('returns recent client comments with the feedback breakdown', async () => {
    const freelancer = await createUser(UserRole.FREELANCER);
    const client = await createUser(UserRole.CLIENT);
    const gig = await createGig(client.user._id, { status: GigStatus.COMPLETED, selectedFreelancer: freelancer.user._id });
    await Review.create({ gig: gig._id, reviewer: client.user._id, reviewee: freelancer.user._id, categories, comment: 'Shipped early, clean code.' });

    const res = await request(app).get('/api/v1/analytics/freelancer').set(freelancer.auth).expect(200);
    expect(res.body.data.feedback.totalReviews).toBe(1);
    expect(res.body.data.feedback.recentReviews[0]).toMatchObject({
      comment: 'Shipped early, clean code.',
      reviewer: { firstName: client.user.firstName },
      gig: { title: gig.title },
    });
    expect(res.body.data.topSkills).toEqual([{ skill: 'React', count: 1 }]);
  });
});

describe('GET /api/v1/analytics/client', () => {
  it('lists the freelancers the client paid most', async () => {
    const client = await createUser(UserRole.CLIENT);
    const [a, b] = [await createUser(UserRole.FREELANCER), await createUser(UserRole.FREELANCER)];
    const gig = await createGig(client.user._id, { status: GigStatus.IN_PROGRESS, selectedFreelancer: a.user._id });
    const paid = (freelancer: typeof a, amount: number) =>
      Payment.create({ gig: gig._id, client: client.user._id, freelancer: freelancer.user._id, amount, status: PaymentStatus.RELEASED, releasedAt: new Date() });
    await paid(a, 3000);
    await paid(a, 2000);
    await paid(b, 8000);

    const res = await request(app).get('/api/v1/analytics/client?period=30d').set(client.auth).expect(200);
    expect(res.body.data.spending.total).toBe(13000);
    expect(res.body.data.topFreelancers.map((t: { total: number; payments: number }) => [t.total, t.payments])).toEqual([[8000, 1], [5000, 2]]);
    expect(res.body.data.topFreelancers[0].freelancer).toMatchObject({ firstName: b.user.firstName });
    expect(res.body.data.topFreelancers[0].freelancer.email).toBeUndefined();
  });
});
