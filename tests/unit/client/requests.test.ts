import { afterEach, describe, expect, it, vi } from "vitest";

import { registerAccount } from "@/lib/client/auth";
import {
  deleteAccount,
  deleteAllData,
  deleteScan,
  fetchScanPage,
} from "@/lib/client/dashboard";
import { requestEmpty, requestJson } from "@/lib/client/request";
import { fetchScanStatus, startScan } from "@/lib/client/scans";

type Call = { url: string; init: RequestInit };

/** Replaces fetch with one that records calls and answers with `respond`. */
function mockFetch(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return respond();
    }),
  );
  return calls;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestJson", () => {
  it("returns the data of a success envelope, never cached", async () => {
    const calls = mockFetch(() => json(200, { data: { id: "a" } }));
    expect(await requestJson("/api/x", { method: "GET" })).toEqual({
      ok: true,
      data: { id: "a" },
    });
    expect(calls[0]!.init).toMatchObject({
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  });

  it("turns an error envelope into a failure with its field, wait and reference", async () => {
    mockFetch(() =>
      json(
        429,
        {
          error: {
            code: "RATE_LIMITED",
            message: "Slow down.",
            details: { field: "email" },
          },
        },
        { "retry-after": "120", "x-request-id": "req-9" },
      ),
    );
    expect(await requestJson("/api/x", { method: "POST" })).toEqual({
      ok: false,
      status: 429,
      code: "RATE_LIMITED",
      message: "Slow down.",
      retryAfterSeconds: 120,
      requestId: "req-9",
      field: "email",
    });
  });

  it("falls back to the status when the body isn't the API's", async () => {
    mockFetch(() => new Response("<html>Bad gateway</html>", { status: 503 }));
    expect(await requestJson("/api/x", { method: "GET" })).toMatchObject({
      ok: false,
      code: "SERVICE_UNAVAILABLE",
      status: 503,
    });
    mockFetch(() => json(403, { error: { code: "SOMETHING_NEW" } }));
    expect(await requestJson("/api/x", { method: "GET" })).toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("reports a lost connection and an aborted request", async () => {
    mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(await requestJson("/api/x", { method: "GET" })).toEqual({
      ok: false,
      code: "NETWORK_ERROR",
      status: 0,
    });
    mockFetch(() => Promise.reject(new DOMException("Aborted", "AbortError")));
    expect(await requestJson("/api/x", { method: "GET" })).toMatchObject({
      code: "ABORTED",
    });
  });
});

describe("requestEmpty", () => {
  it("treats a 204 as success and an error envelope as failure", async () => {
    mockFetch(() => new Response(null, { status: 204 }));
    expect(await requestEmpty("/api/x", { method: "DELETE" })).toEqual({ ok: true });
    mockFetch(() => json(404, { error: { code: "NOT_FOUND", message: "Not found." } }));
    expect(await requestEmpty("/api/x", { method: "DELETE" })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    mockFetch(() => new Response("oops", { status: 500 }));
    expect(await requestEmpty("/api/x", { method: "DELETE" })).toMatchObject({
      code: "INTERNAL",
    });
    mockFetch(() => Promise.reject(new TypeError("offline")));
    expect(await requestEmpty("/api/x", { method: "DELETE" })).toMatchObject({
      code: "NETWORK_ERROR",
    });
  });
});

describe("API clients", () => {
  it("starts scans with a pasted job, a saved job, or none", async () => {
    const calls = mockFetch(() => json(202, { data: { scanId: "s1" } }));
    await startScan("r1");
    await startScan("r1", { jobDescription: { text: "Posting" } });
    await startScan("r1", { jobDescriptionId: "j1" });
    expect(calls.map((c) => JSON.parse(String(c.init.body)))).toEqual([
      { resumeId: "r1" },
      { resumeId: "r1", jobDescription: { text: "Posting" } },
      { resumeId: "r1", jobDescriptionId: "j1" },
    ]);
    expect(calls[0]).toMatchObject({ url: "/api/scans", init: { method: "POST" } });
  });

  it("polls status, pages scans and deletes with the typed confirmation", async () => {
    const calls = mockFetch(() => json(200, { data: { items: [], nextCursor: null } }));
    await fetchScanStatus("a b");
    await fetchScanPage("c/d");
    await deleteAllData();
    expect(calls.map((c) => c.url)).toEqual([
      "/api/scans/a%20b/status",
      "/api/scans?cursor=c%2Fd",
      "/api/scans",
    ]);
    expect(calls[2]!.init).toMatchObject({
      method: "DELETE",
      body: JSON.stringify({ confirm: "DELETE" }),
    });

    const deletes = mockFetch(() => new Response(null, { status: 204 }));
    expect(await deleteScan("x")).toEqual({ ok: true });
    expect(await deleteAccount()).toEqual({ ok: true });
    expect(deletes.map((c) => [c.url, c.init.method])).toEqual([
      ["/api/scans/x", "DELETE"],
      ["/api/account", "DELETE"],
    ]);
  });

  it("registers with the given details", async () => {
    const calls = mockFetch(() => json(201, { data: { id: "u1" } }));
    expect(
      await registerAccount({
        name: "Ada",
        email: "ada@example.com",
        password: "pw12345678",
      }),
    ).toEqual({ ok: true, data: { id: "u1" } });
    expect(calls[0]).toMatchObject({
      url: "/api/auth/register",
      init: { method: "POST" },
    });
  });
});
