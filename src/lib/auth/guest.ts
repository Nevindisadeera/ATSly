import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { AppError } from "@/lib/http/errors";
import { logger } from "@/lib/logging/logger";

/**
 * Guest identity — docs/PLANNING.md §23. A random id in an HttpOnly cookie, signed with
 * AUTH_SECRET so it can't be forged or guessed into someone else's data. It is issued on the
 * first upload, never just for visiting the site.
 */

export const GUEST_COOKIE = "atsly_gid";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    logger.error("auth.secret_missing", { variable: "AUTH_SECRET" });
    throw new AppError("SERVICE_UNAVAILABLE", { message: "Sign-in is not configured." });
  }
  return value;
}

function sign(id: string): string {
  return createHmac("sha256", secret()).update(`guest:${id}`).digest("base64url");
}

export function encodeGuestCookie(id: string): string {
  return `${id}.${sign(id)}`;
}

/** Returns the guest id if the cookie value is well-formed and correctly signed. */
export function decodeGuestCookie(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot === -1) return null;
  const id = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  if (!UUID.test(id)) return null;
  const expected = Buffer.from(sign(id));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given) ? id : null;
}

export function readCookie(headers: Headers, name: string): string | undefined {
  const header = headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name)
      return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

export function guestCookieHeader(id: string, secure: boolean): string {
  return [
    `${GUEST_COOKIE}=${encodeURIComponent(encodeGuestCookie(id))}`,
    "Path=/",
    `Max-Age=${MAX_AGE_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}
