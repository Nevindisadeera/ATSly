import { describe, expect, it } from "vitest";

import { codeForStatus, failureFrom } from "@/lib/client/api-response";

const headers = (values: Record<string, string>) => new Headers(values);

describe("failureFrom", () => {
  it("keeps the API's code and message, Retry-After and the request id", () => {
    expect(
      failureFrom(
        429,
        { error: { code: "RATE_LIMITED", message: "Limit reached." } },
        headers({ "retry-after": "3600", "x-request-id": "req-1" }),
      ),
    ).toEqual({
      ok: false,
      status: 429,
      code: "RATE_LIMITED",
      message: "Limit reached.",
      retryAfterSeconds: 3600,
      requestId: "req-1",
    });
  });

  it("falls back to the status when the body isn't an API error", () => {
    expect(failureFrom(404, "<html>", headers({})).code).toBe("NOT_FOUND");
    expect(failureFrom(503, null).code).toBe("SERVICE_UNAVAILABLE");
    expect(failureFrom(500, { error: { code: "SOMETHING_NEW" } }).code).toBe("INTERNAL");
  });

  it("ignores a missing or invalid Retry-After", () => {
    expect(
      failureFrom(429, null, headers({ "retry-after": "soon" })).retryAfterSeconds,
    ).toBe(undefined);
  });
});

describe("codeForStatus", () => {
  it("maps common statuses", () => {
    expect(codeForStatus(400)).toBe("INVALID_INPUT");
    expect(codeForStatus(401)).toBe("UNAUTHENTICATED");
    expect(codeForStatus(413)).toBe("FILE_TOO_LARGE");
    expect(codeForStatus(415)).toBe("UNSUPPORTED_TYPE");
    expect(codeForStatus(418)).toBe("INTERNAL");
  });
});
