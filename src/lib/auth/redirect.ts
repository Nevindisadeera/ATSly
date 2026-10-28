/**
 * Where to go after signing in — docs/PLANNING.md §7.5: the `?next=` path when it is a safe
 * path on this site, otherwise the dashboard. Client-safe.
 */
export const AFTER_SIGN_IN = "/dashboard";

const AUTH_PAGES = new Set(["/login", "/register"]);

export function safeNextPath(
  value: string | null | undefined,
  fallback: string = AFTER_SIGN_IN,
): string {
  if (!value || value.length > 2_000) return fallback;
  // A path on this site only: not "//evil.com" or "/\evil.com", which browsers treat as
  // another host, and no control characters.
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\"))
    return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  const path = value.split(/[?#]/)[0]!;
  return AUTH_PAGES.has(path) ? fallback : value;
}
