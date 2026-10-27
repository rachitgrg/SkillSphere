/**
 * Self-contained API for Playwright: `npm run e2e:server` (from server/).
 *
 * Starts an in-memory MongoDB, seeds the demo data into it, then boots the normal server with
 * NODE_ENV=test (so the root .env with real keys is never read and rate limits are off) and
 * SIMULATE_PAYMENTS=true (checkout completes without Razorpay). Every external integration is off.
 */
import { spawn } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import { MongoMemoryServer } from 'mongodb-memory-server';

const main = async () => {
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri('skillsphere_e2e');

  Object.assign(process.env, {
    NODE_ENV: 'test',
    PORT: process.env.E2E_API_PORT ?? '5100',
    MONGO_URI: uri,
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    JWT_REFRESH_SECRET: crypto.randomBytes(32).toString('hex'),
    CLIENT_URL: process.env.E2E_CLIENT_URL ?? 'http://localhost:5175',
    SIMULATE_PAYMENTS: 'true',
  });

  // Async on purpose: a sync child would block this event loop, and with it the pipe that
  // drains mongod's output, so mongod (and the seed waiting on it) would stall.
  await new Promise<void>((resolve, reject) => {
    const seed = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', path.join(__dirname, 'seed.ts')], {
      env: process.env,
      stdio: 'inherit',
    });
    seed.on('error', reject);
    seed.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`seed exited with code ${code}`))));
  });

  const stop = () => void mongo.stop().finally(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  await import('../src/server');
};

main().catch((error) => {
  console.error('E2E server failed to start:', error);
  process.exit(1);
});
