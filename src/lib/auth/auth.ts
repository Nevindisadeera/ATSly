import "server-only";

import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";

import { env } from "@/lib/config/env";
import { logger } from "@/lib/logging/logger";
import { clientAddress } from "@/lib/security/rate-limit";
import {
  authenticateWithPassword,
  claimGuestData,
  signInWithGoogle,
} from "@/lib/services/account-service";
import { credentialsSchema } from "@/lib/validation/auth";

import { decodeGuestCookie, GUEST_COOKIE } from "./guest";

/**
 * Auth.js — docs/PLANNING.md §16.1 and §23: JWT sessions (no database adapter), email and
 * password, and Google when it is configured. Signing in moves the browser's guest data to
 * the account.
 */

/** Too many attempts; the sign-in form reads this code to say so. */
class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

export const googleSignInEnabled = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);

const THIRTY_DAYS_S = 30 * 24 * 60 * 60;

export const { handlers, auth, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  // The app always runs behind a host it controls (localhost or Vercel).
  trustHost: true,
  session: { strategy: "jwt", maxAge: THIRTY_DAYS_S },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const input = credentialsSchema.safeParse(raw);
        if (!input.success) return null;
        const result = await authenticateWithPassword(
          input.data.email,
          input.data.password,
          clientAddress(request.headers),
        );
        if (result.ok) return result.user;
        if (result.reason === "rate_limited") throw new RateLimitedSignin();
        return null;
      },
    }),
    ...(googleSignInEnabled
      ? [Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET })]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      const signedIn = await signInWithGoogle({
        email: profile?.email,
        emailVerified: profile?.email_verified === true,
        name: profile?.name,
        image: typeof profile?.picture === "string" ? profile.picture : null,
        providerAccountId: account.providerAccountId,
      });
      if (!signedIn) return false;
      // The session carries the app's account id, not Google's.
      Object.assign(user, signedIn);
      return true;
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      const store = await cookies();
      const guestId = decodeGuestCookie(store.get(GUEST_COOKIE)?.value);
      if (!guestId) return;
      try {
        await claimGuestData(guestId, user.id);
        // The guest's data now belongs to the account, so the guest identity is done.
        store.delete(GUEST_COOKIE);
      } catch (error) {
        // Signing in still succeeds; the next sign-in from this browser claims again.
        logger.error("account.claim_failed", {
          errorName: error instanceof Error ? error.name : typeof error,
        });
      }
    },
  },
  logger: {
    error: (error) => logger.error("auth.error", { errorName: error.name }),
    warn: (code) => logger.warn("auth.warning", { code }),
    debug: () => undefined,
  },
});
