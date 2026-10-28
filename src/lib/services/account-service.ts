import "server-only";

import type { Owner } from "@/lib/auth/owner";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { AUTH_RATE_LIMITS } from "@/lib/config/limits";
import { jobDescriptionRepository } from "@/lib/db/repositories/job-description-repository";
import { resumeRepository } from "@/lib/db/repositories/resume-repository";
import { scanRepository } from "@/lib/db/repositories/scan-repository";
import {
  isDuplicateKeyError,
  normalizeEmail,
  userRepository,
} from "@/lib/db/repositories/user-repository";
import { AppError } from "@/lib/http/errors";
import { logger } from "@/lib/logging/logger";
import { createMongoRateLimiter } from "@/lib/security/rate-limit-mongo";
import type { RegisterInput } from "@/lib/validation/auth";

/**
 * Accounts — docs/PLANNING.md §7.5, §16.1 and §23: sign-up, password sign-in with rate
 * limits, Google sign-in, and moving a guest's data to the account they sign in to.
 */

const HOUR_MS = 60 * 60 * 1000;
const QUARTER_HOUR_MS = 15 * 60 * 1000;

export const authRateLimiters = {
  register: createMongoRateLimiter({
    limit: AUTH_RATE_LIMITS.registerPerIpPerHour,
    windowMs: HOUR_MS,
  }),
  loginEmail: createMongoRateLimiter({
    limit: AUTH_RATE_LIMITS.loginPerEmailPer15Min,
    windowMs: QUARTER_HOUR_MS,
  }),
  loginIp: createMongoRateLimiter({
    limit: AUTH_RATE_LIMITS.loginPerIpPer15Min,
    windowMs: QUARTER_HOUR_MS,
  }),
};

/** The account details a session carries. */
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
};

type Context = { requestId: string; address: string };

export async function registerUser(
  input: RegisterInput,
  context: Context,
): Promise<{ id: string }> {
  const quota = await authRateLimiters.register.consume(`register:ip:${context.address}`);
  if (!quota.allowed) {
    throw new AppError("RATE_LIMITED", {
      message: "Too many sign-ups from this network. Try again later.",
      headers: { "Retry-After": String(quota.retryAfterSeconds) },
    });
  }

  if (await userRepository.findByEmail(input.email)) throw new AppError("EMAIL_TAKEN");
  try {
    const user = await userRepository.create({
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
    });
    logger.info("account.registered", { requestId: context.requestId, userId: user.id });
    return { id: user.id };
  } catch (error) {
    // Two sign-ups with the same email can race past the check above.
    if (isDuplicateKeyError(error)) throw new AppError("EMAIL_TAKEN");
    throw error;
  }
}

export type CredentialsResult =
  { ok: true; user: SessionUser } | { ok: false; reason: "invalid" | "rate_limited" };

/**
 * Checks an email and password. Attempts are limited per address and per email, counted
 * before the password is checked so guessing is limited whether or not it succeeds.
 */
export async function authenticateWithPassword(
  email: string,
  password: string,
  address: string,
): Promise<CredentialsResult> {
  const normalized = normalizeEmail(email);
  const [byIp, byEmail] = await Promise.all([
    authRateLimiters.loginIp.consume(`login:ip:${address}`),
    authRateLimiters.loginEmail.consume(`login:email:${normalized}`),
  ]);
  if (!byIp.allowed || !byEmail.allowed) {
    logger.warn("account.login_rate_limited", { byIp: !byIp.allowed });
    return { ok: false, reason: "rate_limited" };
  }

  const user = await userRepository.findByEmail(normalized);
  const valid = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !valid) return { ok: false, reason: "invalid" };

  await userRepository.touchLogin(user.id);
  return {
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, image: user.image },
  };
}

/** Google sign-in, only for emails Google has verified (§16.1). Null when refused. */
export async function signInWithGoogle(profile: {
  email?: string | null;
  emailVerified: boolean;
  name?: string | null;
  image?: string | null;
  providerAccountId: string;
}): Promise<SessionUser | null> {
  if (!profile.email || !profile.emailVerified) return null;
  const user = await userRepository.upsertGoogle({
    email: profile.email,
    name: profile.name?.trim() || profile.email.split("@")[0]!,
    image: profile.image ?? undefined,
    providerAccountId: profile.providerAccountId,
  });
  return { id: user.id, email: user.email, name: user.name, image: user.image };
}

/**
 * Moves a guest's resumes, job descriptions and scans to the account they signed in to,
 * and stops them expiring (§5, §23). Safe to run more than once: a second run finds
 * nothing left to move.
 */
export async function claimGuestData(
  guestId: string,
  userId: string,
  context: { requestId?: string } = {},
): Promise<{ resumes: number; scans: number; jobDescriptions: number }> {
  const from: Owner = { type: "guest", id: guestId };
  const to: Owner = { type: "user", id: userId };
  const [resumes, jobDescriptions, scans] = await Promise.all([
    resumeRepository.reown(from, to),
    jobDescriptionRepository.reown(from, to),
    scanRepository.reown(from, to),
  ]);
  if (resumes + jobDescriptions + scans > 0) {
    logger.info("account.guest_claimed", {
      requestId: context.requestId,
      userId,
      resumes,
      scans,
      jobDescriptions,
    });
  }
  return { resumes, scans, jobDescriptions };
}
