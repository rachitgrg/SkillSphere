import crypto from 'crypto';
import { Request } from 'express';
import { Types } from 'mongoose';
import ProfileView from '../models/ProfileView';
import Gig from '../models/Gig';
import GigView from '../models/GigView';
import { AuthRequest, UserRole } from '../types';

const DAY = 86_400_000;

export const startOfUtcDay = (date: Date) => new Date(Math.floor(date.getTime() / DAY) * DAY);

/** Signed-in viewers count once per day by id; anonymous ones by a hash of IP + user agent. */
const viewerKey = (req: Request) => {
  const userId = (req as AuthRequest).user?._id;
  if (userId) return `u:${userId}`;
  return `a:${crypto.createHash('sha256').update(`${req.ip}|${req.get('user-agent') ?? ''}`).digest('hex').slice(0, 20)}`;
};

/**
 * Counts a public profile view, at most once per viewer per day; the freelancer's own views are
 * ignored. Never throws: a failed counter must not break the profile page.
 */
export const recordProfileView = async (req: Request, freelancerId: Types.ObjectId): Promise<void> => {
  if ((req as AuthRequest).user?._id.equals(freelancerId)) return;
  const key = viewerKey(req);
  try {
    // When today's document already lists this viewer the filter misses, the upsert tries to insert a
    // second (freelancer, day) document and the unique index rejects it: that is the dedupe.
    await ProfileView.updateOne(
      { freelancer: freelancerId, day: startOfUtcDay(new Date()), viewers: { $ne: key } },
      { $inc: { count: 1 }, $push: { viewers: key } },
      { upsert: true }
    );
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) console.warn(`⚠️  Profile view not recorded: ${(error as Error).message}`);
  }
};

/**
 * Counts a gig view on Gig.views, at most once per viewer per day; the owner and admins are not
 * counted. Never throws: a failed counter must not break the gig page.
 */
export const recordGigView = async (req: Request, gig: { _id: Types.ObjectId; client: Types.ObjectId }): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (user && (user._id.equals(gig.client) || user.role === UserRole.ADMIN)) return;
  const key = viewerKey(req);
  try {
    // Same dedupe as profile views: a repeat viewer misses the filter and the upsert hits the unique index.
    const res = await GigView.updateOne(
      { gig: gig._id, day: startOfUtcDay(new Date()), viewers: { $ne: key } },
      { $push: { viewers: key } },
      { upsert: true }
    );
    // Atomic increment: never re-validates (or rewrites) the whole gig document.
    if (res.modifiedCount || res.upsertedCount) await Gig.updateOne({ _id: gig._id }, { $inc: { views: 1 } });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) console.warn(`⚠️  Gig view not recorded: ${(error as Error).message}`);
  }
};

/** Views per day (30d/90d, zero-filled) or per month (12m) since `start`, plus the total. */
export const profileViewSeries = async (freelancerId: Types.ObjectId, start: Date, monthly: boolean) => {
  const rows = await ProfileView.find({ freelancer: freelancerId, day: { $gte: startOfUtcDay(start) } }).select('day count').lean();
  const label = (d: Date) => d.toISOString().slice(0, monthly ? 7 : 10);
  const buckets = new Map<string, number>();
  if (!monthly) for (let t = startOfUtcDay(start).getTime(); t <= Date.now(); t += DAY) buckets.set(label(new Date(t)), 0);
  for (const row of rows) buckets.set(label(row.day), (buckets.get(label(row.day)) ?? 0) + row.count);
  const series = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, views]) => ({ date, views }));
  return { total: rows.reduce((sum, r) => sum + r.count, 0), series };
};
