/**
 * Brings MongoDB indexes in line with the Mongoose schemas: creates missing ones and rebuilds
 * ones whose definition changed (e.g. User.googleId became unique + sparse). Data is untouched.
 *
 *   npm run db:sync-indexes            # uses MONGO_URI from the root .env
 */
import { env } from '../src/config/env';
import mongoose from 'mongoose';
import { syncSchemaIndexes } from './lib/indexes';
import '../src/models/User';
import '../src/models/ClientProfile';
import '../src/models/FreelancerProfile';
import '../src/models/Gig';
import '../src/models/Proposal';
import '../src/models/Payment';
import '../src/models/Review';
import '../src/models/Dispute';
import '../src/models/Conversation';
import '../src/models/Message';
import '../src/models/Notification';
import '../src/models/AdminLog';
import '../src/models/Booking';
import '../src/models/GigView';
import '../src/models/Lock';
import '../src/models/ProfileView';

async function main() {
  await mongoose.connect(env.MONGO_URI);
  console.log(`Syncing indexes on ${mongoose.connection.host}/${mongoose.connection.name} …`);
  for (const model of Object.values(mongoose.models)) {
    const changes = await syncSchemaIndexes(model);
    console.log(`  ${model.modelName}: ${changes.length ? changes.join(', ') : 'up to date'}`);
  }
}

main()
  .catch((error) => {
    console.error('Index sync failed:', error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
