import "server-only";

import { RateLimitModel } from "@/lib/db/models/rate-limit";
import { withDb } from "@/lib/db/with-db";

import type { RateLimiter } from "./rate-limit";

const DUPLICATE_KEY = 11000;

/**
 * Fixed-window limiter stored in MongoDB, so every server instance shares the same counts.
 * Each window is one document keyed by `${key}:${windowIndex}`; an atomic upsert with $inc
 * counts the request, and the TTL index removes windows a day after they end.
 */
export function createMongoRateLimiter(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): RateLimiter {
  const { limit, windowMs, now = Date.now } = options;

  const increment = (key: string, expiresAt: Date) =>
    RateLimitModel.findOneAndUpdate(
      { key },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, returnDocument: "after", lean: true },
    );

  return {
    consume(key) {
      return withDb(async () => {
        const time = now();
        const window = Math.floor(time / windowMs);
        const windowEnd = (window + 1) * windowMs;
        const windowKey = `${key}:${window}`;
        const expiresAt = new Date(windowEnd + 24 * 60 * 60 * 1000);

        let doc;
        try {
          doc = await increment(windowKey, expiresAt);
        } catch (error) {
          // Two first requests can race to insert the same window; the loser retries.
          if ((error as { code?: number }).code !== DUPLICATE_KEY) throw error;
          doc = await increment(windowKey, expiresAt);
        }

        const count = doc?.count ?? 1;
        return {
          allowed: count <= limit,
          limit,
          remaining: Math.max(0, limit - count),
          retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - time) / 1000)),
        };
      });
    },
    reset() {
      return withDb(async () => {
        await RateLimitModel.deleteMany({});
      });
    },
  };
}
