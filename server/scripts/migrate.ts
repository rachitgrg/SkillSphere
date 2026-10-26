/**
 * Idempotent data migrations for schema changes. Safe to re-run.
 *
 *   npm run db:migrate            # uses MONGO_URI from the root .env
 *
 * - Gig.attachments: plain URL strings → { url, name } objects (plan 4.4).
 * - Gig.milestones: status "completed" → "submitted" (plan 4.14 status flow).
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
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
