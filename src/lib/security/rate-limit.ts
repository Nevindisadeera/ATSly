/**
 * Fixed-window rate limiting. The interface is shared by the in-memory limiter (unit tests,
 * single-process use) and the MongoDB limiter used in the app (rate-limit-mongo.ts), whose
 * counters hold across serverless instances — docs/PLANNING.md §16.6.
 */

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window resets. */
  retryAfterSeconds: number;
};

export interface RateLimiter {
  consume(key: string): Promise<RateLimitResult>;
  reset(): Promise<void>;
}

type Window = { start: number; count: number };

export function createMemoryRateLimiter(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
  /** Upper bound on tracked keys so the map cannot grow without limit. */
  maxKeys?: number;
}): RateLimiter {
  const { limit, windowMs, now = Date.now, maxKeys = 10_000 } = options;
  const windows = new Map<string, Window>();

  const sweep = (time: number) => {
    for (const [key, w] of windows) {
      if (time - w.start >= windowMs) windows.delete(key);
    }
  };

  return {
    async consume(key) {
      const time = now();
      let w = windows.get(key);
      if (!w || time - w.start >= windowMs) {
        if (windows.size >= maxKeys) sweep(time);
        w = { start: time, count: 0 };
        windows.set(key, w);
      }
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((w.start + windowMs - time) / 1000),
      );
      if (w.count >= limit) {
        return { allowed: false, limit, remaining: 0, retryAfterSeconds };
      }
      w.count += 1;
      return { allowed: true, limit, remaining: limit - w.count, retryAfterSeconds };
    },
    async reset() {
      windows.clear();
    },
  };
}

/**
 * Best-effort client address. On Vercel, x-forwarded-for is set by the platform; the first
 * entry is the client. Falls back to a shared bucket rather than skipping the limit.
 */
export function clientAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip")?.trim() || "unknown";
}
