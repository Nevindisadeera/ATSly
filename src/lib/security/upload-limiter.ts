import "server-only";

import { env } from "@/lib/config/env";

import { createMongoRateLimiter } from "./rate-limit-mongo";

/** Upload limit per client address: RATE_LIMIT_UPLOADS_PER_HOUR per fixed hour window. */
export const uploadRateLimiter = createMongoRateLimiter({
  limit: env.RATE_LIMIT_UPLOADS_PER_HOUR,
  windowMs: 60 * 60 * 1000,
});
