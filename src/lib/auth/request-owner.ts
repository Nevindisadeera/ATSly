import "server-only";

import { randomUUID } from "node:crypto";

import { decodeGuestCookie, GUEST_COOKIE, guestCookieHeader, readCookie } from "./guest";
import type { Owner } from "./owner";
import { sessionUserId } from "./session";

export type ResolvedOwner = {
  owner: Owner;
  /** Set-Cookie header value when a new guest identity was issued. */
  setCookie?: string;
};

/**
 * The owner of a request — docs/PLANNING.md §23: the signed-in user if there is a session,
 * otherwise the signed guest cookie. With `create`, a guest without a (valid) cookie gets a
 * new guest identity; signed-in users never do.
 */
export async function resolveOwner(
  request: Request,
  options: { create: true },
): Promise<ResolvedOwner>;
export async function resolveOwner(
  request: Request,
  options?: { create?: false },
): Promise<ResolvedOwner | null>;
export async function resolveOwner(
  request: Request,
  options: { create?: boolean } = {},
): Promise<ResolvedOwner | null> {
  const userId = await sessionUserId(request.headers);
  if (userId) return { owner: { type: "user", id: userId } };

  const existing = decodeGuestCookie(readCookie(request.headers, GUEST_COOKIE));
  if (existing) return { owner: { type: "guest", id: existing } };
  if (!options.create) return null;

  const id = randomUUID();
  const secure =
    process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:";
  return { owner: { type: "guest", id }, setCookie: guestCookieHeader(id, secure) };
}
