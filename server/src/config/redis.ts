import { createClient } from 'redis';
import { env, features } from './env';

export type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;

/**
 * Connects to REDIS_URL when it is set. Never throws: without Redis (or while it is down) the cache
 * falls back to memory and Socket.IO keeps its in-process adapter.
 */
export const connectRedis = async (): Promise<RedisClient | null> => {
  if (!features.redis || client) return client;
  let connectedOnce = false;
  const candidate = createClient({
    url: env.REDIS_URL,
    socket: {
      connectTimeout: 5000,
      // Before the first successful connection, returning an Error makes connect() reject so boot
      // continues without Redis (node-redis would otherwise retry forever). Afterwards, back off.
      reconnectStrategy: (retries) =>
        connectedOnce ? Math.min(retries * 500, 10_000) : retries >= 2 ? new Error('Redis unreachable') : 500,
    },
  });
  let warned = false;
  candidate.on('error', (error: Error) => {
    if (warned) return;
    warned = true;
    console.warn(`⚠️  Redis error (${error.message}); caching falls back to memory until it reconnects.`);
  });
  candidate.on('ready', () => {
    connectedOnce = true;
    warned = false;
  });
  try {
    await candidate.connect();
    client = candidate;
    console.log('Redis connected');
  } catch (error) {
    console.warn(`⚠️  Could not connect to Redis (${(error as Error).message}); using in-memory caching.`);
    await candidate.disconnect().catch(() => undefined);
  }
  return client;
};

/** The connected client, or null when Redis is not configured or not currently usable. */
export const getRedis = (): RedisClient | null => (client?.isReady ? client : null);

export const disconnectRedis = async (): Promise<void> => {
  if (!client) return;
  await client.quit().catch(() => undefined);
  client = null;
};
