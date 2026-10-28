import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { POST as register } from "@/app/api/auth/register/route";
import { POST as upload } from "@/app/api/resumes/route";
import { GET as getResumeById } from "@/app/api/resumes/[id]/route";
import { GET as getScan } from "@/app/api/scans/[id]/route";
import { decodeGuestCookie } from "@/lib/auth/guest";
import { AUTH_RATE_LIMITS } from "@/lib/config/limits";
import { JobDescriptionModel } from "@/lib/db/models/job-description";
import { ResumeModel } from "@/lib/db/models/resume";
import { ScanModel } from "@/lib/db/models/scan";
import { UserModel } from "@/lib/db/models/user";
import {
  authenticateWithPassword,
  claimGuestData,
  signInWithGoogle,
} from "@/lib/services/account-service";
import { createScan } from "@/lib/services/scan-service";

import { setupTestDatabase } from "../../support/database";
import { sessionCookie } from "../../support/session";

setupTestDatabase();

const BASE = "http://localhost:3000";
const PASSWORD = "correct horse battery";
const resumeBytes = () =>
  readFileSync(join(process.cwd(), "tests/fixtures/resumes/clean-single-column.pdf"));
const jobText = () =>
  readFileSync(join(process.cwd(), "tests/fixtures/jobs/backend-engineer.txt"), "utf8");

function registerRequest(body: unknown, ip = "203.0.113.50") {
  return register(
    new Request(`${BASE}/api/auth/register`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
    }),
  );
}

async function newAccount(email = "ada@example.com"): Promise<string> {
  const response = await registerRequest({
    name: "Ada Lovelace",
    email,
    password: PASSWORD,
  });
  expect(response.status).toBe(201);
  return (await response.json()).data.id as string;
}

