import request from 'supertest';
import app from '../src/app';
import FreelancerProfile from '../src/models/FreelancerProfile';
import Review from '../src/models/Review';
import Notification from '../src/models/Notification';
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
    const res = await review(client.auth, { gigId: gig.id, categories, comment: 'Great work', revieweeId: outsider.user.id });
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
    for (const gig of gigs.slice(0, 3)) {
      await review(client.auth, { gigId: gig.id, categories, comment: 'ok' });
    }
    const fourth = await createGig(client.user._id, { status: GigStatus.COMPLETED, selectedFreelancer: freelancer.user._id });
    const res = await review(client.auth, {
      gigId: fourth.id,
      categories: { quality: 1, communication: 1, timeliness: 1, professionalism: 1, value: 1 },
      comment: 'bad',
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
