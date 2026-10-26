import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import User from '../models/User';
import Gig from '../models/Gig';
import Payment from '../models/Payment';
import Dispute from '../models/Dispute';
import Review from '../models/Review';
import Proposal from '../models/Proposal';
import FreelancerProfile from '../models/FreelancerProfile';
import AdminLog from '../models/AdminLog';
import paymentService from '../services/paymentService';
import reputationService from '../services/reputationService';
import notificationService from '../services/notificationService';
import aiMatchingService from '../services/aiMatchingService';
import { getIOOrNull } from '../config/socket';
import { userRoom } from '../services/chatService';
import { AdminAction, AuthRequest, DisputeStatus, GigStatus, IGig, NotificationType, PaymentStatus, UserRole, VerificationStatus } from '../types';
import { logAdminAction } from '../utils/adminLog';
import { buildPaginationResponse, containsRegex, parsePaginationParams } from '../utils/helpers';

const DAY = 86_400_000;
const PERIOD_MONTHS: Record<string, number> = { '30d': 1, '90d': 3, '12m': 12 };

// ───────────────────────── Dashboard ─────────────────────────

/** GET /admin/stats — headline counters for the admin dashboard. */
export const getStats = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const monthAgo = new Date(Date.now() - 30 * DAY);
    const [usersByRole, gigsByStatus, activeDisputes, flaggedReviews, newUsers, money] = await Promise.all([
      User.aggregate<{ _id: UserRole; count: number }>([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      Gig.aggregate<{ _id: GigStatus; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Dispute.countDocuments({ status: { $in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] } }),
      Review.countDocuments({ isFlagged: true }),
      User.countDocuments({ createdAt: { $gte: monthAgo } }),
      Payment.aggregate<{ _id: PaymentStatus; amount: number; fees: number; count: number }>([
        { $group: { _id: '$status', amount: { $sum: '$amount' }, fees: { $sum: '$platformFee' }, count: { $sum: 1 } } },
      ]),
    ]);

    const byKey = <K extends string>(rows: { _id: K; count: number }[]) =>
      Object.fromEntries(rows.map((r) => [r._id, r.count])) as Partial<Record<K, number>>;
    const payments = Object.fromEntries(money.map((m) => [m._id, m]));
    const users = byKey(usersByRole);
    const gigs = byKey(gigsByStatus);

    res.status(200).json({
      success: true,
      message: 'Dashboard stats',
      data: {
        users: { total: usersByRole.reduce((s, r) => s + r.count, 0), ...users, newThisMonth: newUsers },
        gigs: { total: gigsByStatus.reduce((s, r) => s + r.count, 0), ...gigs, pendingApproval: gigs[GigStatus.PENDING_APPROVAL] ?? 0 },
        revenue: payments[PaymentStatus.RELEASED]?.fees ?? 0,
        gmv: payments[PaymentStatus.RELEASED]?.amount ?? 0,
        inEscrow: (payments[PaymentStatus.ESCROW]?.amount ?? 0) + (payments[PaymentStatus.DISPUTED]?.amount ?? 0),
        activeDisputes,
        flaggedReviews,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/analytics?period=30d|90d|12m — revenue by month (platform fees on released payments),
 * active freelancers (activity in the last 30 days), top categories (gig count + GMV),
 * job success rate = completed / (completed + cancelled + disputed), and user growth.
 */
export const getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const period = typeof req.query.period === 'string' && PERIOD_MONTHS[req.query.period] ? req.query.period : '12m';
    const start = new Date();
    start.setMonth(start.getMonth() - PERIOD_MONTHS[period]);
    const activeSince = new Date(Date.now() - 30 * DAY);

    const [revenueByMonth, userGrowth, categories, outcomes, disputedGigs, proposalAuthors, paidFreelancers, recentLogins] =
      await Promise.all([
        Payment.aggregate<{ month: string; revenue: number; gmv: number; transactions: number }>([
          { $match: { status: PaymentStatus.RELEASED, releasedAt: { $gte: start } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$releasedAt' } },
              revenue: { $sum: '$platformFee' },
              gmv: { $sum: '$amount' },
              transactions: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, month: '$_id', revenue: 1, gmv: 1, transactions: 1 } },
        ]),
        User.aggregate([
          { $match: { createdAt: { $gte: start } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
              total: { $sum: 1 },
              freelancers: { $sum: { $cond: [{ $eq: ['$role', UserRole.FREELANCER] }, 1, 0] } },
              clients: { $sum: { $cond: [{ $eq: ['$role', UserRole.CLIENT] }, 1, 0] } },
            },
          },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, month: '$_id', total: 1, freelancers: 1, clients: 1 } },
        ]),
        Gig.aggregate([
          { $match: { createdAt: { $gte: start } } },
          {
            $lookup: {
              from: 'payments',
              let: { gigId: '$_id' },
              pipeline: [
                { $match: { $expr: { $eq: ['$gig', '$$gigId'] }, status: PaymentStatus.RELEASED } },
                { $group: { _id: null, gmv: { $sum: '$amount' } } },
              ],
              as: 'paid',
            },
          },
          { $group: { _id: '$category', gigs: { $sum: 1 }, gmv: { $sum: { $ifNull: [{ $first: '$paid.gmv' }, 0] } } } },
          { $sort: { gigs: -1 } },
          { $limit: 8 },
          { $project: { _id: 0, category: '$_id', gigs: 1, gmv: 1 } },
        ]),
        Gig.aggregate<{ _id: GigStatus; count: number }>([
          { $match: { status: { $in: [GigStatus.COMPLETED, GigStatus.CANCELLED] }, updatedAt: { $gte: start } } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Dispute.distinct('gig', { createdAt: { $gte: start } }),
        Proposal.distinct('freelancer', { createdAt: { $gte: activeSince } }),
        Payment.distinct('freelancer', { updatedAt: { $gte: activeSince } }),
        User.distinct('_id', { role: UserRole.FREELANCER, lastLogin: { $gte: activeSince } }),
      ]);

    const outcome = Object.fromEntries(outcomes.map((o) => [o._id, o.count])) as Partial<Record<GigStatus, number>>;
    const completed = outcome[GigStatus.COMPLETED] ?? 0;
    const unsuccessful = (outcome[GigStatus.CANCELLED] ?? 0) + disputedGigs.length;
    const activeFreelancers = new Set(
      [...proposalAuthors, ...paidFreelancers, ...recentLogins].map((id: Types.ObjectId) => id.toString())
    ).size;

    res.status(200).json({
      success: true,
      message: 'Platform analytics',
      data: {
        period,
        revenueByMonth,
        totalRevenue: revenueByMonth.reduce((s, r) => s + r.revenue, 0),
        activeFreelancers,
        topCategories: categories,
        jobSuccessRate: completed + unsuccessful ? Math.round((completed / (completed + unsuccessful)) * 100) : 0,
        jobOutcomes: { completed, cancelled: outcome[GigStatus.CANCELLED] ?? 0, disputed: disputedGigs.length },
        userGrowth,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ───────────────────────── Users ─────────────────────────

/** GET /admin/users?search=&role=&status=active|suspended|inactive&page=&limit= */
export const getUsers = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
    const filter: Record<string, unknown> = {};
    const { search, role, status } = req.query;

    if (typeof search === 'string' && search.trim()) {
      const pattern = containsRegex(search.trim());
      filter.$or = [{ firstName: pattern }, { lastName: pattern }, { email: pattern }];
    }
    if (typeof role === 'string' && (Object.values(UserRole) as string[]).includes(role)) filter.role = role;
    if (status === 'active') Object.assign(filter, { isActive: true, isBanned: false });
    if (status === 'suspended') filter.isBanned = true;
    if (status === 'inactive') filter.isActive = false;

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, message: 'Users retrieved', data: users, pagination: buildPaginationResponse(total, page, limit) });
  } catch (error) {
    next(error);
  }
};

/** GET /admin/users/:id — account plus recent gigs, payments, reviews and disputes. */
export const getUserDetails = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    const id = user._id;
    const [gigs, payments, reviews, disputes] = await Promise.all([
      Gig.find({ $or: [{ client: id }, { selectedFreelancer: id }] }).select('title status createdAt').sort({ createdAt: -1 }).limit(20),
      Payment.find({ $or: [{ client: id }, { freelancer: id }] }).select('amount status gig createdAt').sort({ createdAt: -1 }).limit(20),
      Review.find({ $or: [{ reviewer: id }, { reviewee: id }] })
        .select('rating comment isFlagged isVisible reviewer reviewee createdAt')
        .sort({ createdAt: -1 })
        .limit(20),
      Dispute.find({ $or: [{ raisedBy: id }, { against: id }] }).select('title status createdAt').sort({ createdAt: -1 }).limit(20),
    ]);
    res.status(200).json({ success: true, message: 'User details', data: { user, gigs, payments, reviews, disputes } });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /admin/users/:id/suspend { reason, durationDays? } — bans (optionally until a date), revokes
 * the refresh token and disconnects the user's live sockets.
 */
export const suspendUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reason, durationDays } = req.body as { reason: string; durationDays?: number };
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    if (user.role === UserRole.ADMIN) {
      res.status(403).json({ success: false, message: 'Admins cannot be suspended' });
      return;
    }

    user.isBanned = true;
    user.banReason = reason;
    user.suspendedUntil = durationDays ? new Date(Date.now() + durationDays * DAY) : undefined;
    user.refreshToken = undefined;
    await user.save();

    getIOOrNull()?.in(userRoom(user._id.toString())).disconnectSockets(true);

    await logAdminAction(req, {
      action: AdminAction.USER_BAN,
      targetType: 'user',
      targetId: user._id,
      details: reason,
      metadata: { durationDays: durationDays ?? null, suspendedUntil: user.suspendedUntil ?? null },
    });

    res.status(200).json({ success: true, message: 'User suspended', data: user });
  } catch (error) {
    next(error);
  }
};

/** PUT /admin/users/:id/unsuspend */
export const unsuspendUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { isBanned: false }, $unset: { banReason: 1, suspendedUntil: 1 } },
      { returnDocument: 'after' }
    );
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    await logAdminAction(req, { action: AdminAction.USER_UNBAN, targetType: 'user', targetId: user._id, details: 'Suspension lifted' });
    res.status(200).json({ success: true, message: 'User unsuspended', data: user });
  } catch (error) {
    next(error);
  }
};

