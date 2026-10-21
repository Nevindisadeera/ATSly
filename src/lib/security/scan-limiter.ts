import "server-only";

import type { Owner } from "@/lib/auth/owner";
import { env } from "@/lib/config/env";

import type { RateLimiter } from "./rate-limit";
import { createMongoRateLimiter } from "./rate-limit-mongo";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Scan limits — docs/PLANNING.md §23: per guest, per user and per client address, per day. */
export const scanRateLimiters: Record<Owner["type"] | "ip", RateLimiter> = {
  guest: createMongoRateLimiter({
    limit: env.RATE_LIMIT_SCANS_GUEST_PER_DAY,
    windowMs: DAY_MS,
  }),
  user: createMongoRateLimiter({
    limit: env.RATE_LIMIT_SCANS_USER_PER_DAY,
    windowMs: DAY_MS,
  }),
  ip: createMongoRateLimiter({
    limit: env.RATE_LIMIT_SCANS_IP_PER_DAY,
    windowMs: DAY_MS,
  }),
};

/**
 * Counts one scan against both the owner's and the address's daily limit. When either is
 * used up the scan is refused, with the longer of the two waits.
 */
export async function consumeScanQuota(
  owner: Owner,
  address: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const results = await Promise.all([
    scanRateLimiters[owner.type].consume(`scan:${owner.type}:${owner.id}`),
    scanRateLimiters.ip.consume(`scan:ip:${address}`),
  ]);
  const blocked = results.filter((r) => !r.allowed);
  return {
    allowed: blocked.length === 0,
    retryAfterSeconds: Math.max(0, ...blocked.map((r) => r.retryAfterSeconds)),
  };
}
