import { readFileSync } from "node:fs";
import { join } from "node:path";

import mongoose from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE as deleteResume } from "@/app/api/resumes/[id]/route";
import { POST as uploadResume } from "@/app/api/resumes/route";
import { GET as getScanRoute } from "@/app/api/scans/[id]/route";
import { GET as getStatusRoute } from "@/app/api/scans/[id]/status/route";
import { POST as postScanRoute } from "@/app/api/scans/route";
import { encodeGuestCookie, GUEST_COOKIE } from "@/lib/auth/guest";
import { ResumeModel } from "@/lib/db/models/resume";
import { ScanModel } from "@/lib/db/models/scan";
import { runScanPipeline } from "@/lib/services/scan-pipeline";
import type { ScanDetail, ScanStatusResult } from "@/types/api";

import { setupTestDatabase } from "../../support/database";

/**
 * after() needs a live Next.js request, so the route's background work is queued here and
 * run by the test with runBackground(), which also lets tests see a scan before it runs.
 */
const background = vi.hoisted(() => ({ tasks: [] as (() => unknown)[] }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    background.tasks.push(task);
  },
}));

async function runBackground() {
  for (const task of background.tasks.splice(0)) await task();
}

setupTestDatabase();
beforeEach(() => {
  background.tasks.splice(0);
});

const BASE = "http://localhost:3000";
const resumeBytes = () =>
  readFileSync(join(process.cwd(), "tests/fixtures/resumes/clean-single-column.pdf"));

let uploadIp = 0;
/** Uploads a resume as a new guest; each upload uses its own address to stay under limits. */
async function newGuestWithResume() {
  const form = new FormData();
  form.append(
    "file",
    new File([new Uint8Array(resumeBytes())], "Jordan Rivera.pdf", {
      type: "application/pdf",
    }),
  );
  uploadIp += 1;
  const response = await uploadResume(
    new Request(`${BASE}/api/resumes`, {
      method: "POST",
      body: form,
      headers: { "x-forwarded-for": `198.51.100.${uploadIp % 250}` },
    }),
  );
  expect(response.status).toBe(201);
  const cookie = (response.headers.get("set-cookie") ?? "").split(";")[0]!;
  const { data } = await response.json();
  return { resumeId: data.id as string, cookie };
}

function postScan(body: unknown, cookie?: string, ip = "203.0.113.50") {
  return postScanRoute(
    new Request(`${BASE}/api/scans`, {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip,
        ...(cookie ? { cookie } : {}),
      },
    }),
  );
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const withCookie = (cookie?: string): RequestInit => ({
  headers: cookie ? { cookie } : {},
});

async function getScan(id: string, cookie?: string) {
  const response = await getScanRoute(
    new Request(`${BASE}/api/scans/${id}`, withCookie(cookie)),
    ctx(id),
  );
  return { status: response.status, body: await response.json() };
}

async function getStatus(id: string, cookie?: string) {
  const response = await getStatusRoute(
    new Request(`${BASE}/api/scans/${id}/status`, withCookie(cookie)),
    ctx(id),
  );
  return { status: response.status, body: await response.json() };
}

/** Starts a scan and returns its id. */
async function startScan(resumeId: string, cookie: string, ip?: string) {
  const response = await postScan({ resumeId }, cookie, ip);
  expect(response.status).toBe(202);
  const { data } = await response.json();
  return data.scanId as string;
}

