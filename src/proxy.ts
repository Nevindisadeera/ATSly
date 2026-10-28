import { NextResponse, type NextRequest } from "next/server";

import { sessionUserId } from "@/lib/auth/session";
import { decideProxy } from "@/lib/security/proxy-rules";
import type { ApiErrorBody } from "@/types/api";

/**
 * Runs before matching requests — docs/PLANNING.md §14 and §23. An optimistic check only:
 * pages and routes still resolve the owner themselves and scope every query by it.
 */
export async function proxy(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  const decision = decideProxy({
    method: request.method,
    url: request.url,
    headers: request.headers,
    // API routes resolve the session themselves; pages need it here for redirects.
    signedIn: isApi ? false : (await sessionUserId(request.headers)) !== null,
  });

  if (decision.type === "forbidden") {
    const body: ApiErrorBody = {
      error: { code: "FORBIDDEN", message: "Cross-site requests aren't allowed." },
    };
    return NextResponse.json(body, {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (decision.type === "redirect") {
    return NextResponse.redirect(new URL(decision.location, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/settings/:path*",
    "/login",
    "/register",
  ],
};
