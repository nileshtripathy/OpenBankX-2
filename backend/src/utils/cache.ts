import { redis, isRedisReady } from '../config/redis';

/**
 * Thin caching layer over Redis. Every function is a safe no-op when Redis
 * isn't connected, so callers never need to branch on availability -
 * the app behaves the same (just slower) with or without Redis running.
 */

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isRedisReady()) return null;
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    console.error(`[cache] get(${key}) failed:`, (err as Error).message);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!isRedisReady()) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.error(`[cache] set(${key}) failed:`, (err as Error).message);
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!isRedisReady()) return;
  try {
    await redis.del(key);
  } catch (err) {
    console.error(`[cache] del(${key}) failed:`, (err as Error).message);
  }
}

/** Deletes every key matching a prefix (e.g. `bank:accounts:<userId>:*`). Uses SCAN, not KEYS, to stay non-blocking. */
export async function cacheDelByPrefix(prefix: string): Promise<void> {
  if (!isRedisReady()) return;
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== '0');
  } catch (err) {
    console.error(`[cache] delByPrefix(${prefix}) failed:`, (err as Error).message);
  }
}

/**
 * Read-through cache: returns the cached value if present, otherwise calls
 * `loader()`, caches the result, and returns it. This is the pattern used
 * by most of the caching call sites in the services layer.
 */
export async function cacheWrap<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const fresh = await loader();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}