// ───────────────────────── Gig approval ─────────────────────────

/** GET /admin/gigs/pending — the approval queue, oldest first. */
export const getPendingGigs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
    const filter = { status: GigStatus.PENDING_APPROVAL };
    const [gigs, total] = await Promise.all([
      Gig.find(filter).populate('client', 'firstName lastName email avatar').sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit),
      Gig.countDocuments(filter),
    ]);
    res.status(200).json({ success: true, message: 'Pending gigs', data: gigs, pagination: buildPaginationResponse(total, page, limit) });
  } catch (error) {
    next(error);
  }
};

// ───────────────────────── Freelancer verification ─────────────────────────

/** GET /admin/verifications?status=pending — verification requests with their (private) documents. */
export const getVerifications = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
    const statuses: VerificationStatus[] = ['pending', 'verified', 'rejected'];
    const status = statuses.find((st) => st === req.query.status) ?? 'pending';
    const filter = { 'verification.status': status };
    const [profiles, total] = await Promise.all([
      FreelancerProfile.find(filter)
        .select('+verification.documents')
        .populate('user', 'firstName lastName email avatar createdAt isVerified')
        .sort({ 'verification.requestedAt': 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      FreelancerProfile.countDocuments(filter),
    ]);
    res.status(200).json({ success: true, message: 'Verification requests', data: profiles, pagination: buildPaginationResponse(total, page, limit) });
  } catch (error) {
    next(error);
  }
};

