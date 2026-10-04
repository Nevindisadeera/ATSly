import { describe, expect, it } from "vitest";

import { parseEnv } from "@/lib/config/env-schema";

describe("parseEnv", () => {
  it("applies defaults when variables are absent", () => {
    expect(parseEnv({})).toEqual({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      LOG_LEVEL: "info",
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

  it("names every invalid variable in the error", () => {
    expect(() =>
      parseEnv({ NEXT_PUBLIC_APP_URL: "not-a-url", LOG_LEVEL: "loud" }),
    ).toThrow(/NEXT_PUBLIC_APP_URL[\s\S]*LOG_LEVEL/);
  });
});
