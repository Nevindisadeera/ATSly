import { describe, expect, it } from "vitest";

import { clientAddress, createMemoryRateLimiter } from "@/lib/security/rate-limit";

describe("createMemoryRateLimiter", () => {
  it("allows up to the limit, then blocks until the window resets", async () => {
    let time = 0;
    const limiter = createMemoryRateLimiter({
      limit: 2,
      windowMs: 1000,
      now: () => time,
    });
    expect(await limiter.consume("a")).toMatchObject({ allowed: true, remaining: 1 });
    expect(await limiter.consume("a")).toMatchObject({ allowed: true, remaining: 0 });
    expect(await limiter.consume("a")).toMatchObject({
      allowed: false,
      retryAfterSeconds: 1,
    });
    time = 1000;
    expect(await limiter.consume("a")).toMatchObject({ allowed: true, remaining: 1 });
  });

  it("counts keys independently", async () => {
    const limiter = createMemoryRateLimiter({ limit: 1, windowMs: 1000 });
    expect((await limiter.consume("a")).allowed).toBe(true);
    expect((await limiter.consume("b")).allowed).toBe(true);
    expect((await limiter.consume("a")).allowed).toBe(false);
  });

  it("reports whole seconds until reset", async () => {
    let time = 0;
    const limiter = createMemoryRateLimiter({
      limit: 1,
      windowMs: 60_000,
      now: () => time,
    });
    await limiter.consume("a");
    time = 15_500;
    expect((await limiter.consume("a")).retryAfterSeconds).toBe(45);
  });

  it("evicts expired keys instead of growing without bound", async () => {
    let time = 0;
    const limiter = createMemoryRateLimiter({
      limit: 1,
      windowMs: 10,
      maxKeys: 2,
      now: () => time,
    });
    await limiter.consume("a");
    await limiter.consume("b");
    time = 20;
    await limiter.consume("c"); // triggers a sweep of a and b
    expect((await limiter.consume("a")).allowed).toBe(true);
  });
});

describe("clientAddress", () => {
  it("uses the first forwarded address", async () => {
    expect(
      clientAddress(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })),
    ).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then a shared bucket", async () => {
    expect(clientAddress(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe(
      "198.51.100.2",
    );
    expect(clientAddress(new Headers())).toBe("unknown");
  });
});
