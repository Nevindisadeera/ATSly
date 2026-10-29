import type { Instrumentation } from "next";

import { logger } from "@/lib/logging/logger";

/**
 * Server start-up and error reporting — docs/PLANNING.md §30. Errors go to the platform
 * logs (Vercel) as one JSON line, with the digest a user sees on the error page; never
 * request bodies or document text.
 */
export function register() {
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE) return;
  const missing = ["MONGODB_URI", "AUTH_SECRET"].filter((name) => !process.env[name]);
  if (missing.length > 0)
    logger.error("config.missing", { variables: missing.join(",") });
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : undefined;
  logger.error("request.error", {
    method: request.method,
    // The path without its query, which can carry ids but nothing else of use here.
    path: request.path.split("?")[0],
    routePath: context.routePath,
    routeType: context.routeType,
    errorName: error instanceof Error ? error.name : typeof error,
    digest,
  });
};
