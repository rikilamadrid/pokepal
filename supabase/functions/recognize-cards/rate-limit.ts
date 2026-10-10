/**
 * Per-user rate limit for `recognize-cards`: a fixed window per user id.
 *
 * In-memory, so it holds per Edge Function instance only; a cold start or a
 * second instance starts a fresh count. That bounds bursts from one user
 * without a database table. A limit shared across instances needs a table on
 * the live project, which is a human-gated schema change.
 */

export interface RateLimiter {
  /** Count one request for `key`; false when the key is over its limit. */
  take(key: string): boolean;
}

export interface MemoryRateLimiterOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

/** Above this many tracked keys, expired windows are swept. */
const SWEEP_AT = 1_000;

export function createMemoryRateLimiter(options: MemoryRateLimiterOptions): RateLimiter {
  const now = options.now ?? Date.now;
  const windows = new Map<string, { start: number; count: number }>();
  return {
    take(key) {
      const t = now();
      if (windows.size > SWEEP_AT) {
        for (const [k, w] of windows) if (t - w.start >= options.windowMs) windows.delete(k);
      }
      const current = windows.get(key);
      if (!current || t - current.start >= options.windowMs) {
        windows.set(key, { start: t, count: 1 });
        return true;
      }
      current.count += 1;
      return current.count <= options.limit;
    },
  };
}
