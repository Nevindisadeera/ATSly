import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/http/errors";
import { jsonError, jsonSuccess } from "@/lib/http/respond";

describe("jsonSuccess", () => {
  it("wraps data in the envelope with status and request id", async () => {
    const res = jsonSuccess({ a: 1 }, "req-1", { status: 201 });
    expect(res.status).toBe(201);
    expect(res.headers.get("x-request-id")).toBe("req-1");
    expect(await res.json()).toEqual({ data: { a: 1 } });
  });
});

describe("jsonError", () => {
  it("maps AppError codes to statuses and keeps extra headers", async () => {
    const res = jsonError(
      new AppError("RATE_LIMITED", { headers: { "Retry-After": "30" } }),
      "req-2",
      "test",
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect((await res.json()).error.code).toBe("RATE_LIMITED");
  });

  it("hides unexpected errors behind a generic 500", async () => {
    const res = jsonError(new Error("db password is hunter2"), "req-3", "test");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: "INTERNAL", message: "Something went wrong." },
    });
    expect(JSON.stringify(body)).not.toContain("hunter2");
  });
});