describe("POST /api/scans → status → report", () => {
  it("accepts the scan, runs it after the response and stores the full report", async () => {
    const { resumeId, cookie } = await newGuestWithResume();
    const response = await postScan({ resumeId }, cookie);
    expect(response.status).toBe(202);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    const { data } = await response.json();
    expect(data.scanId).toMatch(/^[0-9a-f]{24}$/);

    // Nothing has run yet: the analysis happens after the response.
    expect(background.tasks).toHaveLength(1);
    const queued = await getStatus(data.scanId, cookie);
    expect(queued.body.data).toMatchObject({
      status: "queued",
      stage: null,
      error: null,
    });

    await runBackground();

    const status = await getStatus(data.scanId, cookie);
    expect(status.status).toBe(200);
    const statusData = status.body.data as ScanStatusResult;
    expect(statusData).toMatchObject({ status: "complete", stage: null, error: null });
    expect(Object.keys(statusData).sort()).toEqual([
      "error",
      "stage",
      "status",
      "updatedAt",
    ]);

    const report = await getScan(data.scanId, cookie);
    expect(report.status).toBe(200);
    const scan = report.body.data as ScanDetail;
    expect(scan).toMatchObject({
      id: data.scanId,
      status: "complete",
      engineVersion: expect.any(String),
      resume: { id: resumeId, fileName: "Jordan Rivera.pdf", pageCount: 1 },
      ai: { status: "skipped" },
    });
    expect(scan.ats?.categories).toHaveLength(6);
    expect(scan.summary).toMatchObject({
      atsScore: scan.ats!.score,
      atsBand: scan.ats!.band,
      headline: scan.ats!.headline,
    });
    expect(scan.summary!.topActions.length).toBeLessThanOrEqual(3);
    expect(scan.durationMs).toBeGreaterThanOrEqual(0);
    expect(scan.expiresAt).not.toBeNull();
    expect(JSON.stringify(scan)).not.toContain("owner");
  });

  it("keeps a guest's resume as long as its newest scan", async () => {
    const { resumeId, cookie } = await newGuestWithResume();
    await ResumeModel.updateOne(
      { _id: resumeId },
      { $set: { expiresAt: new Date(Date.now() + 60_000) } },
    );
    const scanId = await startScan(resumeId, cookie);
    const scan = await ScanModel.findById(scanId).lean();
    const resume = await ResumeModel.findById(resumeId).lean();
    expect(resume!.expiresAt!.getTime()).toBeGreaterThanOrEqual(
      scan!.expiresAt!.getTime() - 1_000,
    );
  });

  it("runs each scan once, even if the pipeline is started again", async () => {
    const { resumeId, cookie } = await newGuestWithResume();
    const scanId = await startScan(resumeId, cookie);
    await runBackground();
    const first = await ScanModel.findById(scanId).lean();
    await runScanPipeline(scanId);
    const second = await ScanModel.findById(scanId).lean();
    expect(second!.updatedAt).toEqual(first!.updatedAt);
  });

  it("records a failure when the pipeline can't finish", async () => {
    const { resumeId, cookie } = await newGuestWithResume();
    const scanId = await startScan(resumeId, cookie);
    // The resume disappears (e.g. expired) before the analysis runs.
    await ResumeModel.deleteOne({ _id: resumeId });
    await runBackground();

    const { body } = await getStatus(scanId, cookie);
    expect(body.data).toMatchObject({
      status: "failed",
      error: {
        code: "INTERNAL",
        message: "We couldn't complete this analysis.",
        retryable: true,
      },
    });
    const scan = await getScan(scanId, cookie);
    expect(scan.body.data).toMatchObject({ ats: null, summary: null });
  });
});

