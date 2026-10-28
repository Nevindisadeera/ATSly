import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/auth/redirect";
import { decideProxy, isCrossSite } from "@/lib/security/proxy-rules";

const SITE = "https://atsly.app";

function request(
  path: string,
  options: { method?: string; headers?: Record<string, string>; signedIn?: boolean } = {},
) {
  return decideProxy({
    method: options.method ?? "GET",
    url: `${SITE}${path}`,
    headers: new Headers(options.headers),
    signedIn: options.signedIn ?? false,
  });
}

describe("cross-site API requests", () => {
  it("refuses mutating API requests from another site", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(
        request("/api/scans", { method, headers: { "sec-fetch-site": "cross-site" } }),
      ).toEqual({ type: "forbidden" });
    }
    expect(
      request("/api/resumes", {
        method: "POST",
        headers: { origin: "https://evil.example" },
      }),
    ).toEqual({ type: "forbidden" });
    // A sibling subdomain is "same-site" to the browser but still another origin.
    expect(
      request("/api/scans", {
        method: "POST",
        headers: { "sec-fetch-site": "same-site", origin: "https://evil.atsly.app" },
      }),
    ).toEqual({ type: "forbidden" });
  });

  it("allows same-origin requests, reads, and clients that send neither header", () => {
    expect(
      request("/api/scans", {
        method: "POST",
        headers: { "sec-fetch-site": "same-origin", origin: SITE },
      }),
    ).toEqual({ type: "next" });
    expect(request("/api/scans", { method: "POST" })).toEqual({ type: "next" });
    expect(
      request("/api/scans/abc", { headers: { "sec-fetch-site": "cross-site" } }),
    ).toEqual({ type: "next" });
  });

  it("leaves Auth.js endpoints to their own CSRF check, but not the register route", () => {
    const crossSite = { method: "POST", headers: { origin: "https://evil.example" } };
    expect(request("/api/auth/callback/credentials", crossSite)).toEqual({
      type: "next",
    });
    expect(request("/api/auth/register", crossSite)).toEqual({ type: "forbidden" });
  });

  it("treats a malformed Origin as cross-site", () => {
    expect(isCrossSite(`${SITE}/api/scans`, new Headers({ origin: "not a url" }))).toBe(
      true,
    );
  });
});

describe("account pages", () => {
  it("sends signed-out visitors to sign in, remembering where they were going", () => {
    expect(request("/dashboard")).toEqual({
      type: "redirect",
      location: "/login?next=%2Fdashboard",
    });
    expect(request("/settings?tab=data")).toEqual({
      type: "redirect",
      location: `/login?next=${encodeURIComponent("/settings?tab=data")}`,
    });
    expect(request("/dashboard", { signedIn: true })).toEqual({ type: "next" });
    expect(request("/dashboards")).toEqual({ type: "next" });
  });

  it("sends signed-in visitors away from the sign-in pages", () => {
    expect(request("/login", { signedIn: true })).toEqual({
      type: "redirect",
      location: "/dashboard",
    });
    expect(request("/register?next=%2Fsettings", { signedIn: true })).toEqual({
      type: "redirect",
      location: "/settings",
    });
    expect(request("/login")).toEqual({ type: "next" });
  });
});

describe("safeNextPath", () => {
  it("keeps paths on this site", () => {
    expect(safeNextPath("/results/abc?x=1#top")).toBe("/results/abc?x=1#top");
    expect(safeNextPath("/settings")).toBe("/settings");
  });

  it("refuses other hosts, odd input and loops back to the sign-in pages", () => {
    for (const unsafe of [
      null,
      "",
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "/ok\nLocation: x",
      "/login",
      "/register?next=/login",
      `/${"a".repeat(2_001)}`,
    ]) {
      expect(safeNextPath(unsafe)).toBe("/dashboard");
    }
    expect(safeNextPath("dashboard", "/scan")).toBe("/scan");
  });
});
