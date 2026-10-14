import { readFileSync } from "node:fs";
import { join } from "node:path";

import mongoose from "mongoose";
import { describe, expect, it } from "vitest";

import { GET as health } from "@/app/api/health/route";
import { DELETE, GET } from "@/app/api/resumes/[id]/route";
import { POST } from "@/app/api/resumes/route";
import { encodeGuestCookie, GUEST_COOKIE } from "@/lib/auth/guest";
import { ResumeModel } from "@/lib/db/models/resume";
import { disconnectDb } from "@/lib/db/mongoose";
import { isConnectivityError, withDb } from "@/lib/db/with-db";

import { setupTestDatabase } from "../../support/database";
import { minimalPdf } from "../../support/documents";

setupTestDatabase();

const BASE = "http://localhost:3000";
const resumeBytes = () =>
  readFileSync(join(process.cwd(), "tests/fixtures/resumes/clean-single-column.pdf"));

function upload(bytes: Uint8Array, cookie?: string, ip = "203.0.113.20") {
  const form = new FormData();
  form.append(
    "file",
    new File([new Uint8Array(bytes)], "resume.pdf", { type: "application/pdf" }),
  );
  return POST(
    new Request(`${BASE}/api/resumes`, {
      method: "POST",
      body: form,
      headers: { "x-forwarded-for": ip, ...(cookie ? { cookie } : {}) },
    }),
  );
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const get = (id: string, cookie?: string) =>
  GET(
    new Request(`${BASE}/api/resumes/${id}`, { headers: cookie ? { cookie } : {} }),
    ctx(id),
  );
const del = (id: string, cookie?: string) =>
  DELETE(
    new Request(`${BASE}/api/resumes/${id}`, {
      method: "DELETE",
      headers: cookie ? { cookie } : {},
    }),
    ctx(id),
  );

/** Uploads as a new guest and returns the resume id and the guest's cookie. */
async function uploadAsNewGuest(bytes: Uint8Array = resumeBytes()) {
  const response = await upload(bytes);
  expect(response.status).toBe(201);
  const setCookie = response.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0]!;
  const { data } = await response.json();
  return { id: data.id as string, cookie };
}

describe("guest identity", () => {
  it("issues a signed, HttpOnly guest cookie on the first upload", async () => {
    const response = await upload(resumeBytes());
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(new RegExp(`^${GUEST_COOKIE}=[0-9a-f-]{36}\\.`));
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Max-Age=2592000");
  });

  it("does not issue a new cookie when a valid one is sent", async () => {
    const { cookie } = await uploadAsNewGuest();
    const again = await upload(minimalPdf(), cookie);
    expect(again.status).toBe(201);
    expect(again.headers.get("set-cookie")).toBeNull();
  });

  it("ignores a forged or tampered cookie", async () => {
    const { id, cookie } = await uploadAsNewGuest();
    const guestId = decodeURIComponent(cookie.split("=")[1]!).split(".")[0]!;
    const forged = `${GUEST_COOKIE}=${guestId}.not-a-real-signature`;
    expect((await get(id, forged)).status).toBe(404);
    const otherSecret = `${GUEST_COOKIE}=${encodeURIComponent(`${guestId}.${"A".repeat(43)}`)}`;
    expect((await get(id, otherSecret)).status).toBe(404);
  });
});

describe("ownership", () => {
  it("lets the owner read their resume, without the raw text", async () => {
    const { id, cookie } = await uploadAsNewGuest();
    const response = await get(id, cookie);
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data).toMatchObject({
      id,
      fileName: "resume.pdf",
      pageCount: 1,
      createdAt: expect.any(String),
      expiresAt: expect.any(String),
    });
    expect(data.parsed.contact.email).toBe("jordan.rivera@example.com");
    expect(data).not.toHaveProperty("extraction");
    expect(data).not.toHaveProperty("text");
  });

  it("hides one guest's resume from another, and from requests without a cookie", async () => {
    const a = await uploadAsNewGuest();
    const b = await uploadAsNewGuest(minimalPdf());

    for (const response of [await get(a.id, b.cookie), await get(a.id)]) {
      expect(response.status).toBe(404);
      expect((await response.json()).error.code).toBe("NOT_FOUND");
    }
    expect((await del(a.id, b.cookie)).status).toBe(404);
    // Still there for its owner.
    expect((await get(a.id, a.cookie)).status).toBe(200);
  });

  it("answers 404 for ids that don't exist or aren't valid", async () => {
    const { cookie } = await uploadAsNewGuest();
    expect((await get(new mongoose.Types.ObjectId().toString(), cookie)).status).toBe(
      404,
    );
    expect((await get("not-an-id", cookie)).status).toBe(404);
    expect((await get("../../etc/passwd", cookie)).status).toBe(404);
  });

  it("lets the owner delete their resume", async () => {
    const { id, cookie } = await uploadAsNewGuest();
    const response = await del(id, cookie);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect((await get(id, cookie)).status).toBe(404);
    expect((await del(id, cookie)).status).toBe(404);
  });
});

