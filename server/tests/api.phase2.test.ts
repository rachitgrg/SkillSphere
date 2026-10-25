import request from 'supertest';
import app from '../src/app';
import AdminLog from '../src/models/AdminLog';
import Conversation from '../src/models/Conversation';
import Gig from '../src/models/Gig';
import Message from '../src/models/Message';
import Notification from '../src/models/Notification';
import Proposal from '../src/models/Proposal';
import Review from '../src/models/Review';
import User from '../src/models/User';
import searchService from '../src/services/searchService';
import { AdminAction, GigStatus, NotificationType, ProposalStatus, UserRole } from '../src/types';
import { createGig, createUser, STRONG_PASSWORD } from './helpers';

const gigBody = {
  title: 'Mobile app',
  description: 'Build an app',
  category: 'Mobile Development',
  skills: ['Flutter'],
  budgetType: 'fixed',
  budgetMin: 1000,
  budgetMax: 2000,
  duration: '1 month',
  experienceLevel: 'entry',
};

describe('gig approval flow', () => {
  it('new gigs wait for approval; admin approves, logs and notifies the client', async () => {
    const client = await createUser(UserRole.CLIENT);
    const admin = await createUser(UserRole.ADMIN);

    const created = await request(app).post('/api/v1/gigs').set(client.auth).send(gigBody);
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe(GigStatus.PENDING_APPROVAL);
    expect((await request(app).get('/api/v1/gigs')).body.data).toHaveLength(0);

    const queue = await request(app).get('/api/v1/admin/gigs/pending').set(admin.auth);
    expect(queue.body.data).toHaveLength(1);

    const approved = await request(app).put(`/api/v1/admin/gigs/${created.body.data._id}/approve`).set(admin.auth);
    expect(approved.status).toBe(200);
    expect((await request(app).get('/api/v1/gigs')).body.data).toHaveLength(1);
    expect(await AdminLog.countDocuments({ action: AdminAction.GIG_APPROVE })).toBe(1);
    expect(await Notification.countDocuments({ recipient: client.user._id, type: NotificationType.GIG_APPROVED })).toBe(1);

    // A second decision on the same gig conflicts.
    expect((await request(app).put(`/api/v1/admin/gigs/${created.body.data._id}/reject`).set(admin.auth).send({ reason: 'Late' })).status).toBe(409);
  });

  it('rejection requires a reason and is visible in the client gig list', async () => {
    const client = await createUser(UserRole.CLIENT);
    const admin = await createUser(UserRole.ADMIN);
    const gig = await createGig(client.user._id, { status: GigStatus.PENDING_APPROVAL });

    expect((await request(app).put(`/api/v1/admin/gigs/${gig.id}/reject`).set(admin.auth).send({})).status).toBe(400);
    expect((await request(app).put(`/api/v1/admin/gigs/${gig.id}/reject`).set(admin.auth).send({ reason: 'Too vague' })).status).toBe(200);

    const mine = await request(app).get('/api/v1/gigs/mine').query({ status: 'rejected' }).set(client.auth);
    expect(mine.body.data[0].rejectionReason).toBe('Too vague');
  });

  it('non-admins cannot reach admin routes', async () => {
    const client = await createUser(UserRole.CLIENT);
    expect((await request(app).get('/api/v1/admin/stats').set(client.auth)).status).toBe(403);
  });
});

describe('admin user management', () => {
  it('suspension blocks login and API access; unsuspend restores it', async () => {
    const admin = await createUser(UserRole.ADMIN);
    const freelancer = await createUser(UserRole.FREELANCER);

    const res = await request(app).put(`/api/v1/admin/users/${freelancer.user.id}/suspend`).set(admin.auth).send({ reason: 'Spam' });
    expect(res.status).toBe(200);
    expect((await request(app).get('/api/v1/users/me').set(freelancer.auth)).status).toBe(403);
    expect((await request(app).post('/api/v1/auth/login').send({ email: freelancer.user.email, password: STRONG_PASSWORD })).status).toBe(403);

    await request(app).put(`/api/v1/admin/users/${freelancer.user.id}/unsuspend`).set(admin.auth);
    expect((await request(app).get('/api/v1/users/me').set(freelancer.auth)).status).toBe(200);
  });

  it('timed suspensions lift automatically', async () => {
    const freelancer = await createUser(UserRole.FREELANCER);
    await User.updateOne({ _id: freelancer.user._id }, { isBanned: true, suspendedUntil: new Date(Date.now() - 1000) });
    expect((await request(app).get('/api/v1/users/me').set(freelancer.auth)).status).toBe(200);
    expect((await User.findById(freelancer.user._id))!.isBanned).toBe(false);
  });

  it('lists users with search and status filters', async () => {
    const admin = await createUser(UserRole.ADMIN);
    await createUser(UserRole.CLIENT, { firstName: 'Zebulon' });
    await createUser(UserRole.FREELANCER, { isBanned: true });
    const search = await request(app).get('/api/v1/admin/users').query({ search: 'zebu' }).set(admin.auth);
    expect(search.body.data).toHaveLength(1);
    const suspended = await request(app).get('/api/v1/admin/users').query({ status: 'suspended' }).set(admin.auth);
    expect(suspended.body.data).toHaveLength(1);
  });
});

