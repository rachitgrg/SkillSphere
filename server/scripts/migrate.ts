/**
 * Idempotent data migrations for schema changes. Safe to re-run.
 *
 *   npm run db:migrate            # uses MONGO_URI from the root .env
 *
 * - Gig.attachments: plain URL strings → { url, name } objects (plan 4.4).
 * - Gig.milestones: status "completed" → "submitted" (plan 4.14 status flow).
 * - User.refreshToken (one session per user) → dropped; sessions now live in User.refreshSessions
 *   (final-fix plan P1-3). Users signed in before this sign in once more.
 * - Payments: extra *pending* orders for a milestone that already has a live payment become
 *   "cancelled", so the one-live-payment-per-milestone unique index can be built (P1-4).
 *   Run this before `npm run db:sync-indexes`.
 * - Freelancer location: FreelancerProfile.location is the source of truth (P2-13). Profiles without
 *   one take the account's; otherwise the account gets the profile's.
 */
import { env } from '../src/config/env';
import mongoose from 'mongoose';
import path from 'path';

async function main() {
  await mongoose.connect(env.MONGO_URI);
  const gigs = mongoose.connection.collection('gigs');

  let converted = 0;
  for await (const gig of gigs.find({ attachments: { $elemMatch: { $type: 'string' } } })) {
    const attachments = (gig.attachments as unknown[]).map((a) =>
      typeof a === 'string' ? { _id: new mongoose.Types.ObjectId(), url: a, name: decodeURIComponent(path.basename(new URL(a).pathname)) || 'attachment' } : a
    );
    await gigs.updateOne({ _id: gig._id }, { $set: { attachments } });
    converted += 1;
  }
  console.log(`Gig attachments: converted ${converted} gig(s).`);

  const milestones = await gigs.updateMany(
    { 'milestones.status': 'completed' },
    { $set: { 'milestones.$[m].status': 'submitted' } },
    { arrayFilters: [{ 'm.status': 'completed' }] }
  );
  console.log(`Milestones: ${milestones.modifiedCount} gig(s) moved from "completed" to "submitted".`);

  const sessions = await mongoose.connection.collection('users').updateMany({ refreshToken: { $exists: true } }, { $unset: { refreshToken: 1 } });
  console.log(`Users: dropped the old single refreshToken from ${sessions.modifiedCount} user(s).`);

  // Keep the most advanced live payment per milestone (released > disputed > escrow > newest pending).
  const payments = mongoose.connection.collection('payments');
  const rank: Record<string, number> = { released: 0, disputed: 1, escrow: 2, pending: 3 };
  const duplicates = payments.aggregate<{ ids: { _id: mongoose.Types.ObjectId; status: string; createdAt: Date }[] }>([
    { $match: { milestone: { $exists: true }, status: { $in: Object.keys(rank) } } },
    { $group: { _id: { gig: '$gig', milestone: '$milestone' }, ids: { $push: { _id: '$_id', status: '$status', createdAt: '$createdAt' } }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  let cancelled = 0;
  for await (const group of duplicates) {
    const [, ...extra] = group.ids.sort((a, b) => rank[a.status] - rank[b.status] || +b.createdAt - +a.createdAt);
    const stale = extra.filter((p) => p.status === 'pending').map((p) => p._id);
    if (extra.length > stale.length) console.warn(`Milestone ${JSON.stringify(group._id)} has several captured payments; resolve by hand.`);
    if (stale.length) cancelled += (await payments.updateMany({ _id: { $in: stale } }, { $set: { status: 'cancelled' } })).modifiedCount;
  }
  console.log(`Payments: cancelled ${cancelled} duplicate pending order(s).`);

  const users = mongoose.connection.collection('users');
  const profiles = mongoose.connection.collection('freelancerprofiles');
  let toProfile = 0;
  let toUser = 0;
  for await (const freelancer of users.find({ role: 'freelancer' }, { projection: { location: 1 } })) {
    const profile = await profiles.findOne({ user: freelancer._id }, { projection: { location: 1 } });
    if (!profile) continue;
    const hasPoint = (l: unknown) => Array.isArray((l as { coordinates?: unknown })?.coordinates) && (l as { coordinates: unknown[] }).coordinates.length === 2;
    if (!hasPoint(profile.location) && hasPoint(freelancer.location)) {
      await profiles.updateOne({ _id: profile._id }, { $set: { location: freelancer.location } });
      toProfile += 1;
    } else if (hasPoint(profile.location) && JSON.stringify(profile.location) !== JSON.stringify(freelancer.location)) {
      await users.updateOne({ _id: freelancer._id }, { $set: { location: profile.location } });
      toUser += 1;
    }
  }
  console.log(`Freelancer location: ${toProfile} profile(s) filled from the account, ${toUser} account(s) synced from the profile.`);
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
