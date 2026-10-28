import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, type BrowserContext, type Page } from "@playwright/test";
import mongoose from "mongoose";

/**
 * Helpers for results-page tests. Real uploads and scans go through the API; scan states
 * that pass too quickly to observe (queued, running, failed) are written to the same
 * database the app uses, for the guest the browser itself created.
 */

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/atsly";
let connection: mongoose.Connection | null = null;

async function db(): Promise<mongoose.Connection> {
  connection ??= await mongoose.createConnection(uri).asPromise();
  return connection;
}

export async function closeDb(): Promise<void> {
  await connection?.close();
  connection = null;
}

/** A random documentation-range address, so tests never share a rate-limit window. */
export function randomAddress(): string {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  return `198.18.${octet()}.${octet()}`;
}

export const fixturePdf = (name = "clean-single-column.pdf") => ({
  name,
  mimeType: "application/pdf",
  buffer: readFileSync(join(process.cwd(), "tests/fixtures/resumes", name)),
});

/** Uploads a fixture through the API as this browser's guest; returns the resume id. */
export async function uploadResume(page: Page, name?: string): Promise<string> {
  const response = await page.request.post("/api/resumes", {
    multipart: { file: fixturePdf(name) },
    headers: { "x-forwarded-for": randomAddress() },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).data.id as string;
}

/** Starts a real scan and waits for it to complete; returns the scan id. */
export async function completedScan(page: Page, resumeId: string): Promise<string> {
  const response = await page.request.post("/api/scans", {
    data: { resumeId },
    headers: { "x-forwarded-for": randomAddress() },
  });
  expect(response.status()).toBe(202);
  const scanId = (await response.json()).data.scanId as string;
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`/api/scans/${scanId}/status`)).json()).data
          .status,
      { timeout: 30_000 },
    )
    .toBe("complete");
  return scanId;
}

/** The guest id from this browser's signed cookie. */
export async function guestId(context: BrowserContext): Promise<string> {
  const cookie = (await context.cookies()).find((c) => c.name === "atsly_gid");
  if (!cookie) throw new Error("No guest cookie yet; upload a resume first.");
  return decodeURIComponent(cookie.value).split(".")[0]!;
}

type SeedOptions = { resumeId: string; owner: string; fileName?: string };

/** Inserts a queued scan that no pipeline will run, so the test controls its state. */
export async function seedQueuedScan(options: SeedOptions): Promise<string> {
  const scans = (await db()).collection("scans");
  const now = new Date();
  const { insertedId } = await scans.insertOne({
    owner: { type: "guest", id: options.owner },
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    resumeId: new mongoose.Types.ObjectId(options.resumeId),
    status: "queued",
    stage: null,
    engineVersion: "1.0.0",
    resumeSnapshot: {
      fileName: options.fileName ?? "seeded-resume.pdf",
      pageCount: 1,
      wordCount: 221,
    },
    createdAt: now,
    updatedAt: now,
  });
  return String(insertedId);
}

export async function updateScan(scanId: string, fields: Record<string, unknown>) {
  const scans = (await db()).collection("scans");
  await scans.updateOne(
    { _id: new mongoose.Types.ObjectId(scanId) },
    { $set: { ...fields, updatedAt: new Date() } },
  );
}

/** Copies the finished report of one scan onto another, completing it. */
export async function completeLike(scanId: string, sourceScanId: string) {
  const scans = (await db()).collection("scans");
  const source = await scans.findOne({ _id: new mongoose.Types.ObjectId(sourceScanId) });
  if (!source) throw new Error("Source scan not found");
  await updateScan(scanId, {
    status: "complete",
    stage: null,
    ats: source.ats,
    summary: source.summary,
    ai: source.ai,
    durationMs: source.durationMs,
  });
}

/** The signed-in account's id, from the browser's session. */
export async function sessionUserId(page: Page): Promise<string> {
  const session = await (await page.request.get("/api/auth/session")).json();
  if (!session?.user?.id) throw new Error("Not signed in.");
  return session.user.id as string;
}

/**
 * Complete scans for an account, written straight to the database: lists and stats read
 * only their summaries. Newest first, one minute apart; ATS scores rise toward the newest.
 */
export async function seedUserScans(
  userId: string,
  count: number,
  options: { matchEvery?: number } = {},
): Promise<string[]> {
  const scans = (await db()).collection("scans");
  const now = Date.now();
  const resumeId = new mongoose.Types.ObjectId();
  const docs = Array.from({ length: count }, (_, i) => {
    const createdAt = new Date(now - (i + 1) * 60_000);
    const withMatch = options.matchEvery !== undefined && i % options.matchEvery === 0;
    return {
      owner: { type: "user", id: userId },
      resumeId,
      status: "complete",
      stage: null,
      engineVersion: "1.1.0",
      resumeSnapshot: {
        fileName: `seeded-${count - i}.pdf`,
        pageCount: 1,
        wordCount: 300,
      },
      summary: {
        headline: "Strong structure.",
        atsScore: 90 - i,
        atsBand: "good",
        topActions: ["Add dates to every role"],
        issueCounts: { critical: 0, major: 1, minor: 1 },
        ...(withMatch ? { matchScore: 60 + (i % 10), matchBand: "moderate" } : {}),
      },
      createdAt,
      updatedAt: createdAt,
    };
  });
  const result = await scans.insertMany(docs);
  return Object.values(result.insertedIds).map(String);
}
