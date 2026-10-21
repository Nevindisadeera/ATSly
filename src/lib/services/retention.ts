import type { Owner } from "@/lib/auth/owner";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When guest-owned data is deleted — docs/PLANNING.md §16.7. Guest resumes, job descriptions
 * and scans expire GUEST_RETENTION_DAYS after they were last used; account data is kept (null).
 */
export function guestExpiry(owner: Owner, now = Date.now()): Date | null {
  if (owner.type !== "guest") return null;
  const days = Number(process.env.GUEST_RETENTION_DAYS) || 7;
  return new Date(now + days * DAY_MS);
}