/** PUT /admin/freelancers/:id/verify and /reject-verification { reason }; :id is the freelancer's user id. */
const reviewVerification = (approve: boolean) => async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reason: string | undefined = req.body?.reason;
    const profile = await FreelancerProfile.findOneAndUpdate(
      { user: req.params.id, 'verification.status': approve ? { $in: ['pending', 'rejected', 'none'] } : 'pending' },
      {
        $set: {
          'verification.status': approve ? 'verified' : 'rejected',
          'verification.reviewedAt': new Date(),
          'verification.reviewedBy': req.user!._id,
          ...(!approve && { 'verification.note': reason }),
        },
        ...(approve && { $unset: { 'verification.note': 1 } }),
      },
      { returnDocument: 'after' }
    );
    if (!profile) {
      const exists = await FreelancerProfile.exists({ user: req.params.id });
      res.status(exists ? 409 : 404).json({
        success: false,
        message: exists ? (approve ? 'Freelancer is already verified' : 'No pending verification request') : 'Freelancer not found',
      });
      return;
    }

    await logAdminAction(req, {
      action: approve ? AdminAction.FREELANCER_VERIFY : AdminAction.FREELANCER_REJECT_VERIFICATION,
      targetType: 'user',
      targetId: profile.user,
      details: approve ? 'Verified freelancer' : `Rejected verification: ${reason}`,
    });
    await notificationService.create({
      recipient: profile.user.toString(),
      type: NotificationType.VERIFICATION_UPDATE,
      title: approve ? 'You are verified' : 'Verification not approved',
      message: approve ? 'Your profile now shows the verified badge.' : `Your verification request was not approved: ${reason}`,
      link: '/freelancer/profile/edit',
    });
    await reputationService.updateUserReputation(profile.user.toString());

    res.status(200).json({ success: true, message: approve ? 'Freelancer verified' : 'Verification rejected', data: profile });
  } catch (error) {
    next(error);
  }
};

