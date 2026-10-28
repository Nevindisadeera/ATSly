import type { ClientFailure } from "@/lib/client/api-response";
import { PASSWORD_LIMITS } from "@/lib/config/limits";

/** Copy for sign-up and sign-in — docs/PLANNING.md §7.5 and §24. Client-safe. */

export type AuthField = "name" | "email" | "password";

export type AuthError = {
  /** Shown in the summary above the fields. */
  message: string;
  /** The field it is about, if any; that input is marked invalid and described by it. */
  field?: AuthField;
  /** An action that resolves it, e.g. signing in instead. */
  link?: { href: string; label: string };
};

export const GUEST_CLAIM_NOTE =
  "Your recent reports from this browser will be saved to your account.";

/** After signIn("credentials") fails: Auth.js returns the error's code. */
export function signInError(code: string | undefined): AuthError {
  if (code === "rate_limited") {
    return {
      message: "Too many sign-in attempts. Wait 15 minutes, then try again.",
    };
  }
  if (code === "credentials") return { message: "Email or password is incorrect." };
  return { message: "We couldn't sign you in. Please try again." };
}

/** Errors Auth.js reports by redirecting to /login?error=… (mostly Google sign-in). */
export function loginPageError(
  error: string | undefined,
  code: string | undefined,
): AuthError | null {
  if (!error) return null;
  if (error === "CredentialsSignin") return signInError(code);
  if (error === "AccessDenied") {
    return {
      message:
        "We couldn't sign you in with Google. Use a Google account with a verified email, or sign in with your password.",
    };
  }
  if (error === "Configuration") {
    return { message: "Sign-in isn't available right now. Please try again later." };
  }
  return { message: "We couldn't sign you in. Please try again." };
}

const FIELDS = new Set<string>(["name", "email", "password"]);

/** After POST /api/auth/register fails. */
export function registerError(failure: ClientFailure, next: string): AuthError {
  switch (failure.code) {
    case "EMAIL_TAKEN":
      return {
        message: "An account with this email already exists.",
        field: "email",
        link: {
          href: `/login?next=${encodeURIComponent(next)}`,
          label: "Log in instead",
        },
      };
    case "INVALID_INPUT":
      return {
        message: failure.message || "Check the details and try again.",
        field:
          failure.field && FIELDS.has(failure.field)
            ? (failure.field as AuthField)
            : undefined,
      };
    case "RATE_LIMITED":
      return { message: "Too many sign-ups from this network. Try again in an hour." };
    case "NETWORK_ERROR":
      return { message: "Connection lost. Check your connection and try again." };
    case "SERVICE_UNAVAILABLE":
      return { message: "We're having trouble right now. Please try again in a moment." };
    default:
      return {
        message: failure.requestId
          ? `Something went wrong on our side. Please try again. Reference: ${failure.requestId}`
          : "Something went wrong on our side. Please try again.",
      };
  }
}

/** The inline hint under a new password: how long, not a strength meter (§7.5). */
export function passwordHint(password: string): string {
  const missing = PASSWORD_LIMITS.minChars - [...password].length;
  if (password.length === 0) return `At least ${PASSWORD_LIMITS.minChars} characters.`;
  if (missing > 0)
    return `${missing} more ${missing === 1 ? "character" : "characters"}.`;
  if (password.length < 12)
    return "Long enough. A longer phrase is even harder to guess.";
  return "Good length.";
}