describe("input validation", () => {
  it.each([
    ["a non-JSON body", "resumeId=abc", "text/plain"],
    ["malformed JSON", "{ resumeId: ", "application/json"],
  ])("rejects %s", async (_, body, contentType) => {
    const { cookie } = await newGuestWithResume();
    const response = await postScanRoute(
      new Request(`${BASE}/api/scans`, {
        method: "POST",
        body,
        headers: { "content-type": contentType, cookie },
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_INPUT");
  });

  it.each([
    ["no resumeId", {}, "resumeId is required."],
    ["a malformed resumeId", { resumeId: "../../etc" }, "resumeId must be the id"],
    ["an unknown field", { resumeId: "0".repeat(24), extra: true }, "extra"],
    ["a non-object body", ["0".repeat(24)], ""],
  ])("rejects %s", async (_, body, message) => {
    const { cookie } = await newGuestWithResume();
    const response = await postScan(body, cookie);
    expect(response.status).toBe(400);
    const { error } = await response.json();
    expect(error.code).toBe("INVALID_INPUT");
    expect(error.message).toContain(message);
  });

  it("rejects an oversized body without reading all of it", async () => {
    const { cookie } = await newGuestWithResume();
    const response = await postScan(
      { resumeId: "0".repeat(24), pad: "x".repeat(70_000) },
      cookie,
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toBe("The request body is too large.");
  });

  it("does not schedule work for rejected requests", async () => {
    const { cookie } = await newGuestWithResume();
    await postScan({}, cookie);
    expect(background.tasks).toHaveLength(0);
    expect(await ScanModel.countDocuments()).toBe(0);
  });
});

describe("ownership", () => {
  it("returns 404 for another guest's scan, without a cookie, or with a forged cookie", async () => {
    const a = await newGuestWithResume();
    const b = await newGuestWithResume();
    const scanId = await startScan(a.resumeId, a.cookie);
    await runBackground();

    const forged = `${GUEST_COOKIE}=${encodeURIComponent("11111111-1111-4111-8111-111111111111.forged")}`;
    for (const cookie of [b.cookie, undefined, forged]) {
      const scan = await getScan(scanId, cookie);
      expect(scan.status).toBe(404);
      expect(scan.body.error.code).toBe("NOT_FOUND");
      expect((await getStatus(scanId, cookie)).status).toBe(404);
    }
    expect((await getScan(scanId, a.cookie)).status).toBe(200);
  });

  it("refuses to scan another guest's resume, as if it didn't exist", async () => {
    const a = await newGuestWithResume();
    const b = await newGuestWithResume();
    const response = await postScan({ resumeId: a.resumeId }, b.cookie);
    expect(response.status).toBe(404);
    expect(await ScanModel.countDocuments()).toBe(0);
    expect(background.tasks).toHaveLength(0);
  });

  it("returns 404 for scans without a cookie and for unknown or malformed ids", async () => {
    const { resumeId, cookie } = await newGuestWithResume();
    expect((await postScan({ resumeId })).status).toBe(404);

    const unknownGuest = `${GUEST_COOKIE}=${encodeURIComponent(
      encodeGuestCookie("22222222-2222-4222-8222-222222222222"),
    )}`;
    expect((await postScan({ resumeId }, unknownGuest)).status).toBe(404);
    expect((await getScan("0".repeat(24), cookie)).status).toBe(404);
    expect((await getScan("not-an-id", cookie)).status).toBe(404);
    expect((await getStatus("not-an-id", cookie)).status).toBe(404);
  });
});

describe("stale sweep", () => {
  const ageScan = (scanId: string, ms: number) =>
    // Straight to the collection, so Mongoose doesn't refresh updatedAt.
    ScanModel.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(scanId) },
      { $set: { updatedAt: new Date(Date.now() - ms) } },
    );

  it("fails a scan that made no progress for 90 seconds when its status is read", async () => {
    const { resumeId, cookie } = await newGuestWithResume();
    const scanId = await startScan(resumeId, cookie);
    await ageScan(scanId, 91_000);

    const { body } = await getStatus(scanId, cookie);
    expect(body.data).toMatchObject({
      status: "failed",
      error: {
        code: "TIMEOUT",
        message: "This took longer than expected.",
        retryable: true,
      },
    });

    // The pipeline starting late doesn't revive or overwrite it.
    await runBackground();
    const scan = await getScan(scanId, cookie);
    expect(scan.body.data).toMatchObject({ status: "failed", ats: null });
  });

  it("leaves recently active and finished scans alone", async () => {
    const { resumeId, cookie } = await newGuestWithResume();
    const scanId = await startScan(resumeId, cookie);
    await ageScan(scanId, 60_000);
    expect((await getStatus(scanId, cookie)).body.data.status).toBe("queued");

    await runBackground();
    await ageScan(scanId, 10 * 60_000);
    expect((await getScan(scanId, cookie)).body.data.status).toBe("complete");
  });

  it("does not let a late pipeline overwrite a scan that timed out while running", async () => {
    const { resumeId, cookie } = await newGuestWithResume();
    const scanId = await startScan(resumeId, cookie);
    background.tasks.splice(0);
    await ScanModel.updateOne(
      { _id: scanId },
      { $set: { status: "running", stage: "ats_rules" } },
    );
    await ageScan(scanId, 120_000);
    expect((await getStatus(scanId, cookie)).body.data).toMatchObject({
      status: "failed",
      stage: "ats_rules",
      error: { code: "TIMEOUT" },
    });
    await runScanPipeline(scanId);
    expect((await getStatus(scanId, cookie)).body.data.status).toBe("failed");
  });
});

describe("rate limits", () => {
  it("allows three scans per guest per day, then answers 429 with Retry-After", async () => {
    const { resumeId, cookie } = await newGuestWithResume();
    for (let i = 0; i < 3; i += 1) {
      expect((await postScan({ resumeId }, cookie, `192.0.2.${i}`)).status).toBe(202);
    }
    const limited = await postScan({ resumeId }, cookie, "192.0.2.99");
    expect(limited.status).toBe(429);
    const retryAfter = Number(limited.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(24 * 60 * 60);
    expect((await limited.json()).error).toMatchObject({
      code: "RATE_LIMITED",
      message: "You've reached today's scan limit.",
    });
  });

  it("allows ten scans per address per day across guests", async () => {
    const ip = "192.0.2.200";
    for (let i = 0; i < 10; i += 1) {
      const { resumeId, cookie } = await newGuestWithResume();
      expect((await postScan({ resumeId }, cookie, ip)).status).toBe(202);
    }
    const { resumeId, cookie } = await newGuestWithResume();
    expect((await postScan({ resumeId }, cookie, ip)).status).toBe(429);
  });
});

describe("DELETE /api/resumes/:id", () => {
  it("also deletes the resume's scans, and only the owner's", async () => {
    const a = await newGuestWithResume();
    const b = await newGuestWithResume();
    const scanA = await startScan(a.resumeId, a.cookie);
    const scanB = await startScan(b.resumeId, b.cookie);
    await runBackground();

    // Another guest can't delete A's resume or, through it, A's scans.
    const foreign = await deleteResume(
      new Request(`${BASE}/api/resumes/${a.resumeId}`, {
        method: "DELETE",
        ...withCookie(b.cookie),
      }),
      ctx(a.resumeId),
    );
    expect(foreign.status).toBe(404);
    expect((await getScan(scanA, a.cookie)).status).toBe(200);

    const response = await deleteResume(
      new Request(`${BASE}/api/resumes/${a.resumeId}`, {
        method: "DELETE",
        ...withCookie(a.cookie),
      }),
      ctx(a.resumeId),
    );
    expect(response.status).toBe(204);
    expect((await getScan(scanA, a.cookie)).status).toBe(404);
    expect(await ScanModel.countDocuments({ resumeId: a.resumeId })).toBe(0);
    expect((await getScan(scanB, b.cookie)).status).toBe(200);
  });
});

describe("indexes", () => {
  it("expires guest scans by TTL and indexes the stale sweep", async () => {
    const indexes = await ScanModel.collection.indexes();
    const ttl = indexes.find((i) => i.key.expiresAt === 1);
    expect(ttl?.expireAfterSeconds).toBe(0);
    expect(indexes.some((i) => i.key.status === 1 && i.key.updatedAt === 1)).toBe(true);
    expect(indexes.some((i) => i.key["owner.id"] === 1 && i.key.createdAt === -1)).toBe(
      true,
    );
  });
});
