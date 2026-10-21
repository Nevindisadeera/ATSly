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
  /** Scans allowed per guest, per signed-in user and per IP address per day (Phase 7b). */
  RATE_LIMIT_SCANS_GUEST_PER_DAY: z.coerce.number().int().positive().default(3),
  RATE_LIMIT_SCANS_USER_PER_DAY: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_SCANS_IP_PER_DAY: z.coerce.number().int().positive().default(10),
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
  /**
   * AI analysis (Phase 10a). "mock" is a deterministic offline provider for development and
   * tests; "openai" needs OPENAI_API_KEY. Without a key the default is mock.
   */
  AI_PROVIDER: z.enum(["openai", "mock", "off"]).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  /** Model for all three tasks; the eval set (npm run eval:ai) is how a model is chosen. */
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  /** Per-call timeout. */
  AI_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(25_000),
  /** Global daily AI spend cap in US dollars; scans skip AI once it's reached. */
  AI_DAILY_BUDGET_USD: z.coerce.number().min(0).default(5),
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
