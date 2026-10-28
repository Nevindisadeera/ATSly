import { readFileSync } from "node:fs";
import { join } from "node:path";

import mongoose from "mongoose";
import { describe, expect, it, vi } from "vitest";

import { DELETE as deleteAccountRoute } from "@/app/api/account/route";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as upload } from "@/app/api/resumes/route";
import {
  DELETE as deleteAll,
  GET as list,
  POST as startScan,
} from "@/app/api/scans/route";
import { DELETE as deleteOne } from "@/app/api/scans/[id]/route";
import { JobDescriptionModel } from "@/lib/db/models/job-description";
import { ResumeModel } from "@/lib/db/models/resume";
import { ScanModel } from "@/lib/db/models/scan";
import { UserModel } from "@/lib/db/models/user";
import { getOverview } from "@/lib/services/dashboard-service";
import { acceptJobDescription } from "@/lib/services/job-service";

import { setupTestDatabase } from "../../support/database";
import { sessionCookie } from "../../support/session";

// The scan route runs its pipeline in after(); here it is simply not run.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: () => undefined,
}));

setupTestDatabase();

const BASE = "http://localhost:3000";
let addressCounter = 0;
const address = () => `203.0.113.${(addressCounter++ % 250) + 1}`;

async function newUser(email: string): Promise<{ id: string; cookie: string }> {
  const response = await register(
    new Request(`${BASE}/api/auth/register`, {
      method: "POST",
      body: JSON.stringify({
        name: "Test User",
        email,
        password: "correct horse battery",
      }),
      headers: { "content-type": "application/json", "x-forwarded-for": address() },
    }),
  );
  const id = (await response.json()).data.id as string;
  return { id, cookie: await sessionCookie(id) };
}

async function uploadAs(cookie?: string) {
  const form = new FormData();
  const bytes = readFileSync(
    join(process.cwd(), "tests/fixtures/resumes/clean-single-column.pdf"),
  );
  form.append(
    "file",
    new File([new Uint8Array(bytes)], "r.pdf", { type: "application/pdf" }),
  );
  const response = await upload(
    new Request(`${BASE}/api/resumes`, {
      method: "POST",
      body: form,
      headers: { "x-forwarded-for": address(), ...(cookie ? { cookie } : {}) },
    }),
  );
  return {
    id: (await response.json()).data.id as string,
    setCookie: response.headers.get("set-cookie"),
  };
}

type SeedScan = {
  createdAt: Date;
  status?: "complete" | "failed" | "queued";
  atsScore?: number;
  matchScore?: number;
};

/** Scans written straight to the database: lists only read their summaries. */
async function seedScans(userId: string, scans: SeedScan[]) {
  const resumeId = new mongoose.Types.ObjectId();
  const docs = scans.map((scan) => {
    const status = scan.status ?? "complete";
    return {
      owner: { type: "user", id: userId },
      resumeId,
      status,
      stage: null,
      engineVersion: "1.1.0",
      resumeSnapshot: { fileName: "resume.pdf", pageCount: 1, wordCount: 300 },
      ...(status === "complete"
        ? {
            summary: {
              headline: "Strong structure.",
              atsScore: scan.atsScore ?? 70,
              atsBand: "good",
              topActions: ["Add dates to every role"],
              issueCounts: { critical: 0, major: 1, minor: 2 },
              ...(scan.matchScore !== undefined
                ? { matchScore: scan.matchScore, matchBand: "moderate" }
                : {}),
            },
            ats: { score: scan.atsScore ?? 70, categories: [] },
          }
        : {}),
      ...(status === "failed"
        ? { error: { code: "TIMEOUT", message: "Took too long.", retryable: true } }
        : {}),
      createdAt: scan.createdAt,
      updatedAt: scan.createdAt,
    };
  });
  const result = await ScanModel.collection.insertMany(docs);
  return Object.values(result.insertedIds).map(String);
}

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

function listPage(cookie: string | undefined, query = "") {
  return list(
    new Request(`${BASE}/api/scans${query}`, { headers: cookie ? { cookie } : {} }),
  );
}

function jsonDelete(
  handler: (request: Request) => Promise<Response>,
  path: string,
  cookie: string,
  body: unknown,
) {
  return handler(
    new Request(`${BASE}${path}`, {
      method: "DELETE",
      body: JSON.stringify(body),
      headers: { cookie, "content-type": "application/json" },
    }),
  );
}

