import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logging/logger";

describe("logger", () => {
  let out: { log: string[]; warn: string[]; error: string[] };

  beforeEach(() => {
    // The logger is silent under NODE_ENV=test; these tests opt in.
    vi.stubEnv("NODE_ENV", "production");
    out = { log: [], warn: [], error: [] };
    vi.spyOn(console, "log").mockImplementation((line: string) => out.log.push(line));
    vi.spyOn(console, "warn").mockImplementation((line: string) => out.warn.push(line));
    vi.spyOn(console, "error").mockImplementation((line: string) => out.error.push(line));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("writes one JSON line per event to the stream for its level", () => {
    vi.stubEnv("LOG_LEVEL", "info");
    logger.info("scan.complete", { scanId: "s1", score: 82 });
    logger.warn("ai.budget_reached", { budgetUsd: 5 });
    logger.error("db.unavailable", { errorName: "MongoNetworkError" });
    expect(JSON.parse(out.log[0]!)).toMatchObject({
      level: "info",
      event: "scan.complete",
      scanId: "s1",
      score: 82,
      time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    expect(JSON.parse(out.warn[0]!)).toMatchObject({ level: "warn", budgetUsd: 5 });
    expect(JSON.parse(out.error[0]!)).toMatchObject({ level: "error" });
  });

  it("drops events below LOG_LEVEL, mapping fatal and trace to the nearest level", () => {
    vi.stubEnv("LOG_LEVEL", "warn");
    logger.info("hidden");
    logger.debug("hidden");
    logger.warn("shown");
    expect(out.log).toEqual([]);
    expect(out.warn).toHaveLength(1);

    vi.stubEnv("LOG_LEVEL", "fatal");
    logger.warn("hidden");
    logger.error("shown");
    expect(out.warn).toHaveLength(1);
    expect(out.error).toHaveLength(1);

    vi.stubEnv("LOG_LEVEL", "trace");
    logger.debug("shown");
    expect(out.log).toHaveLength(1);

    vi.stubEnv("LOG_LEVEL", "nonsense");
    logger.debug("hidden");
    logger.info("shown");
    expect(out.log).toHaveLength(2);
  });

  it("stays silent in tests", () => {
    vi.stubEnv("NODE_ENV", "test");
    logger.error("hidden");
    expect(out.error).toEqual([]);
  });
});
