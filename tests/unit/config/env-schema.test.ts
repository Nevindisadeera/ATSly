import { describe, expect, it } from "vitest";

import { parseEnv } from "@/lib/config/env-schema";

describe("parseEnv", () => {
  it("applies defaults when variables are absent", () => {
    expect(parseEnv({})).toEqual({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      LOG_LEVEL: "info",
      RATE_LIMIT_UPLOADS_PER_HOUR: 15,
      GUEST_RETENTION_DAYS: 7,
    });
  });

  it("accepts valid values", () => {
    const env = parseEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://atsly.app",
      LOG_LEVEL: "warn",
    });
    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://atsly.app");
    expect(env.LOG_LEVEL).toBe("warn");
  });

  it("coerces numeric limits from strings", () => {
    expect(
      parseEnv({ RATE_LIMIT_UPLOADS_PER_HOUR: "40" }).RATE_LIMIT_UPLOADS_PER_HOUR,
    ).toBe(40);
    expect(() => parseEnv({ RATE_LIMIT_UPLOADS_PER_HOUR: "0" })).toThrow(
      /RATE_LIMIT_UPLOADS_PER_HOUR/,
    );
  });

  it("validates the database URI and cookie secret", () => {
    expect(
      parseEnv({ MONGODB_URI: "mongodb+srv://u:p@cluster0.example.net/atsly" })
        .MONGODB_URI,
    ).toMatch(/^mongodb\+srv:/);
    expect(() => parseEnv({ MONGODB_URI: "postgres://localhost/atsly" })).toThrow(
      /MONGODB_URI/,
    );
    expect(() => parseEnv({ AUTH_SECRET: "too-short" })).toThrow(/AUTH_SECRET/);
    expect(parseEnv({ AUTH_SECRET: "x".repeat(32) }).AUTH_SECRET).toHaveLength(32);
  });

  it("names every invalid variable in the error", () => {
    expect(() =>
      parseEnv({ NEXT_PUBLIC_APP_URL: "not-a-url", LOG_LEVEL: "loud" }),
    ).toThrow(/NEXT_PUBLIC_APP_URL[\s\S]*LOG_LEVEL/);
  });
});
