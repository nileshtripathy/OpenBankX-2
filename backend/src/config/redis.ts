import Redis from 'ioredis';
import { env } from './env';

/**
 * Single shared Redis connection used for caching (see utils/cache.ts) and
 * as the pub/sub-free in-process cache backing the realtime layer.
 *
 * Redis is treated as an *optional accelerator*, not a hard dependency:
 * if it's unreachable (e.g. running the API without `docker compose up redis`),
 * every cache read/write becomes a no-op instead of crashing the request.
 * `isRedisReady()` is what call sites check before trusting the cache.
 */
export const redis = new Redis(env.redis.url, {
  maxRetriesPerRequest: 1,
  retryStrategy(times: number) {
    // Back off up to 5s between reconnect attempts instead of hammering it.
    return Math.min(times * 200, 5000);
  },
  lazyConnect: true,
});

let ready = false;

redis.on('connect', () => {
  ready = true;
  console.log('[redis] connected');
});

redis.on('error', (err: Error) => {
  if (ready) console.error('[redis] connection error:', err.message);
  ready = false;
});

redis.on('close', () => {
  ready = false;
});

export function isRedisReady(): boolean {
  return ready;
}

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
  } catch (err) {
    console.warn(
      `[redis] could not connect (${(err as Error).message}) - continuing without cache`
    );
  }
}

export async function disconnectRedis(): Promise<void> {
  try {
    redis.disconnect();
  } catch {
    // ignore
  }
}