describe("GET /api/scans", () => {
  it("is for accounts only", async () => {
    expect((await listPage(undefined)).status).toBe(401);
    const guest = (await uploadAs()).setCookie!.split(";")[0]!;
    const response = await listPage(guest);
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("pages through the user's scans newest first, without repeats or reports", async () => {
    const user = await newUser("pages@example.com");
    const other = await newUser("other@example.com");
    // Five pairs share a timestamp, so the order has to fall back to the id.
    const times = Array.from({ length: 25 }, (_, i) => minutesAgo(Math.floor(i / 2) * 5));
    const ids = await seedScans(
      user.id,
      times.map((createdAt) => ({ createdAt })),
    );
    await seedScans(other.id, [{ createdAt: minutesAgo(1) }]);

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const response = await listPage(
        user.cookie,
        `?limit=10${cursor ? `&cursor=${cursor}` : ""}`,
      );
      expect(response.status).toBe(200);
      const { data } = await response.json();
      seen.push(...data.items.map((item: { id: string }) => item.id));
      cursor = data.nextCursor;
      pages += 1;
      if (pages === 1) {
        expect(Object.keys(data.items[0]).sort()).toEqual(
          [
            "atsBand",
            "atsScore",
            "createdAt",
            "error",
            "id",
            "job",
            "matchBand",
            "matchScore",
            "resume",
            "status",
            "topAction",
          ].sort(),
        );
        expect(data.items[0]).toMatchObject({
          atsScore: 70,
          topAction: "Add dates to every role",
          resume: { fileName: "resume.pdf" },
        });
      }
    } while (cursor);

    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(25);
    expect(new Set(seen)).toEqual(new Set(ids));
    const created = await ScanModel.find({ _id: { $in: seen } }, { createdAt: 1 }).lean();
    const timeOf = new Map(
      created.map((doc) => [String(doc._id), doc.createdAt.getTime()]),
    );
    const seenTimes = seen.map((id) => timeOf.get(id)!);
    expect(seenTimes).toEqual([...seenTimes].sort((a, b) => b - a));
  });

  it("rejects bad paging parameters", async () => {
    const user = await newUser("params@example.com");
    for (const query of ["?limit=0", "?limit=51", "?limit=abc", "?cursor=not-a-cursor"]) {
      expect((await listPage(user.cookie, query)).status).toBe(400);
    }
  });
});

describe("dashboard overview", () => {
  it("summarizes complete scans and finds the latest one", async () => {
    const user = await newUser("overview@example.com");
    await seedScans(user.id, [
      { createdAt: minutesAgo(1), status: "failed" },
      { createdAt: minutesAgo(2), atsScore: 82, matchScore: 64 },
      { createdAt: minutesAgo(3), atsScore: 75 },
      { createdAt: minutesAgo(4), atsScore: 61, matchScore: 70 },
    ]);
    const overview = await getOverview({ type: "user", id: user.id });
    expect(overview.latest).toMatchObject({ atsScore: 82, matchScore: 64 });
    expect(overview.stats).toEqual({
      scans: 3,
      bestAtsScore: 82,
      averageMatch: 67,
      trend: [
        { date: expect.any(String), atsScore: 61 },
        { date: expect.any(String), atsScore: 75 },
        { date: expect.any(String), atsScore: 82 },
      ],
    });
    expect(overview.recent.items).toHaveLength(4);
    expect(overview.recent.items[0]).toMatchObject({
      status: "failed",
      error: "TIMEOUT",
    });
  });

  it("is quick with 50 scans and caps the trend", async () => {
    const user = await newUser("busy@example.com");
    await seedScans(
      user.id,
      Array.from({ length: 50 }, (_, i) => ({
        createdAt: minutesAgo(i),
        atsScore: 50 + i,
      })),
    );
    const started = performance.now();
    const overview = await getOverview({ type: "user", id: user.id });
    expect(performance.now() - started).toBeLessThan(500);
    expect(overview.stats.scans).toBe(50);
    expect(overview.stats.trend).toHaveLength(12);
    expect(overview.recent.nextCursor).not.toBeNull();
  });

  it("is empty for a new account", async () => {
    const user = await newUser("new@example.com");
    expect(await getOverview({ type: "user", id: user.id })).toEqual({
      latest: null,
      stats: { scans: 0, bestAtsScore: null, averageMatch: null, trend: [] },
      recent: { items: [], nextCursor: null },
    });
  });
});

describe("deleting", () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const deleteScan = (id: string, cookie: string) =>
    deleteOne(
      new Request(`${BASE}/api/scans/${id}`, { method: "DELETE", headers: { cookie } }),
      ctx(id),
    );

  it("deletes one scan for its owner only", async () => {
    const owner = await newUser("owner@example.com");
    const stranger = await newUser("stranger@example.com");
    const [id] = await seedScans(owner.id, [{ createdAt: minutesAgo(1) }]);

    expect((await deleteScan(id!, stranger.cookie)).status).toBe(404);
    expect(await ScanModel.countDocuments({ _id: id })).toBe(1);
    expect((await deleteScan(id!, owner.cookie)).status).toBe(204);
    expect((await deleteScan(id!, owner.cookie)).status).toBe(404);
  });

  it("deletes all of a user's data, after a typed confirmation", async () => {
    const user = await newUser("all@example.com");
    const other = await newUser("keep@example.com");
    const resume = await uploadAs(user.cookie);
    await acceptJobDescription(
      {
        text: readFileSync(
          join(process.cwd(), "tests/fixtures/jobs/data-analyst.txt"),
          "utf8",
        ),
      },
      { requestId: "test", owner: { type: "user", id: user.id } },
    );
    await seedScans(user.id, [
      { createdAt: minutesAgo(1) },
      { createdAt: minutesAgo(2) },
    ]);
    await seedScans(other.id, [{ createdAt: minutesAgo(1) }]);
    await uploadAs(other.cookie);

    expect((await jsonDelete(deleteAll, "/api/scans", user.cookie, {})).status).toBe(400);
    expect(
      (await jsonDelete(deleteAll, "/api/scans", user.cookie, { confirm: "delete" }))
        .status,
    ).toBe(400);
    const response = await jsonDelete(deleteAll, "/api/scans", user.cookie, {
      confirm: "DELETE",
    });
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      scans: 2,
      resumes: 1,
      jobDescriptions: 1,
    });
    expect(await ResumeModel.countDocuments({ _id: resume.id })).toBe(0);
    // The account and other users' data stay.
    expect(await UserModel.countDocuments()).toBe(2);
    expect(await ScanModel.countDocuments({ "owner.id": other.id })).toBe(1);
    expect(await ResumeModel.countDocuments({ "owner.id": other.id })).toBe(1);
  });

  it("deletes the account and everything in it, and signs this browser out", async () => {
    const user = await newUser("leaving@example.com");
    const other = await newUser("staying@example.com");
    await uploadAs(user.cookie);
    await seedScans(user.id, [{ createdAt: minutesAgo(1) }]);
    await seedScans(other.id, [{ createdAt: minutesAgo(1) }]);

    expect(
      (await jsonDelete(deleteAccountRoute, "/api/account", user.cookie, {})).status,
    ).toBe(400);
    const response = await jsonDelete(deleteAccountRoute, "/api/account", user.cookie, {
      confirm: "DELETE",
    });
    expect(response.status).toBe(204);
    const cleared = response.headers.getSetCookie();
    expect(cleared.some((c) => /^authjs\.session-token=;.*Max-Age=0/.test(c))).toBe(true);
    expect(cleared.some((c) => /^__Secure-authjs\.session-token=;.*Secure/.test(c))).toBe(
      true,
    );

    expect(await UserModel.countDocuments({ _id: user.id })).toBe(0);
    const mine = { "owner.id": user.id };
    expect(await ScanModel.countDocuments(mine)).toBe(0);
    expect(await ResumeModel.countDocuments(mine)).toBe(0);
    expect(await JobDescriptionModel.countDocuments(mine)).toBe(0);
    expect(await ScanModel.countDocuments({ "owner.id": other.id })).toBe(1);

    // A leftover session elsewhere can't recreate data under the deleted account.
    const again = await uploadAs(user.cookie);
    const resume = await ResumeModel.findById(again.id).lean();
    expect(resume!.owner.type).toBe("guest");
    expect(again.setCookie).toMatch(/^atsly_gid=/);
  });

  it("refuses account deletion without an account", async () => {
    const guest = (await uploadAs()).setCookie!.split(";")[0]!;
    expect(
      (await jsonDelete(deleteAccountRoute, "/api/account", guest, { confirm: "DELETE" }))
        .status,
    ).toBe(401);
  });
});

