import { getRedis } from '../config/redis';
import { env } from '../config/env';

const PREFIX = 'skillsphere:';
const MAX_MEMORY_ENTRIES = 500;

/**
 * Small read-through cache (plan 4.16). Uses Redis when it is connected and an in-process Map
 * otherwise, so several API instances share entries only when REDIS_URL is set. Cache failures
 * are treated as misses: callers always get fresh data rather than an error.
 *
 * Disabled under NODE_ENV=test so suites see their own writes; tests that cover caching call
 * `setEnabled(true)`.
 */
class CacheService {
  private memory = new Map<string, { expires: number; value: string }>();
  private enabled = env.NODE_ENV !== 'test';

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.enabled) return undefined;
    const redis = getRedis();
    try {
      const raw = redis ? await redis.get(PREFIX + key) : this.memoryGet(key);
      return raw == null ? undefined : (JSON.parse(raw) as T);
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.enabled) return;
    const raw = JSON.stringify(value);
    const redis = getRedis();
    try {
      if (redis) await redis.set(PREFIX + key, raw, { EX: ttlSeconds });
      else this.memorySet(key, raw, ttlSeconds);
    } catch {
      // A failed write only means the next read misses.
    }
  }

  /** Returns the cached value for `key`, or computes, stores and returns it. */
  async wrap<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== undefined) return hit;
    const value = await compute();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /** Drops every entry whose key starts with `prefix` (e.g. `search:` after a gig is approved). */
  async invalidate(prefix: string): Promise<void> {
    for (const key of this.memory.keys()) if (key.startsWith(prefix)) this.memory.delete(key);
    const redis = getRedis();
    if (!redis) return;
    try {
      const keys: string[] = [];
      for await (const key of redis.scanIterator({ MATCH: `${PREFIX}${prefix}*`, COUNT: 200 })) keys.push(key);
      if (keys.length) await redis.del(keys);
    } catch {
      // Entries expire on their own TTL.
    }
  }

  /** Test helper: empties the in-memory store. */
  clear(): void {
    this.memory.clear();
  }

  private memoryGet(key: string): string | undefined {
    const entry = this.memory.get(key);
    if (!entry) return undefined;
    if (entry.expires <= Date.now()) {
      this.memory.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private memorySet(key: string, value: string, ttlSeconds: number): void {
    // Oldest-first eviction keeps memory bounded when Redis is absent.
    if (this.memory.size >= MAX_MEMORY_ENTRIES) this.memory.delete(this.memory.keys().next().value!);
    this.memory.delete(key);
    this.memory.set(key, { expires: Date.now() + ttlSeconds * 1000, value });
  }
}

export default new CacheService();
