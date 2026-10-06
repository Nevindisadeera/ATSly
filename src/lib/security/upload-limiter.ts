import { env } from "@/lib/config/env";

import { createMemoryRateLimiter } from "./rate-limit";

/** Upload limit per client address: RATE_LIMIT_UPLOADS_PER_HOUR per rolling hour window. */
export const uploadRateLimiter = createMemoryRateLimiter({
  limit: env.RATE_LIMIT_UPLOADS_PER_HOUR,
  windowMs: 60 * 60 * 1000,
});
