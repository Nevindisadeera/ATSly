import { z } from "zod";

/**
 * Server environment schema.
 *
 * Variables are added in the phase that first needs them (see
 * docs/PLANNING.md, Appendix A). Phase 1 defines only what the skeleton uses.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  /** Uploads allowed per IP address per hour (Phase 4b). */
  RATE_LIMIT_UPLOADS_PER_HOUR: z.coerce.number().int().positive().default(15),
});

export type Env = z.infer<typeof envSchema>;

/** Parses an environment record and throws a readable error listing every invalid variable. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}
