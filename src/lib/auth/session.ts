import "server-only";

import { getToken } from "next-auth/jwt";

/**
 * The Auth.js session cookie (JWT strategy) — docs/PLANNING.md §16.1. Read with getToken so
 * route handlers, Server Components and the proxy all decide "who is this" the same way,
 * from the request headers alone. Over HTTPS the cookie carries the __Secure- prefix, and
 * browsers only send such cookies over HTTPS, so its presence decides which name to read.
 */
export const SESSION_COOKIE = "authjs.session-token";
export const SECURE_SESSION_COOKIE = `__Secure-${SESSION_COOKIE}`;

const OBJECT_ID = /^[0-9a-f]{24}$/i;

/** The signed-in user's id, or null without a valid, unexpired session. */
export async function sessionUserId(headers: Headers): Promise<string | null> {
  const cookie = headers.get("cookie") ?? "";
  const secret = process.env.AUTH_SECRET;
  if (!secret || !cookie.includes(SESSION_COOKIE)) return null;
  try {
    const token = await getToken({
      req: { headers },
      secret,
      secureCookie: cookie.includes(SECURE_SESSION_COOKIE),
    });
    const id = token?.sub;
    return typeof id === "string" && OBJECT_ID.test(id) ? id : null;
  } catch {
    // A tampered or undecryptable cookie is the same as no session.
    return null;
  }
}