describe('proposals: mine and withdraw', () => {
  it('lists my proposals and withdraws a pending one', async () => {
    const client = await createUser(UserRole.CLIENT);
    const freelancer = await createUser(UserRole.FREELANCER);
    const gig = await createGig(client.user._id);
    const created = await request(app).post('/api/v1/proposals').set(freelancer.auth).send({
      gigId: gig.id, coverLetter: 'Hi', proposedAmount: 1500, estimatedDuration: '1 week',
    });

    const mine = await request(app).get('/api/v1/proposals/mine').set(freelancer.auth);
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].gig.title).toBe(gig.title);

    const withdrawn = await request(app).put(`/api/v1/proposals/${created.body.data._id}/withdraw`).set(freelancer.auth);
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body.data.status).toBe(ProposalStatus.WITHDRAWN);
    expect((await request(app).put(`/api/v1/proposals/${created.body.data._id}/withdraw`).set(freelancer.auth)).status).toBe(409);
    expect((await Gig.findById(gig._id))!.totalProposals).toBe(0);
  });

  it('cannot withdraw someone else’s proposal', async () => {
    const client = await createUser(UserRole.CLIENT);
    const a = await createUser(UserRole.FREELANCER);
    const b = await createUser(UserRole.FREELANCER);
    const gig = await createGig(client.user._id);
    const p = await Proposal.create({ gig: gig._id, freelancer: a.user._id, coverLetter: 'x', proposedAmount: 1, estimatedDuration: 'x' });
    expect((await request(app).put(`/api/v1/proposals/${p.id}/withdraw`).set(b.auth)).status).toBe(404);
  });
});

describe('chat history', () => {
  it('paginates messages upward with a before cursor and reports unread counts', async () => {
    const client = await createUser(UserRole.CLIENT);
    const freelancer = await createUser(UserRole.FREELANCER);
    const conversation = await Conversation.create({ participants: [client.user._id, freelancer.user._id] });
    for (let i = 0; i < 5; i++) {
      await Message.create({
        conversation: conversation._id, sender: freelancer.user._id, content: `m${i}`,
        createdAt: new Date(Date.now() - (5 - i) * 1000),
      });
    }

    const first = await request(app).get(`/api/v1/chat/conversations/${conversation.id}/messages`).query({ limit: 2 }).set(client.auth);
    expect(first.body.data.messages.map((m: { content: string }) => m.content)).toEqual(['m3', 'm4']);
    expect(first.body.data.hasMore).toBe(true);

    const older = await request(app)
      .get(`/api/v1/chat/conversations/${conversation.id}/messages`)
      .query({ limit: 2, before: first.body.data.messages[0]._id })
      .set(client.auth);
    expect(older.body.data.messages.map((m: { content: string }) => m.content)).toEqual(['m1', 'm2']);

    const list = await request(app).get('/api/v1/chat/conversations').set(client.auth);
    expect(list.body.data[0].unreadCount).toBe(5);
  });

  it('starts (or reuses) a conversation with participantId', async () => {
    const client = await createUser(UserRole.CLIENT);
    const freelancer = await createUser(UserRole.FREELANCER);
    const first = await request(app).post('/api/v1/chat/conversations').set(client.auth).send({ participantId: freelancer.user.id });
    const again = await request(app).post('/api/v1/chat/conversations').set(client.auth).send({ participantId: freelancer.user.id });
    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(again.body.data._id).toBe(first.body.data._id);
    expect((await request(app).post('/api/v1/chat/conversations').set(client.auth).send({ participantId: client.user.id })).status).toBe(400);
  });
});

