import { describe, expect, it } from "vitest";

import {
  contentSecurityPolicy,
  newNonce,
  SECURITY_HEADERS,
} from "@/lib/security/headers";

const directives = (policy: string) =>
  Object.fromEntries(
    policy.split("; ").map((d) => {
      const [name, ...values] = d.split(" ");
      return [name, values.join(" ")];
    }),
  );

describe("content security policy", () => {
  it("allows inline scripts only in the base policy for prebuilt pages", () => {
    const base = directives(contentSecurityPolicy({ https: false }));
    expect(base["script-src"]).toBe("'self' 'unsafe-inline'");
    expect(base).toMatchObject({
      "default-src": "'self'",
      "object-src": "'none'",
      "frame-ancestors": "'none'",
      "base-uri": "'self'",
      "form-action": "'self'",
      "connect-src": "'self'",
    });
    expect(base).not.toHaveProperty("upgrade-insecure-requests");
  });

  it("requires the request's nonce on dynamic pages", () => {
    const policy = directives(contentSecurityPolicy({ nonce: "abc123==", https: true }));
    expect(policy["script-src"]).toBe("'self' 'nonce-abc123==' 'strict-dynamic'");
    expect(policy["script-src"]).not.toContain("unsafe-inline");
    expect(policy).toHaveProperty("upgrade-insecure-requests");
  });

  it("makes a fresh 128-bit nonce each time", () => {
    const a = newNonce();
    const b = newNonce();
    expect(a).not.toBe(b);
    expect(Buffer.from(a, "base64")).toHaveLength(16);
  });

  it("sends the baseline headers", () => {
    expect(
      Object.fromEntries(SECURITY_HEADERS.map((h) => [h.key, h.value])),
    ).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": expect.stringContaining("max-age="),
    });
  });
});
