import { encode } from "next-auth/jwt";

import { SESSION_COOKIE } from "@/lib/auth/session";

/** A Cookie header carrying an Auth.js session for this user, as the browser would send. */
export async function sessionCookie(userId: string): Promise<string> {
  const token = await encode({
    token: { sub: userId },
    secret: process.env.AUTH_SECRET!,
    salt: SESSION_COOKIE,
  });
  return `${SESSION_COOKIE}=${token}`;
}
