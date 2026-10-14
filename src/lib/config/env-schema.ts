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
  /**
   * MongoDB connection string (Phase 6). Optional at build time so pages build without a
   * database; any request that needs the database fails with 503 until it is set.
   */
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, "must start with mongodb:// or mongodb+srv://")
    .optional(),
  /** Secret for signing cookies (Phase 6). At least 32 characters. */
  AUTH_SECRET: z.string().min(32, "must be at least 32 characters").optional(),
  /** Days before data owned by a guest (no account) is deleted. */
  GUEST_RETENTION_DAYS: z.coerce.number().int().min(1).max(90).default(7),
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
