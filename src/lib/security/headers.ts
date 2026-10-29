/**
 * Security headers — docs/PLANNING.md §23. Used by next.config.ts (every route) and by the
 * proxy (the per-request nonce policy on dynamic pages). No imports: next.config loads it.
 *
 * Two Content Security Policies apply. Every route gets the base policy, which has to
 * allow inline scripts because static pages are built ahead of time and Next.js inlines
 * its bootstrap. Dynamic pages (scan, results, dashboard, settings, sign-in) also get a
 * nonce policy from the proxy. Browsers enforce every policy they receive, so on those
 * pages only scripts carrying that request's nonce, or loaded by one, can run.
 */

export function contentSecurityPolicy(options: {
  nonce?: string;
  https: boolean;
}): string {
  const scripts = options.nonce
    ? `'self' 'nonce-${options.nonce}' 'strict-dynamic'`
    : "'self' 'unsafe-inline'";
  return [
    "default-src 'self'",
    `script-src ${scripts}`,
    // Radix positions popovers and menus with inline styles.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(options.https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export const SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "X-Frame-Options", value: "DENY" },
];

/** A fresh nonce per request: 128 random bits, base64. */
export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