describe('notifications', () => {
  it('paginates and counts unread', async () => {
    const user = await createUser(UserRole.FREELANCER);
    await Notification.create([1, 2, 3].map((i) => ({
      recipient: user.user._id, type: NotificationType.SYSTEM, title: `n${i}`, message: 'x', isRead: i === 1,
    })));
    expect((await request(app).get('/api/v1/notifications/unread-count').set(user.auth)).body.data.count).toBe(2);
    const page = await request(app).get('/api/v1/notifications').query({ limit: 2 }).set(user.auth);
    expect(page.body.data.notifications).toHaveLength(2);
    expect(page.body.pagination.total).toBe(3);
    await request(app).put('/api/v1/notifications/read-all').set(user.auth);
    expect((await request(app).get('/api/v1/notifications/unread-count').set(user.auth)).body.data.count).toBe(0);
  });
});

describe('reviews: report and breakdown', () => {
  it('a report flags the review once per user; breakdown is public', async () => {
    const client = await createUser(UserRole.CLIENT);
    const freelancer = await createUser(UserRole.FREELANCER);
    const reporter = await createUser(UserRole.CLIENT);
    const gig = await createGig(client.user._id, { status: GigStatus.COMPLETED, selectedFreelancer: freelancer.user._id });
    const review = await Review.create({
      gig: gig._id, reviewer: client.user._id, reviewee: freelancer.user._id, comment: 'ok',
      categories: { quality: 4, communication: 4, timeliness: 4, professionalism: 4, value: 4 },
    });

    expect((await request(app).post(`/api/v1/reviews/${review.id}/report`).set(reporter.auth).send({ reason: 'Looks fake' })).status).toBe(200);
    expect((await request(app).post(`/api/v1/reviews/${review.id}/report`).set(reporter.auth).send({ reason: 'Again' })).status).toBe(409);
    expect((await Review.findById(review._id))!.isFlagged).toBe(true);

    const breakdown = await request(app).get(`/api/v1/reviews/user/${freelancer.user.id}/breakdown`);
    expect(breakdown.status).toBe(200);
    expect(breakdown.body.data.totalReviews).toBe(1);
  });
});

describe('search extras', () => {
  beforeEach(() => searchService.clearCache());

  it('trending skills compare the last 30 days with the previous 30', async () => {
    const client = await createUser(UserRole.CLIENT);
    await createGig(client.user._id, { skills: ['React', 'Node.js'] });
    await createGig(client.user._id, { skills: ['React'] });
    const old = await createGig(client.user._id, { skills: ['React'] });
    await Gig.collection.updateOne({ _id: old._id }, { $set: { createdAt: new Date(Date.now() - 40 * 86_400_000) } });

    const res = await request(app).get('/api/v1/search/trending-skills');
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ skill: 'React', count: 2, previousCount: 1, growth: 100 });
  });

  it('freelancer search filters by rate and rating and hides suspended users', async () => {
    const cheap = await createUser(UserRole.FREELANCER);
    const pricey = await createUser(UserRole.FREELANCER);
    const banned = await createUser(UserRole.FREELANCER, { isBanned: true });
    const FreelancerProfile = (await import('../src/models/FreelancerProfile')).default;
    await FreelancerProfile.updateOne({ user: cheap.user._id }, { hourlyRate: 500, averageRating: 4.8 });
    await FreelancerProfile.updateOne({ user: pricey.user._id }, { hourlyRate: 3000, averageRating: 4.9 });
    await FreelancerProfile.updateOne({ user: banned.user._id }, { hourlyRate: 400, averageRating: 5 });

    const res = await request(app).get('/api/v1/search/freelancers').query({ maxRate: 1000, minRating: 4 });
    expect(res.body.data.map((f: { user: { _id: string } }) => f.user._id)).toEqual([cheap.user.id]);
    expect(res.body.data[0].user.password).toBeUndefined();
  });

  it('suggestions return matching titles and skills', async () => {
    const client = await createUser(UserRole.CLIENT);
    await createGig(client.user._id, { title: 'React dashboard', skills: ['React'] });
    const res = await request(app).get('/api/v1/search/suggestions').query({ q: 'rea' });
    expect(res.body.data).toEqual({ titles: ['React dashboard'], skills: ['React'] });
  });
});
