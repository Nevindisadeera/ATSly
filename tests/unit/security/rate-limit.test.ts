import { describe, expect, it } from "vitest";

import { clientAddress, createMemoryRateLimiter } from "@/lib/security/rate-limit";

describe("createMemoryRateLimiter", () => {
  it("allows up to the limit, then blocks until the window resets", () => {
    let time = 0;
    const limiter = createMemoryRateLimiter({
      limit: 2,
      windowMs: 1000,
      now: () => time,
    });
    expect(limiter.consume("a")).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.consume("a")).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.consume("a")).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
    time = 1000;
    expect(limiter.consume("a")).toMatchObject({ allowed: true, remaining: 1 });
  });

  it("counts keys independently", () => {
    const limiter = createMemoryRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("b").allowed).toBe(true);
    expect(limiter.consume("a").allowed).toBe(false);
  });

  it("reports whole seconds until reset", () => {
    let time = 0;
    const limiter = createMemoryRateLimiter({
      limit: 1,
      windowMs: 60_000,
      now: () => time,
    });
    limiter.consume("a");
    time = 15_500;
    expect(limiter.consume("a").retryAfterSeconds).toBe(45);
  });

  it("evicts expired keys instead of growing without bound", () => {
    let time = 0;
    const limiter = createMemoryRateLimiter({
      limit: 1,
      windowMs: 10,
      maxKeys: 2,
      now: () => time,
    });
    limiter.consume("a");
    limiter.consume("b");
    time = 20;
    limiter.consume("c"); // triggers a sweep of a and b
    expect(limiter.consume("a").allowed).toBe(true);
  });
});

describe("clientAddress", () => {
  it("uses the first forwarded address", () => {
    expect(
      clientAddress(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })),
    ).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then a shared bucket", () => {
    expect(clientAddress(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe(
      "198.51.100.2",
    );
    expect(clientAddress(new Headers())).toBe("unknown");
  });
});
