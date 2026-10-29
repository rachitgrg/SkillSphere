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
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
