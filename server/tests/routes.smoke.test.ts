import request from 'supertest';
import app from '../src/app';
import Booking from '../src/models/Booking';
import Conversation from '../src/models/Conversation';
import Dispute from '../src/models/Dispute';
import FreelancerProfile from '../src/models/FreelancerProfile';
import Notification from '../src/models/Notification';
import Payment from '../src/models/Payment';
import Proposal from '../src/models/Proposal';
import Review from '../src/models/Review';
import { GigStatus, NotificationType, PaymentStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

import { registeredRoutes } from './routeRegistry';

type Role = 'public' | 'admin' | 'client' | 'freelancer';
type Ids = Awaited<ReturnType<typeof fixtures>>;
type Case = { role: Role; path?: (ids: Ids) => string; body?: (ids: Ids) => unknown };

/**
 * One case per route: who calls it and with which ids/body. `path` fills in the params
 * (defaults to the route path when it has none). Responses must not be 404 or 500.
 */
const CASES: Record<string, Case> = {
  // Auth
  'POST /api/v1/auth/register': { role: 'public', body: () => ({ firstName: 'A', lastName: 'B', email: 'smoke-new@test.dev', password: 'Str0ngPass!', role: 'client' }) },
  'POST /api/v1/auth/login': { role: 'public', body: (i) => ({ email: i.clientEmail, password: 'Str0ngPass!' }) },
  'POST /api/v1/auth/refresh': { role: 'public' }, // 401 without a cookie
  'POST /api/v1/auth/logout': { role: 'public' },
  'GET /api/v1/auth/me': { role: 'client' },
  'GET /api/v1/auth/verify-email/:token': { role: 'public', path: () => '/api/v1/auth/verify-email/not-a-real-token' },
  'POST /api/v1/auth/resend-verification': { role: 'client' },
  'POST /api/v1/auth/forgot-password': { role: 'public', body: (i) => ({ email: i.clientEmail }) },
  'POST /api/v1/auth/reset-password/:token': { role: 'public', path: () => '/api/v1/auth/reset-password/bad-token', body: () => ({ password: 'N3wPassword!' }) },
  'POST /api/v1/auth/2fa/setup': { role: 'freelancer' },
  'POST /api/v1/auth/2fa/enable': { role: 'freelancer', body: () => ({ code: '000000' }) },
  'POST /api/v1/auth/2fa/disable': { role: 'client', body: () => ({ password: 'x', code: '000000' }) },
  'POST /api/v1/auth/2fa/verify': { role: 'public', body: () => ({ tempToken: 'bad', code: '000000' }) },
  'GET /api/v1/auth/providers': { role: 'public' },
  'GET /api/v1/auth/google': { role: 'public' },
  'GET /api/v1/auth/google/callback': { role: 'public' },
  'POST /api/v1/auth/choose-role': { role: 'client', body: () => ({ role: 'client' }) },
  'PUT /api/v1/auth/change-password': { role: 'client', body: () => ({ currentPassword: 'wrong', newPassword: 'N3wPassword!' }) },

  'GET /api/v1/config/': { role: 'public', path: () => '/api/v1/config' },

  // Users
  'GET /api/v1/users/me': { role: 'freelancer' },
  'PUT /api/v1/users/me': { role: 'freelancer', body: () => ({ bio: 'Hello' }) },
  'PUT /api/v1/users/freelancers/me': { role: 'freelancer', body: () => ({ hourlyRate: 900 }) },
  'GET /api/v1/users/freelancers/:userId': { role: 'public', path: (i) => `/api/v1/users/freelancers/${i.freelancerId}` },
  'PUT /api/v1/users/clients/me': { role: 'client', body: () => ({ companyName: 'Acme' }) },
  'GET /api/v1/users/clients/:userId': { role: 'public', path: (i) => `/api/v1/users/clients/${i.clientId}` },
  // Uploads answer 503 without Cloudinary (allowed); tests/uploads.test.ts covers the configured path.
  'GET /api/v1/users/me/notification-preferences': { role: 'client' },
  'PUT /api/v1/users/me/notification-preferences': { role: 'client', body: () => ({ email: { messages: true } }) },
  'POST /api/v1/users/me/avatar': { role: 'client' },
  'POST /api/v1/users/freelancers/me/resume': { role: 'freelancer' },
  'DELETE /api/v1/users/freelancers/me/resume': { role: 'freelancer' },
  'POST /api/v1/users/freelancers/me/portfolio': { role: 'freelancer' },
  'DELETE /api/v1/users/freelancers/me/portfolio/:itemId': { role: 'freelancer', path: (i) => `/api/v1/users/freelancers/me/portfolio/${i.portfolioItemId}` },
  'POST /api/v1/users/freelancers/me/verification-request': { role: 'freelancer' },

  // Gigs
  'GET /api/v1/gigs/': { role: 'public', path: () => '/api/v1/gigs' },
  'GET /api/v1/gigs/mine': { role: 'client' },
  'GET /api/v1/gigs/:id': { role: 'public', path: (i) => `/api/v1/gigs/${i.openGigId}` },
  'POST /api/v1/gigs/': {
    role: 'client',
    path: () => '/api/v1/gigs',
    body: () => ({ title: 'T', description: 'D', category: 'Web', skills: ['React'], budgetType: 'fixed', budgetMin: 1, budgetMax: 2, duration: '1 week', experienceLevel: 'entry' }),
  },
  'PUT /api/v1/gigs/:id': { role: 'client', path: (i) => `/api/v1/gigs/${i.openGigId}`, body: () => ({ title: 'Renamed' }) },
  'PUT /api/v1/gigs/:id/cancel': { role: 'client', path: (i) => `/api/v1/gigs/${i.spareGigId}/cancel` },
  'DELETE /api/v1/gigs/:id': { role: 'client', path: (i) => `/api/v1/gigs/${i.deletableGigId}` },
  'POST /api/v1/gigs/:id/attachments': { role: 'client', path: (i) => `/api/v1/gigs/${i.openGigId}/attachments` },
  'DELETE /api/v1/gigs/:id/attachments/:attachmentId': { role: 'client', path: (i) => `/api/v1/gigs/${i.openGigId}/attachments/${i.attachmentId}` },
  'POST /api/v1/gigs/:id/invite': { role: 'client', path: (i) => `/api/v1/gigs/${i.applyGigId}/invite`, body: (i) => ({ freelancerId: i.spareUserId }) },
  'GET /api/v1/gigs/invitations': { role: 'freelancer' },
  'GET /api/v1/gigs/:id/progress': { role: 'client', path: (i) => `/api/v1/gigs/${i.workGigId}/progress` },
  'POST /api/v1/gigs/:id/progress-logs': { role: 'freelancer', path: (i) => `/api/v1/gigs/${i.workGigId}/progress-logs`, body: () => ({ message: 'Day 1 done' }) },
  'PUT /api/v1/gigs/:id/milestones/:mid/start': { role: 'freelancer', path: (i) => `/api/v1/gigs/${i.workGigId}/milestones/${i.milestoneId}/start` },
  'PUT /api/v1/gigs/:id/milestones/:mid/progress': { role: 'freelancer', path: (i) => `/api/v1/gigs/${i.workGigId}/milestones/${i.milestoneId}/progress`, body: () => ({ percent: 40 }) },
  'PUT /api/v1/gigs/:id/milestones/:mid/submit': { role: 'freelancer', path: (i) => `/api/v1/gigs/${i.workGigId}/milestones/${i.milestoneId}/submit`, body: () => ({ note: 'Done' }) },
  'PUT /api/v1/gigs/:id/milestones/:mid/approve': { role: 'client', path: (i) => `/api/v1/gigs/${i.workGigId}/milestones/${i.milestoneId}/approve` },
  'PUT /api/v1/gigs/:id/milestones/:mid/request-changes': { role: 'client', path: (i) => `/api/v1/gigs/${i.workGigId}/milestones/${i.milestoneId}/request-changes`, body: () => ({ note: 'Please fix the header' }) },
  'PUT /api/v1/gigs/:id/complete': { role: 'client', path: (i) => `/api/v1/gigs/${i.workGigId}/complete` },
  'PUT /api/v1/gigs/:id/invitation': { role: 'freelancer', path: (i) => `/api/v1/gigs/${i.inviteGigId}/invitation`, body: () => ({ status: 'declined' }) },

  // Proposals
  'POST /api/v1/proposals/': { role: 'freelancer', path: () => '/api/v1/proposals', body: (i) => ({ gigId: i.applyGigId, coverLetter: 'Hi', proposedAmount: 10, estimatedDuration: '1 week' }) },
  'GET /api/v1/proposals/mine': { role: 'freelancer' },
  'GET /api/v1/proposals/gig/:gigId': { role: 'client', path: (i) => `/api/v1/proposals/gig/${i.openGigId}` },
  'GET /api/v1/proposals/:id': { role: 'freelancer', path: (i) => `/api/v1/proposals/${i.proposalId}` },
  'POST /api/v1/proposals/:id/negotiate': { role: 'client', path: (i) => `/api/v1/proposals/${i.proposalId}/negotiate`, body: () => ({ amount: 4, message: 'Can you do 4?' }) },
  'PUT /api/v1/proposals/:id/withdraw': { role: 'freelancer', path: (i) => `/api/v1/proposals/${i.withdrawProposalId}/withdraw` },
  'PUT /api/v1/proposals/:id/status': { role: 'client', path: (i) => `/api/v1/proposals/${i.proposalId}/status`, body: () => ({ status: 'negotiating' }) },

  // Chat
  'GET /api/v1/chat/conversations': { role: 'client' },
  'POST /api/v1/chat/conversations': { role: 'client', body: (i) => ({ participantId: i.freelancerId }) },
  'POST /api/v1/chat/conversations/:id/files': { role: 'client', path: (i) => `/api/v1/chat/conversations/${i.conversationId}/files` },
  'GET /api/v1/chat/conversations/:id/messages': { role: 'client', path: (i) => `/api/v1/chat/conversations/${i.conversationId}/messages` },

  // Payments (money-moving routes answer 503 without Razorpay keys, which is allowed)
  'GET /api/v1/payments/': { role: 'client', path: () => '/api/v1/payments' },
  'GET /api/v1/payments/summary': { role: 'freelancer' },
  'GET /api/v1/payments/config': { role: 'client' },
  'POST /api/v1/payments/orders': { role: 'client', body: (i) => ({ gigId: i.workGigId, milestoneId: i.milestoneId }) },
  'POST /api/v1/payments/verify': { role: 'client', body: () => ({ razorpay_order_id: 'o', razorpay_payment_id: 'p', razorpay_signature: 's' }) },
  'POST /api/v1/payments/:id/release': { role: 'client', path: (i) => `/api/v1/payments/${i.paymentId}/release` },
  'POST /api/v1/payments/:id/simulate': { role: 'client', path: (i) => `/api/v1/payments/${i.paymentId}/simulate` },
  'GET /api/v1/payments/export': { role: 'client' },
  'POST /api/v1/payments/webhook': { role: 'public' }, // 400/503: unsigned
  'POST /api/v1/payments/:id/refund': { role: 'client', path: (i) => `/api/v1/payments/${i.paymentId}/refund`, body: () => ({}) },

  // Reviews
  'POST /api/v1/reviews/': {
    role: 'freelancer',
    path: () => '/api/v1/reviews',
    body: (i) => ({ gigId: i.completedGigId, comment: 'Great', categories: { quality: 5, communication: 5, timeliness: 5, professionalism: 5, value: 5 } }),
  },
  'GET /api/v1/reviews/user/:userId': { role: 'public', path: (i) => `/api/v1/reviews/user/${i.freelancerId}` },
  'GET /api/v1/reviews/user/:userId/breakdown': { role: 'public', path: (i) => `/api/v1/reviews/user/${i.freelancerId}/breakdown` },
  'POST /api/v1/reviews/:id/reply': { role: 'freelancer', path: (i) => `/api/v1/reviews/${i.reviewId}/reply`, body: () => ({ response: 'Thanks!' }) },
  'POST /api/v1/reviews/:id/report': { role: 'client', path: (i) => `/api/v1/reviews/${i.reviewId}/report`, body: () => ({ reason: 'Suspicious' }) },

  // Notifications
  'GET /api/v1/notifications/': { role: 'client', path: () => '/api/v1/notifications' },
  'GET /api/v1/notifications/unread-count': { role: 'client' },
  'PUT /api/v1/notifications/:id/read': { role: 'client', path: (i) => `/api/v1/notifications/${i.notificationId}/read` },
  'PUT /api/v1/notifications/read-all': { role: 'client' },
  'DELETE /api/v1/notifications/:id': { role: 'client', path: (i) => `/api/v1/notifications/${i.notificationId}` },

  // Search
  'GET /api/v1/search/gigs': { role: 'public' },
  'GET /api/v1/search/freelancers': { role: 'public', path: () => '/api/v1/search/freelancers?q=react&minRate=1' },
  'GET /api/v1/search/trending-skills': { role: 'public' },
  'GET /api/v1/search/categories': { role: 'public' },
  'GET /api/v1/search/suggestions': { role: 'public', path: () => '/api/v1/search/suggestions?q=re' },

  // AI
  'GET /api/v1/ai/gigs/:gigId/matches': { role: 'client', path: (i) => `/api/v1/ai/gigs/${i.openGigId}/matches` },
  'GET /api/v1/ai/recommendations': { role: 'freelancer' },
  'POST /api/v1/ai/resume-analysis': { role: 'freelancer' }, // 400: no file and no stored resume
  'POST /api/v1/ai/career-analysis': { role: 'freelancer', body: () => ({ resumeText: 'React and Node.js developer with five years of experience building SaaS dashboards.' }) },

  // Analytics
  'GET /api/v1/analytics/freelancer': { role: 'freelancer' },
  'GET /api/v1/analytics/client': { role: 'client' },

  // Schedule
  'GET /api/v1/schedule/:freelancerId/availability': { role: 'public', path: (i) => `/api/v1/schedule/${i.freelancerId}/availability` },
  'PUT /api/v1/schedule/me/slots': { role: 'freelancer', body: () => ({ availabilitySlots: [{ dayOfWeek: 1, startTime: '10:00', endTime: '12:00' }] }) },
  'POST /api/v1/schedule/bookings': { role: 'client', body: (i) => ({ freelancerId: i.freelancerId, start: '2030-01-07T04:30:00.000Z', durationMinutes: 30, title: 'Kick-off' }) },
  'GET /api/v1/schedule/bookings': { role: 'freelancer' },
  'PUT /api/v1/schedule/bookings/:id': { role: 'freelancer', path: (i) => `/api/v1/schedule/bookings/${i.bookingId}`, body: () => ({ status: 'confirmed' }) },
  'POST /api/v1/schedule/auto-schedule': { role: 'client', body: (i) => ({ freelancerId: i.freelancerId, durationMinutes: 60 }) },

  // Disputes
  'POST /api/v1/disputes/': { role: 'client', path: () => '/api/v1/disputes', body: (i) => ({ gigId: i.workGigId, title: 'Issue', description: 'Details' }) },
  'GET /api/v1/disputes/': { role: 'admin', path: () => '/api/v1/disputes' },
  'GET /api/v1/disputes/:id': { role: 'client', path: (i) => `/api/v1/disputes/${i.disputeId}` },
  'PUT /api/v1/disputes/:id/resolve': { role: 'admin', path: (i) => `/api/v1/disputes/${i.disputeId}/resolve`, body: () => ({ resolution: 'Closed' }) },

  // Admin
  'GET /api/v1/admin/stats': { role: 'admin' },
  'GET /api/v1/admin/analytics': { role: 'admin' },
  'GET /api/v1/admin/users': { role: 'admin' },
  'GET /api/v1/admin/users/:id': { role: 'admin', path: (i) => `/api/v1/admin/users/${i.clientId}` },
  'PUT /api/v1/admin/users/:id/suspend': { role: 'admin', path: (i) => `/api/v1/admin/users/${i.spareUserId}/suspend`, body: () => ({ reason: 'Smoke test' }) },
  'PUT /api/v1/admin/users/:id/unsuspend': { role: 'admin', path: (i) => `/api/v1/admin/users/${i.spareUserId}/unsuspend` },
  'GET /api/v1/admin/gigs/pending': { role: 'admin' },
  'PUT /api/v1/admin/gigs/:id/approve': { role: 'admin', path: (i) => `/api/v1/admin/gigs/${i.pendingGigId}/approve` },
  'PUT /api/v1/admin/gigs/:id/reject': { role: 'admin', path: (i) => `/api/v1/admin/gigs/${i.pendingGig2Id}/reject`, body: () => ({ reason: 'Not enough detail' }) },
  'GET /api/v1/admin/verifications': { role: 'admin' },
  'PUT /api/v1/admin/freelancers/:id/verify': { role: 'admin', path: (i) => `/api/v1/admin/freelancers/${i.freelancerId}/verify` },
  'PUT /api/v1/admin/freelancers/:id/reject-verification': { role: 'admin', path: (i) => `/api/v1/admin/freelancers/${i.spareUserId}/reject-verification`, body: () => ({ reason: 'Blurry ID' }) },
  'GET /api/v1/admin/payments': { role: 'admin' },
  'GET /api/v1/admin/fraud': { role: 'admin' },
  'PUT /api/v1/admin/reviews/:id/visibility': { role: 'admin', path: (i) => `/api/v1/admin/reviews/${i.reviewId}/visibility`, body: () => ({ isVisible: true }) },
  'GET /api/v1/admin/logs': { role: 'admin' },
};

const fixtures = async () => {
  const admin = await createUser(UserRole.ADMIN);
  const client = await createUser(UserRole.CLIENT);
  const freelancer = await createUser(UserRole.FREELANCER);
  const other = await createUser(UserRole.FREELANCER);
  const spare = await createUser(UserRole.FREELANCER);

  const openGig = await createGig(client.user._id, { attachments: [{ url: 'https://example.com/brief.pdf', name: 'brief.pdf', mimeType: 'application/pdf' }] });
  const inviteGig = await createGig(client.user._id, { visibility: 'invite_only', invitations: [{ freelancer: freelancer.user._id }] });
  const applyGig = await createGig(client.user._id);
  const spareGig = await createGig(client.user._id);
  const deletableGig = await createGig(client.user._id);
  const pendingGig = await createGig(client.user._id, { status: GigStatus.PENDING_APPROVAL });
  const pendingGig2 = await createGig(client.user._id, { status: GigStatus.PENDING_APPROVAL });
  const workGig = await createGig(client.user._id, {
    status: GigStatus.IN_PROGRESS,
    selectedFreelancer: freelancer.user._id,
    milestones: [{ title: 'M1', description: 'x', amount: 100, dueDate: new Date() }],
  });
  const completedGig = await createGig(client.user._id, { status: GigStatus.COMPLETED, selectedFreelancer: freelancer.user._id });

  const proposal = await Proposal.create({ gig: openGig._id, freelancer: freelancer.user._id, coverLetter: 'x', proposedAmount: 5, estimatedDuration: 'x' });
  const withdrawProposal = await Proposal.create({ gig: spareGig._id, freelancer: freelancer.user._id, coverLetter: 'x', proposedAmount: 5, estimatedDuration: 'x' });
  await Proposal.create({ gig: openGig._id, freelancer: other.user._id, coverLetter: 'x', proposedAmount: 5, estimatedDuration: 'x' });

  const withPortfolio = await FreelancerProfile.findOneAndUpdate(
    { user: freelancer.user._id },
    { $push: { portfolio: { title: 'Site', description: 'A site', images: [] } } },
    { returnDocument: 'after' }
  );
  await FreelancerProfile.updateOne({ user: spare.user._id }, { $set: { 'verification.status': 'pending', 'verification.requestedAt': new Date() } });

  const booking = await Booking.create({ freelancer: freelancer.user._id, client: client.user._id, start: new Date(Date.now() + 864e5), end: new Date(Date.now() + 864e5 + 18e5), title: 'Call' });

  const conversation = await Conversation.create({ participants: [client.user._id, freelancer.user._id] });
  const payment = await Payment.create({ gig: workGig._id, client: client.user._id, freelancer: freelancer.user._id, amount: 100, status: PaymentStatus.ESCROW });
  const review = await Review.create({
    gig: completedGig._id, reviewer: client.user._id, reviewee: freelancer.user._id, comment: 'Good',
    categories: { quality: 4, communication: 4, timeliness: 4, professionalism: 4, value: 4 },
  });
  const notification = await Notification.create({ recipient: client.user._id, type: NotificationType.SYSTEM, title: 'Hi', message: 'Hello' });
  const dispute = await Dispute.create({ gig: completedGig._id, raisedBy: client.user._id, against: freelancer.user._id, title: 'x', description: 'y' });

  return {
    tokens: { admin: admin.auth, client: client.auth, freelancer: freelancer.auth } as Record<Exclude<Role, 'public'>, Record<string, string>>,
    clientId: client.user.id as string,
    clientEmail: client.user.email,
    freelancerId: freelancer.user.id as string,
    spareUserId: spare.user.id as string,
    openGigId: openGig.id as string,
    applyGigId: applyGig.id as string,
    spareGigId: spareGig.id as string,
    deletableGigId: deletableGig.id as string,
    pendingGigId: pendingGig.id as string,
    pendingGig2Id: pendingGig2.id as string,
    workGigId: workGig.id as string,
    milestoneId: workGig.milestones[0]._id!.toString(),
    completedGigId: completedGig.id as string,
    proposalId: proposal.id as string,
    withdrawProposalId: withdrawProposal.id as string,
    conversationId: conversation.id as string,
    paymentId: payment.id as string,
    reviewId: review.id as string,
    notificationId: notification.id as string,
    disputeId: dispute.id as string,
    portfolioItemId: withPortfolio!.portfolio[0]._id!.toString(),
    attachmentId: openGig.attachments[0]._id!.toString(),
    inviteGigId: inviteGig.id as string,
    bookingId: booking.id as string,
  };
};

describe('route smoke test (2.3)', () => {
  it('has a smoke case for every registered route and none for removed ones', () => {
    const registered = registeredRoutes().sort();
    expect(registered.filter((r) => !CASES[r])).toEqual([]);
    expect(Object.keys(CASES).filter((c) => !registered.includes(c))).toEqual([]);
  });

  it('every route answers without 404 or 500 for the right role', async () => {
    const ids = await fixtures();
    const failures: string[] = [];

    for (const route of registeredRoutes()) {
      const { role, path, body } = CASES[route];
      const [method, template] = route.split(' ');
      const url = path ? path(ids) : template;
      let req = request(app)[method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'](url);
      if (role !== 'public') req = req.set(ids.tokens[role]);
      const res = await (body ? req.send(body(ids) as object) : req);
      if (res.status === 404 || res.status >= 500 && res.status !== 503) {
        failures.push(`${route} -> ${res.status} ${res.body?.message ?? ''}`);
      }
    }

    expect(failures).toEqual([]);
  });
});