export const verifyFreelancer = reviewVerification(true);
export const rejectFreelancerVerification = reviewVerification(false);

/** Number of best-matching freelancers told about a newly approved public gig. */
const NEW_GIG_MATCH_LIMIT = 20;

/** "New gig posted" (in-app + email per preferences) to the top matches from the AI ranking. */
const notifyMatchingFreelancers = async (gig: IGig, alreadyInvited: string[]): Promise<void> => {
  try {
    const matches = await aiMatchingService.matchFreelancersToGig(gig._id, NEW_GIG_MATCH_LIMIT);
    await Promise.all(
      matches.filter((m) => !alreadyInvited.includes(m.freelancerId._id.toString())).map((m) =>
        notificationService.create({
          recipient: m.freelancerId._id.toString(),
          type: NotificationType.GIG_MATCH,
          title: 'New gig matching your skills',
          message: `"${gig.title}" (${Math.round(m.score)}% match) was just posted${m.matchedSkills.length ? ` — ${m.matchedSkills.join(', ')}` : ''}`,
          data: { gigId: gig._id.toString(), score: m.score },
          link: `/gigs/${gig._id}`,
          category: 'gigs',
        })
      )
    );
  } catch (error) {
    // Approval already succeeded; a matching failure must not turn it into an error.
    console.error('New-gig match notifications failed:', error);
  }
};

const reviewGig = (approve: boolean) => async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reason: string | undefined = req.body?.reason;
    const gig = await Gig.findOneAndUpdate(
      { _id: req.params.id, status: GigStatus.PENDING_APPROVAL },
      approve
        ? { $set: { status: GigStatus.OPEN, approvedAt: new Date() }, $unset: { rejectionReason: 1 } }
        : { $set: { status: GigStatus.REJECTED, rejectionReason: reason } },
      { returnDocument: 'after' }
    );
    if (!gig) {
      const exists = await Gig.exists({ _id: req.params.id });
      res.status(exists ? 409 : 404).json({ success: false, message: exists ? 'Gig is not awaiting approval' : 'Gig not found' });
      return;
    }

    await logAdminAction(req, {
      action: approve ? AdminAction.GIG_APPROVE : AdminAction.GIG_REJECT,
      targetType: 'gig',
      targetId: gig._id,
      details: approve ? `Approved "${gig.title}"` : `Rejected "${gig.title}": ${reason}`,
    });
    await notificationService.create({
      recipient: gig.client.toString(),
      type: approve ? NotificationType.GIG_APPROVED : NotificationType.GIG_REJECTED,
      title: approve ? 'Gig approved' : 'Gig not approved',
      message: approve ? `"${gig.title}" is now live in the marketplace` : `"${gig.title}" was not approved: ${reason}`,
      data: { gigId: gig._id.toString() },
      link: `/gigs/${gig._id}`,
    });

    if (approve) {
      const owner = await User.findById(gig.client).select('firstName lastName');
      const pending = gig.invitations.filter((i) => i.status === 'pending');
      if (owner) await Promise.all(pending.map((i) => notificationService.notifyGigInvitation(gig, i.freelancer.toString(), owner)));
      if (gig.visibility === 'public') await notifyMatchingFreelancers(gig, pending.map((i) => i.freelancer.toString()));
    }

    res.status(200).json({ success: true, message: approve ? 'Gig approved' : 'Gig rejected', data: gig });
  } catch (error) {
    next(error);
  }
};

