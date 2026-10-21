import { describe, expect, it } from "vitest";

import { formatWait, startScanErrorMessage } from "@/components/scan/start-scan-messages";
import type { ClientFailure } from "@/lib/client/api-response";

const failure = (overrides: Partial<ClientFailure>): ClientFailure => ({
  ok: false,
  code: "INTERNAL",
  status: 500,
  ...overrides,
});

describe("formatWait", () => {
  it("rounds to minutes or hours", () => {
    expect(formatWait(30)).toBe("a minute");
    expect(formatWait(25 * 60)).toBe("25 minutes");
    expect(formatWait(60 * 60)).toBe("about 1 hour");
    expect(formatWait(3 * 60 * 60 + 600)).toBe("about 3 hours");
    expect(formatWait(undefined)).toBeNull();
    expect(formatWait(0)).toBeNull();
  });
});

describe("startScanErrorMessage", () => {
  it("tells a rate-limited user when they can scan again", () => {
    expect(
      startScanErrorMessage(failure({ code: "RATE_LIMITED", retryAfterSeconds: 7200 })),
    ).toEqual({
      title: "You've reached today's scan limit.",
      hint: "You can scan again in about 2 hours.",
    });
    expect(startScanErrorMessage(failure({ code: "RATE_LIMITED" })).hint).toBe(
      "Please try again tomorrow.",
    );
  });

  it("covers missing resumes, outages and lost connections", () => {
    expect(startScanErrorMessage(failure({ code: "NOT_FOUND" })).hint).toBe(
      "Upload it again to continue.",
    );
    expect(startScanErrorMessage(failure({ code: "SERVICE_UNAVAILABLE" })).title).toBe(
      "We're having trouble saving right now.",
    );
    expect(startScanErrorMessage(failure({ code: "NETWORK_ERROR" })).title).toBe(
      "Connection lost.",
    );
  });

  it("gives a reference for unexpected errors when the server sent one", () => {
    expect(startScanErrorMessage(failure({ requestId: "abc-123" })).hint).toBe(
      "Please try again. Reference: abc-123",
    );
    expect(startScanErrorMessage(failure({})).hint).toBe("Please try again.");
  });
});