describe("scanning again against a saved job", () => {
  function post(body: unknown, cookie: string) {
    return startScan(
      new Request(`${BASE}/api/scans`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          cookie,
          "content-type": "application/json",
          "x-forwarded-for": address(),
        },
      }),
    );
  }

  it("reuses the owner's job description, and only theirs", async () => {
    const user = await newUser("again@example.com");
    const stranger = await newUser("nosy@example.com");
    const resume = await uploadAs(user.cookie);
    const strangerResume = await uploadAs(stranger.cookie);
    const job = await acceptJobDescription(
      {
        text: readFileSync(
          join(process.cwd(), "tests/fixtures/jobs/data-analyst.txt"),
          "utf8",
        ),
        title: "Data Analyst",
      },
      { requestId: "test", owner: { type: "user", id: user.id } },
    );

    const response = await post(
      { resumeId: resume.id, jobDescriptionId: job.id },
      user.cookie,
    );
    expect(response.status).toBe(202);
    const scan = await ScanModel.findById((await response.json()).data.scanId).lean();
    expect(String(scan!.jobDescriptionId)).toBe(job.id);
    expect(scan!.jobSnapshot).toMatchObject({ title: "Data Analyst" });

    expect(
      (
        await post(
          { resumeId: strangerResume.id, jobDescriptionId: job.id },
          stranger.cookie,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await post(
          {
            resumeId: resume.id,
            jobDescriptionId: job.id,
            jobDescription: { text: "x".repeat(200) },
          },
          user.cookie,
        )
      ).status,
    ).toBe(400);
  });
});
