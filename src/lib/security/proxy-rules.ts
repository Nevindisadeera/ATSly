import { safeNextPath } from "@/lib/auth/redirect";

/**
 * What the proxy does with a request — docs/PLANNING.md §14 and §23. Pure, so it is tested
 * without a server:
 * - cross-site mutating API requests are refused (CSRF); Auth.js guards its own endpoints;
 * - signed-out visitors to account pages go to /login with `?next=`;
 * - signed-in visitors to /login and /register go where they were headed.
 */

export type ProxyDecision =
  { type: "next" } | { type: "forbidden" } | { type: "redirect"; location: string };

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ACCOUNT_PAGES = ["/dashboard", "/settings"];
const AUTH_PAGES = new Set(["/login", "/register"]);

const isUnder = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/** Auth.js endpoints check their own CSRF token; our register route doesn't. */
const isAuthJsEndpoint = (pathname: string) =>
  isUnder(pathname, "/api/auth") && pathname !== "/api/auth/register";

/**
 * A browser request from another site. Browsers send Sec-Fetch-Site and Origin on these;
 * requests without either (curl, server-to-server) can't carry a victim's cookies.
 */
export function isCrossSite(url: string, headers: Headers): boolean {
  if (headers.get("sec-fetch-site") === "cross-site") return true;
  const origin = headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(url).host;
  } catch {
    return true;
  }
}

export function decideProxy(request: {
  method: string;
  url: string;
  headers: Headers;
  signedIn: boolean;
}): ProxyDecision {
  const url = new URL(request.url);
  const { pathname } = url;

  if (isUnder(pathname, "/api")) {
    if (
      MUTATING.has(request.method.toUpperCase()) &&
      !isAuthJsEndpoint(pathname) &&
      isCrossSite(request.url, request.headers)
    ) {
      return { type: "forbidden" };
    }
    return { type: "next" };
  }

  if (!request.signedIn && ACCOUNT_PAGES.some((page) => isUnder(pathname, page))) {
    const next = `${pathname}${url.search}`;
    return { type: "redirect", location: `/login?next=${encodeURIComponent(next)}` };
  }

  if (request.signedIn && AUTH_PAGES.has(pathname)) {
    return { type: "redirect", location: safeNextPath(url.searchParams.get("next")) };
  }

  return { type: "next" };
}