function uploadAs(cookie?: string) {
  const form = new FormData();
  form.append(
    "file",
    new File([new Uint8Array(resumeBytes())], "resume.pdf", { type: "application/pdf" }),
  );
  return upload(
    new Request(`${BASE}/api/resumes`, {
      method: "POST",
      body: form,
      headers: { "x-forwarded-for": "203.0.113.60", ...(cookie ? { cookie } : {}) },
    }),
  );
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const readResume = (id: string, cookie: string) =>
  getResumeById(
    new Request(`${BASE}/api/resumes/${id}`, { headers: { cookie } }),
    ctx(id),
  );
const readScan = (id: string, cookie: string) =>
  getScan(new Request(`${BASE}/api/scans/${id}`, { headers: { cookie } }), ctx(id));

describe("POST /api/auth/register", () => {
  it("creates an account with a normalized email and a bcrypt hash", async () => {
    const response = await registerRequest({
      name: "  Ada Lovelace ",
      email: " Ada@Example.COM ",
      password: PASSWORD,
    });
    expect(response.status).toBe(201);
    const { data } = await response.json();
    const user = await UserModel.findById(data.id).lean();
    expect(user).toMatchObject({ name: "Ada Lovelace", email: "ada@example.com" });
    expect(user!.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(user!.passwordHash).not.toContain(PASSWORD);
  });

  it("says which field is invalid", async () => {
    const cases: [Record<string, unknown>, string, string][] = [
      [{ email: "a@example.com", password: PASSWORD }, "name", "Enter your name."],
      [
        { name: "A", email: "not-an-email", password: PASSWORD },
        "email",
        "Enter a valid email address.",
      ],
      [
        { name: "A", email: "a@example.com", password: "short" },
        "password",
        "Use at least 8 characters.",
      ],
      // 74 bytes in UTF-8: past what bcrypt reads.
      [
        { name: "A", email: "a@example.com", password: "é".repeat(37) },
        "password",
        "That password is too long. Use 72 characters or fewer.",
      ],
    ];
    for (const [body, field, message] of cases) {
      const response = await registerRequest(body);
      expect(response.status).toBe(400);
      expect((await response.json()).error).toEqual({
        code: "INVALID_INPUT",
        message,
        details: { field },
      });
    }
    const extra = await registerRequest({
      name: "A",
      email: "a@example.com",
      password: PASSWORD,
      admin: true,
    });
    expect(extra.status).toBe(400);
  });

  it("refuses an email that already has an account, whatever its case", async () => {
    await newAccount("ada@example.com");
    const response = await registerRequest({
      name: "Someone",
      email: "ADA@example.com",
      password: PASSWORD,
    });
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("EMAIL_TAKEN");
    expect(await UserModel.countDocuments()).toBe(1);
  });

  it(`allows ${AUTH_RATE_LIMITS.registerPerIpPerHour} sign-ups per network per hour`, async () => {
    for (let i = 0; i < AUTH_RATE_LIMITS.registerPerIpPerHour; i++) {
      const ok = await registerRequest(
        { name: "A", email: `user${i}@example.com`, password: PASSWORD },
        "198.51.100.7",
      );
      expect(ok.status).toBe(201);
    }
    const limited = await registerRequest(
      { name: "A", email: "one-more@example.com", password: PASSWORD },
      "198.51.100.7",
    );
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

describe("password sign-in", () => {
  it("accepts the right password and records the sign-in", async () => {
    const id = await newAccount();
    const result = await authenticateWithPassword(
      "ADA@example.com",
      PASSWORD,
      "192.0.2.1",
    );
    expect(result).toEqual({
      ok: true,
      user: { id, email: "ada@example.com", name: "Ada Lovelace", image: null },
    });
    expect((await UserModel.findById(id).lean())!.lastLoginAt).toBeInstanceOf(Date);
  });

  it("refuses a wrong password and an unknown email alike", async () => {
    await newAccount();
    expect(
      await authenticateWithPassword("ada@example.com", "wrong password", "192.0.2.1"),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(
      await authenticateWithPassword("nobody@example.com", PASSWORD, "192.0.2.1"),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  it("limits attempts per email, even with the right password afterwards", async () => {
    await newAccount();
    for (let i = 0; i < AUTH_RATE_LIMITS.loginPerEmailPer15Min; i++) {
      await authenticateWithPassword("ada@example.com", "guess", `192.0.2.${i + 10}`);
    }
    expect(
      await authenticateWithPassword("ada@example.com", PASSWORD, "192.0.2.200"),
    ).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("limits attempts per network across emails", async () => {
    for (let i = 0; i < AUTH_RATE_LIMITS.loginPerIpPer15Min; i++) {
      await authenticateWithPassword(`guess${i}@example.com`, "guess", "192.0.2.99");
    }
    expect(
      await authenticateWithPassword("other@example.com", "guess", "192.0.2.99"),
    ).toEqual({ ok: false, reason: "rate_limited" });
  });
});

describe("Google sign-in", () => {
  const profile = {
    email: "Grace@Example.com",
    emailVerified: true,
    name: "Grace Hopper",
    image: "https://example.com/grace.png",
    providerAccountId: "google-123",
  };

  it("refuses an email Google hasn't verified", async () => {
    expect(await signInWithGoogle({ ...profile, emailVerified: false })).toBeNull();
    expect(await UserModel.countDocuments()).toBe(0);
  });

  it("creates the account once, then signs in to the same one", async () => {
    const first = await signInWithGoogle(profile);
    const second = await signInWithGoogle(profile);
    expect(second!.id).toBe(first!.id);
    const user = await UserModel.findById(first!.id).lean();
    expect(user).toMatchObject({ email: "grace@example.com", name: "Grace Hopper" });
    expect(user!.providers).toEqual([
      { provider: "google", providerAccountId: "google-123" },
    ]);
    expect(user!.emailVerified).toBeInstanceOf(Date);
  });

  it("links Google to an existing password account with the same email", async () => {
    const id = await newAccount("grace@example.com");
    const signedIn = await signInWithGoogle(profile);
    expect(signedIn!.id).toBe(id);
    // The name chosen at sign-up stays.
    expect(signedIn!.name).toBe("Ada Lovelace");
    expect(await UserModel.countDocuments()).toBe(1);
  });
});

describe("signed-in owners", () => {
  it("keeps a signed-in user's uploads on the account, without a guest cookie", async () => {
    const userId = await newAccount();
    const cookie = await sessionCookie(userId);
    const response = await uploadAs(cookie);
    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toBeNull();
    const { data } = await response.json();
    const resume = await ResumeModel.findById(data.id).lean();
    expect(resume!.owner).toEqual({ type: "user", id: userId });
    expect(resume!.expiresAt).toBeUndefined();

    expect((await readResume(data.id, cookie)).status).toBe(200);
    // Another account, or a forged session, sees nothing.
    const other = await sessionCookie(await newAccount("someone@example.com"));
    expect((await readResume(data.id, other)).status).toBe(404);
    expect((await readResume(data.id, `${cookie.slice(0, -4)}AAAA`)).status).toBe(404);
  });
});

describe("claiming guest data", () => {
  async function guestWithData() {
    const response = await uploadAs();
    const guestCookie = response.headers.get("set-cookie")!.split(";")[0]!;
    const guestId = decodeGuestCookie(decodeURIComponent(guestCookie.split("=")[1]!))!;
    const resumeId = (await response.json()).data.id as string;
    const { scanId } = await createScan(
      { resumeId, jobDescription: { text: jobText() } },
      { requestId: "test", owner: { type: "guest", id: guestId } },
    );
    return { guestCookie, guestId, resumeId, scanId };
  }

  it("moves the guest's resume, job description and scan to the account", async () => {
    const userId = await newAccount();
    const guest = await guestWithData();
    const bystander = await guestWithData();

    expect(await claimGuestData(guest.guestId, userId)).toEqual({
      resumes: 1,
      scans: 1,
      jobDescriptions: 1,
    });

    const session = await sessionCookie(userId);
    expect((await readResume(guest.resumeId, session)).status).toBe(200);
    expect((await readScan(guest.scanId, session)).status).toBe(200);
    // The guest identity no longer reaches it, and it no longer expires.
    expect((await readResume(guest.resumeId, guest.guestCookie)).status).toBe(404);
    const owned = { "owner.type": "user" as const, "owner.id": userId };
    for (const docs of [
      await ResumeModel.find(owned).lean(),
      await ScanModel.find(owned).lean(),
      await JobDescriptionModel.find(owned).lean(),
    ]) {
      expect(docs).toHaveLength(1);
      expect(docs[0]!.expiresAt).toBeUndefined();
    }
    // Other guests are untouched.
    expect((await readResume(bystander.resumeId, bystander.guestCookie)).status).toBe(
      200,
    );
  });

  it("is idempotent", async () => {
    const userId = await newAccount();
    const guest = await guestWithData();
    await claimGuestData(guest.guestId, userId);
    expect(await claimGuestData(guest.guestId, userId)).toEqual({
      resumes: 0,
      scans: 0,
      jobDescriptions: 0,
    });
    expect(await ResumeModel.countDocuments({ "owner.id": userId })).toBe(1);
  });
});
