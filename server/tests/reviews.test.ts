import request from 'supertest';
import app from '../src/app';
import FreelancerProfile from '../src/models/FreelancerProfile';
import Review from '../src/models/Review';
import Notification from '../src/models/Notification';
import User from '../src/models/User';
import { computeReputation } from '../src/services/reputationService';
import { amountRange } from '../src/controllers/reviewController';
import { GigStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

const categories = { quality: 5, communication: 4, timeliness: 5, professionalism: 4, value: 4 };
const expectedRating = Math.round((5 * 0.3 + 4 * 0.2 + 5 * 0.2 + 4 * 0.15 + 4 * 0.15) * 100) / 100;

const review = (auth: Record<string, string>, body: Record<string, unknown>) =>
  request(app).post('/api/v1/reviews').set(auth).send(body);

const setup = async (status = GigStatus.COMPLETED) => {
  const client = await createUser(UserRole.CLIENT);
  const freelancer = await createUser(UserRole.FREELANCER);
  const outsider = await createUser(UserRole.FREELANCER);
  const gig = await createGig(client.user._id, { status, selectedFreelancer: freelancer.user._id });
  return { client, freelancer, outsider, gig };
};

describe('POST /api/v1/reviews (1.13)', () => {
  it('client reviews the freelancer; reviewee is derived and reputation is recomputed', async () => {
    const { client, freelancer, outsider, gig } = await setup();
    const res = await review(client.auth, { gigId: gig.id, categories, comment: 'Great work, delivered ahead of schedule.', revieweeId: outsider.user.id });
    expect(res.status).toBe(201);
    expect(res.body.data.reviewee).toBe(freelancer.user.id);
    expect(res.body.data.rating).toBe(expectedRating);

    const profile = await FreelancerProfile.findOne({ user: freelancer.user._id });
    expect(profile!.averageRating).toBe(expectedRating);
    expect(profile!.totalReviews).toBe(1);
    expect(await Notification.countDocuments({ recipient: freelancer.user._id })).toBe(1);
  });

  it('freelancer reviews the client', async () => {
    const { client, freelancer, gig } = await setup();
    const res = await review(freelancer.auth, { gigId: gig.id, categories, comment: 'Clear brief' });
    expect(res.status).toBe(201);
    expect(res.body.data.reviewee).toBe(client.user.id);
  });

  it('rejects reviewers who are not part of the gig', async () => {
    const { outsider, gig } = await setup();
    const res = await review(outsider.auth, { gigId: gig.id, categories, comment: 'Fake' });
    expect(res.status).toBe(403);
    expect(await Review.countDocuments()).toBe(0);
  });

  it('requires the gig to be completed', async () => {
    const { client, gig } = await setup(GigStatus.IN_PROGRESS);
    const res = await review(client.auth, { gigId: gig.id, categories, comment: 'Too early' });
    expect(res.status).toBe(409);
  });

  it('rejects a second review of the same gig', async () => {
    const { client, gig } = await setup();
    expect((await review(client.auth, { gigId: gig.id, categories, comment: 'One' })).status).toBe(201);
    expect((await review(client.auth, { gigId: gig.id, categories, comment: 'Two' })).status).toBe(409);
  });

  it('validates category scores', async () => {
    const { client, gig } = await setup();
    const res = await review(client.auth, { gigId: gig.id, categories: { ...categories, quality: 9 }, comment: 'x' });
    expect(res.status).toBe(400);
  });

  it('holds suspicious reviews for moderation and keeps them out of the rating', async () => {
    const client = await createUser(UserRole.CLIENT);
    const freelancer = await createUser(UserRole.FREELANCER);
    // Three completed gigs in a row trips the "rapid review" signal on the third review.
    const gigs = await Promise.all(
      [1, 2, 3].map(() => createGig(client.user._id, { status: GigStatus.COMPLETED, selectedFreelancer: freelancer.user._id }))
    );
    for (const [i, gig] of gigs.entries()) {
      await review(client.auth, { gigId: gig.id, categories, comment: `Solid delivery on project number ${i + 1}.` });
    }
    const fourth = await createGig(client.user._id, { status: GigStatus.COMPLETED, selectedFreelancer: freelancer.user._id });
    const res = await review(client.auth, {
      gigId: fourth.id,
      categories: { quality: 1, communication: 1, timeliness: 1, professionalism: 1, value: 1 },
      comment: 'Terrible experience, would not hire again.',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.isFlagged).toBe(true);
    expect(res.body.data.isVisible).toBe(false);

    const profile = await FreelancerProfile.findOne({ user: freelancer.user._id });
    expect(profile!.totalReviews).toBe(3);
    expect(profile!.averageRating).toBe(expectedRating);

    const publicList = await request(app).get(`/api/v1/reviews/user/${freelancer.user.id}`).set(client.auth);
    expect(publicList.body.data).toHaveLength(3);
  });
});

describe('POST /api/v1/reviews/:id/reply', () => {
  it('lets the reviewee reply once using the `response` field', async () => {
    const { client, freelancer, gig } = await setup();
    const created = await review(client.auth, { gigId: gig.id, categories, comment: 'Great' });
    const id = created.body.data._id;

    const reply = await request(app).post(`/api/v1/reviews/${id}/reply`).set(freelancer.auth).send({ response: 'Thank you!' });
    expect(reply.status).toBe(200);
    expect(reply.body.data.response).toBe('Thank you!');

    const again = await request(app).post(`/api/v1/reviews/${id}/reply`).set(freelancer.auth).send({ response: 'Again' });
    expect(again.status).toBe(400);
  });

  it('rejects replies from anyone but the reviewee', async () => {
    const { client, gig } = await setup();
    const created = await review(client.auth, { gigId: gig.id, categories, comment: 'Great' });
    const res = await request(app)
      .post(`/api/v1/reviews/${created.body.data._id}/reply`)
      .set(client.auth)
      .send({ response: 'Self reply' });
    expect(res.status).toBe(403);
  });
});

describe('reputation score and extra fraud signals (4.8)', () => {
  const establish = (userId: unknown) =>
    User.collection.updateOne({ _id: userId as never }, { $set: { createdAt: new Date(Date.now() - 30 * 86_400_000) } });

  it('ignores a shared loopback/private IP: everyone in local dev (or behind one proxy) has it', async () => {
    const { client, freelancer, gig } = await setup();
    await establish(client.user._id);
    await User.updateMany({ _id: { $in: [client.user._id, freelancer.user._id] } }, { $set: { lastLoginIp: '127.0.0.1' } });
    const res = await review(client.auth, { gigId: gig.id, categories, comment: 'ok' }).expect(201); // short comment = one weak signal
    expect(res.body.data.isFlagged).toBe(false);
    expect(res.body.data.isVisible).toBe(true);
    expect((await FreelancerProfile.findOne({ user: freelancer.user._id }))!.totalReviews).toBe(1);
  });

  it('a shared public IP is a weak signal: flags with a short comment, not on its own', async () => {
    const flagged = await setup();
    await establish(flagged.client.user._id);
    await User.updateMany({ _id: { $in: [flagged.client.user._id, flagged.freelancer.user._id] } }, { $set: { lastLoginIp: '203.0.113.9' } });
    const short = await review(flagged.client.auth, { gigId: flagged.gig.id, categories, comment: 'ok' });
    expect(short.body.data.isFlagged).toBe(true);
    expect(short.body.data.isVisible).toBe(false);
    expect(short.body.data.flagReason).toMatch(/share an IP.*Very short/);

    const alone = await setup();
    await establish(alone.client.user._id);
    await User.updateMany({ _id: { $in: [alone.client.user._id, alone.freelancer.user._id] } }, { $set: { lastLoginIp: '203.0.113.9' } });
    const res = await review(alone.client.auth, { gigId: alone.gig.id, categories, comment: 'Excellent collaboration throughout.' });
    expect(res.body.data.isFlagged).toBe(false);
  });

  it('flags two weak signals together, not one', async () => {
    const other = await setup();
    const weak = await review(other.client.auth, { gigId: other.gig.id, categories, comment: 'ok' }); // new account + short
    expect(weak.body.data.flagReason).toMatch(/Brand-new.*Very short/);

    const established = await setup();
    await establish(established.client.user._id);
    const short = await review(established.client.auth, { gigId: established.gig.id, categories, comment: 'ok' }); // one weak signal
    expect(short.body.data.isFlagged).toBe(false);
  });

  it('stores a 0–100 reputation score with the documented formula', async () => {
    const { client, freelancer, gig } = await setup();
    await review(client.auth, { gigId: gig.id, categories, comment: 'Great work, delivered ahead of schedule.' }).expect(201);
    const profile = await FreelancerProfile.findOne({ user: freelancer.user._id });
    // platform mean = this one review; Bayesian = rating; completion = (1 + 1.6) / (1 + 2)
    const expected = computeReputation({ reviews: [{ rating: expectedRating, createdAt: new Date() }], platformMean: expectedRating, completed: 1, failed: 0 });
    expect(profile!.reputationScore).toBe(expected.score);

    const breakdown = await request(app).get(`/api/v1/reviews/user/${freelancer.user.id}/breakdown`).expect(200);
    expect(breakdown.body.data.reputationScore).toBe(expected.score);
    const list = await request(app).get(`/api/v1/reviews/user/${freelancer.user.id}`).expect(200);
    expect(list.body.data[0].verifiedHire).toEqual({});
  });

  it('weights old reviews at 50 %, penalises failed jobs and rewards verification', () => {
    const now = new Date('2026-10-27');
    const fresh = computeReputation({ reviews: [{ rating: 5, createdAt: now }, { rating: 1, createdAt: new Date('2024-01-01') }], platformMean: 4, completed: 2, failed: 0, now });
    const flat = computeReputation({ reviews: [{ rating: 5, createdAt: now }, { rating: 1, createdAt: now }], platformMean: 4, completed: 2, failed: 0, now });
    expect(fresh.bayesianRating).toBeGreaterThan(flat.bayesianRating);

    const failing = computeReputation({ reviews: [], platformMean: 4, completed: 2, failed: 3, now });
    const clean = computeReputation({ reviews: [], platformMean: 4, completed: 2, failed: 0, now });
    expect(failing.score).toBeLessThan(clean.score);
    expect(computeReputation({ reviews: [], platformMean: 4, completed: 2, failed: 0, verified: true, now }).score).toBe(Math.min(100, clean.score + 5));
    expect(amountRange(12_000)).toBe('₹5k–₹25k');
  });
});