describe("persistence", () => {
  it("stores metadata, extracted text and the parsed resume, but never the file", async () => {
    const { id } = await uploadAsNewGuest();
    const doc = await ResumeModel.findById(id).lean();
    expect(doc).toMatchObject({
      owner: { type: "guest" },
      file: { originalName: "resume.pdf", extension: "pdf", pageCount: 1 },
      extraction: { engine: "pdfjs", wordCount: expect.any(Number) },
      parserVersion: expect.any(String),
      language: "en",
    });
    expect(doc!.file.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(doc!.extraction.text).toContain("Jordan Rivera");
    expect(Object.keys(doc!)).not.toContain("bytes");
  });

  it("deletes guest resumes after 7 days via a TTL index", async () => {
    const before = Date.now();
    const { id } = await uploadAsNewGuest();
    const doc = await ResumeModel.findById(id).lean();
    const days = (doc!.expiresAt!.getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThan(7.01);

    const indexes = await ResumeModel.collection.indexes();
    expect(indexes).toContainEqual(
      expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
    );
  });

  it("reuses the stored resume when the same owner uploads the same file again", async () => {
    const { id, cookie } = await uploadAsNewGuest();
    const second = await (await upload(resumeBytes(), cookie)).json();
    expect(second.data.id).toBe(id);
    expect(await ResumeModel.countDocuments()).toBe(1);
  });

  it("keeps separate copies for different owners", async () => {
    const a = await uploadAsNewGuest();
    const b = await uploadAsNewGuest();
    expect(a.id).not.toBe(b.id);
    expect(await ResumeModel.countDocuments()).toBe(2);
  });
});

describe("rate limiting across requests", () => {
  it("counts uploads in MongoDB and blocks the 16th in an hour", async () => {
    const bytes = minimalPdf();
    for (let i = 0; i < 15; i += 1) {
      expect((await upload(bytes, undefined, "198.51.100.7")).status).toBe(201);
    }
    const blocked = await upload(bytes, undefined, "198.51.100.7");
    expect(blocked.status).toBe(429);
    const windows = await mongoose.connection
      .db!.collection("rate_limits")
      .find()
      .toArray();
    expect(windows).toHaveLength(1);
    expect(windows[0]).toMatchObject({
      count: 16,
      key: expect.stringMatching(/^upload:ip:198\.51\.100\.7:\d+$/),
    });
  });
});

describe("database availability", () => {
  it("reports health when the database is reachable", async () => {
    const response = await health();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ ok: true, db: "up" });
  });

  it("maps connection failures to 503 SERVICE_UNAVAILABLE", async () => {
    const error = Object.assign(new Error("connect ECONNREFUSED"), {
      name: "MongoServerSelectionError",
    });
    expect(isConnectivityError(error)).toBe(true);
    await expect(withDb(() => Promise.reject(error))).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("returns 503 instead of crashing when the database isn't configured", async () => {
    const uri = process.env.MONGODB_URI;
    await disconnectDb();
    delete process.env.MONGODB_URI;
    try {
      const response = await upload(minimalPdf());
      expect(response.status).toBe(503);
      expect((await response.json()).error.code).toBe("SERVICE_UNAVAILABLE");
      expect((await health()).status).toBe(503);
    } finally {
      process.env.MONGODB_URI = uri;
      await mongoose.connect(uri!);
    }
  });
});

describe("guest cookie encoding", () => {
  it("round-trips through the signing helpers", () => {
    const value = encodeGuestCookie("2f1c6a1e-7b3d-4c5e-9f10-123456789abc");
    expect(value).toMatch(/^2f1c6a1e-7b3d-4c5e-9f10-123456789abc\.[A-Za-z0-9_-]{43}$/);
  });
});
