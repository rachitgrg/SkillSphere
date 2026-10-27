import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import Payment from '../models/Payment';
import Proposal from '../models/Proposal';
import Gig from '../models/Gig';
import FreelancerProfile from '../models/FreelancerProfile';
import Review from '../models/Review';
import { profileViewSeries } from '../services/profileViewService';
import reputationService from '../services/reputationService';
import { AuthRequest, GigStatus, PaymentStatus, ProposalStatus } from '../types';

const PERIODS: Record<string, number> = { '30d': 30, '90d': 90, '12m': 365 };

/** `period` → start date; defaults to 12 months. */
const periodStart = (period: unknown): { period: string; start: Date } => {
  const key = typeof period === 'string' && PERIODS[period] ? period : '12m';
  return { period: key, start: new Date(Date.now() - PERIODS[key] * 86_400_000) };
};

/** Sums `amountField` of released payments for `match` per calendar month. */
const monthlyTotals = (match: Record<string, unknown>, amountField: string, start: Date) =>
  Payment.aggregate<{ month: string; total: number; count: number }>([
    { $match: { ...match, status: PaymentStatus.RELEASED, releasedAt: { $gte: start } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$releasedAt' } },
        total: { $sum: `$${amountField}` },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, month: '$_id', total: 1, count: 1 } },
  ]);

const sumByStatus = async (match: Record<string, unknown>, amountField: string) => {
  const rows = await Payment.aggregate<{ _id: PaymentStatus; total: number }>([
    { $match: match },
    { $group: { _id: '$status', total: { $sum: `$${amountField}` } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.total])) as Partial<Record<PaymentStatus, number>>;
};

/**
 * GET /analytics/freelancer?period=30d|90d|12m — proposals funnel, earnings and monthly revenue,
 * profile views over time, client feedback analytics (with recent comments) and the skills that won jobs.
 */
export const getFreelancerAnalytics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = new Types.ObjectId(req.user!._id.toString());
    const { period, start } = periodStart(req.query.period);

    const [proposalRows, earnings, monthlyRevenue, feedback, wonGigs, profile, profileViews, recentReviews] = await Promise.all([
      Proposal.aggregate<{ _id: ProposalStatus; count: number }>([
        { $match: { freelancer: userId, createdAt: { $gte: start } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      sumByStatus({ freelancer: userId }, 'freelancerAmount'),
      monthlyTotals({ freelancer: userId }, 'freelancerAmount', start),
      reputationService.getReputationBreakdown(userId.toString()),
      Gig.find({ selectedFreelancer: userId }).select('skills status').lean(),
      FreelancerProfile.findOne({ user: userId }).select('averageRating totalReviews completedGigs totalEarnings').lean(),
      profileViewSeries(userId, start, period === '12m'),
      Review.find({ reviewee: userId, isVisible: true })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('rating comment createdAt reviewer gig')
        .populate('reviewer', 'firstName lastName avatar')
        .populate('gig', 'title')
        .lean(),
    ]);

    const proposals = Object.fromEntries(proposalRows.map((r) => [r._id, r.count])) as Partial<Record<ProposalStatus, number>>;
    const sent = proposalRows.reduce((sum, r) => sum + r.count, 0);
    const accepted = proposals[ProposalStatus.ACCEPTED] ?? 0;

    const skillCounts = new Map<string, number>();
    for (const gig of wonGigs) for (const skill of gig.skills) skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
    const topSkills = [...skillCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([skill, count]) => ({ skill, count }));

    res.status(200).json({
      success: true,
      message: 'Freelancer analytics',
      data: {
        period,
        proposals: { sent, accepted, byStatus: proposals, acceptanceRate: sent ? Math.round((accepted / sent) * 100) : 0 },
        earnings: {
          total: earnings[PaymentStatus.RELEASED] ?? 0,
          pending: (earnings[PaymentStatus.ESCROW] ?? 0) + (earnings[PaymentStatus.DISPUTED] ?? 0),
          released: earnings[PaymentStatus.RELEASED] ?? 0,
        },
        monthlyRevenue,
        profileViews,
        feedback: { ...feedback, recentReviews },
        topSkills,
        activeProjects: wonGigs.filter((g) => g.status === GigStatus.IN_PROGRESS).length,
        completedProjects: wonGigs.filter((g) => g.status === GigStatus.COMPLETED).length,
        profile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/** GET /analytics/client?period= — spending, hires, gig pipeline and top-paid freelancers. */
export const getClientAnalytics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = new Types.ObjectId(req.user!._id.toString());
    const { period, start } = periodStart(req.query.period);

    const [spending, monthlySpending, gigRows, proposalsReceived, topFreelancers] = await Promise.all([
      sumByStatus({ client: userId }, 'amount'),
      monthlyTotals({ client: userId }, 'amount', start),
      Gig.aggregate<{ _id: GigStatus; count: number }>([
        { $match: { client: userId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Gig.aggregate<{ total: number }>([
        { $match: { client: userId, createdAt: { $gte: start } } },
        { $group: { _id: null, total: { $sum: '$totalProposals' } } },
      ]),
      // Who the client paid most in the period.
      Payment.aggregate<{ freelancer: { _id: Types.ObjectId; firstName: string; lastName: string; avatar?: string }; total: number; payments: number }>([
        { $match: { client: userId, status: PaymentStatus.RELEASED, releasedAt: { $gte: start } } },
        { $group: { _id: '$freelancer', total: { $sum: '$amount' }, payments: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'freelancer', pipeline: [{ $project: { firstName: 1, lastName: 1, avatar: 1 } }] } },
        { $unwind: '$freelancer' },
        { $project: { _id: 0, freelancer: 1, total: 1, payments: 1 } },
      ]),
    ]);

    const gigs = Object.fromEntries(gigRows.map((r) => [r._id, r.count])) as Partial<Record<GigStatus, number>>;

    res.status(200).json({
      success: true,
      message: 'Client analytics',
      data: {
        period,
        spending: {
          total: spending[PaymentStatus.RELEASED] ?? 0,
          inEscrow: (spending[PaymentStatus.ESCROW] ?? 0) + (spending[PaymentStatus.DISPUTED] ?? 0),
          refunded: spending[PaymentStatus.REFUNDED] ?? 0,
        },
        monthlySpending,
        gigs: {
          byStatus: gigs,
          total: gigRows.reduce((sum, r) => sum + r.count, 0),
          active: gigs[GigStatus.IN_PROGRESS] ?? 0,
          completed: gigs[GigStatus.COMPLETED] ?? 0,
        },
        hires: (gigs[GigStatus.IN_PROGRESS] ?? 0) + (gigs[GigStatus.COMPLETED] ?? 0),
        proposalsReceived: proposalsReceived[0]?.total ?? 0,
        topFreelancers,
      },
    });
  } catch (error) {
    next(error);
  }
};