/** PUT /admin/gigs/:id/approve */
export const approveGig = reviewGig(true);
/** PUT /admin/gigs/:id/reject { reason } */
export const rejectGig = reviewGig(false);

// ───────────────────────── Payments & fraud ─────────────────────────

/** GET /admin/payments?status=&page= — every payment plus platform totals by status. */
export const getPayments = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
    const filter: Record<string, unknown> = {};
    if (typeof req.query.status === 'string' && (Object.values(PaymentStatus) as string[]).includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const [payments, total, totals, revenue] = await Promise.all([
      Payment.find(filter)
        .populate('gig', 'title')
        .populate('client', 'firstName lastName email')
        .populate('freelancer', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Payment.countDocuments(filter),
      Payment.aggregate([{ $group: { _id: '$status', amount: { $sum: '$amount' }, fees: { $sum: '$platformFee' }, count: { $sum: 1 } } }]),
      paymentService.calculatePlatformRevenue(),
    ]);

    res.status(200).json({
      success: true,
      message: 'Payments retrieved',
      data: { payments, totals, revenue },
      pagination: buildPaginationResponse(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

const userLookup = [
  {
    $lookup: {
      from: 'users',
      localField: '_id',
      foreignField: '_id',
      as: 'user',
      pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1, isBanned: 1 } }],
    },
  },
  { $unwind: '$user' },
];

/**
 * GET /admin/fraud — flagged/reported reviews, users with repeated disputes against them,
 * and clients with many refunds. (IP-sharing signals arrive with plan 4.8.)
 */
export const getFraudReport = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [flaggedReviews, disputedUsers, refundHeavyClients] = await Promise.all([
      Review.find({ isFlagged: true })
        .populate('reviewer', 'firstName lastName email createdAt')
        .populate('reviewee', 'firstName lastName email')
        .populate('gig', 'title')
        .sort({ createdAt: -1 })
        .limit(50),
      Dispute.aggregate([
        { $group: { _id: '$against', disputes: { $sum: 1 } } },
        { $match: { disputes: { $gte: 2 } } },
        { $sort: { disputes: -1 } },
        { $limit: 20 },
        ...userLookup,
      ]),
      Payment.aggregate([
        { $match: { status: PaymentStatus.REFUNDED } },
        { $group: { _id: '$client', refunds: { $sum: 1 }, amount: { $sum: '$amount' } } },
        { $match: { refunds: { $gte: 3 } } },
        { $sort: { refunds: -1 } },
        { $limit: 20 },
        ...userLookup,
      ]),
    ]);

    res.status(200).json({ success: true, message: 'Fraud report', data: { flaggedReviews, disputedUsers, refundHeavyClients } });
  } catch (error) {
    next(error);
  }
};

/** PUT /admin/reviews/:id/visibility { isVisible } — moderation decision; recomputes the reviewee's reputation. */
export const setReviewVisibility = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { isVisible } = req.body as { isVisible: boolean };
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $set: { isVisible, isFlagged: false } },
      { returnDocument: 'after' }
    );
    if (!review) {
      res.status(404).json({ success: false, message: 'Review not found' });
      return;
    }
    await reputationService.updateUserReputation(review.reviewee.toString());
    await logAdminAction(req, {
      action: AdminAction.REVIEW_VISIBILITY,
      targetType: 'review',
      targetId: review._id,
      details: isVisible ? 'Review approved and shown' : 'Review hidden',
    });
    res.status(200).json({ success: true, message: isVisible ? 'Review shown' : 'Review hidden', data: review });
  } catch (error) {
    next(error);
  }
};

/** GET /admin/logs?page=&action= */
export const getLogs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
    const filter: Record<string, unknown> = {};
    if (typeof req.query.action === 'string' && (Object.values(AdminAction) as string[]).includes(req.query.action)) {
      filter.action = req.query.action;
    }
    const [logs, total] = await Promise.all([
      AdminLog.find(filter).populate('admin', 'firstName lastName email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      AdminLog.countDocuments(filter),
    ]);
    res.status(200).json({ success: true, message: 'Admin logs', data: logs, pagination: buildPaginationResponse(total, page, limit) });
  } catch (error) {
    next(error);
  }
};
