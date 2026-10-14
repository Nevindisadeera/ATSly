import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { encryptedOfficeContainer, minimalDocx, minimalPdf } from "../support/documents";

// End-to-end against the real POST /api/resumes (no mocks).
// Each test uses its own client address so local re-runs don't hit the hourly rate limit.
// The first request in dev mode compiles the route and pdf.js, so results get a longer wait.
const SERVER = { timeout: 30_000 };

const fixture = (name: string) => ({
  name,
  mimeType: "application/pdf",
  buffer: readFileSync(join(process.cwd(), "tests/fixtures/resumes", name)),
});
test.beforeEach(async ({ page }) => {
  const ip = `198.18.${randomBytes(1)[0]}.${randomBytes(1)[0]}`;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ip });
  await page.goto("/scan");
  await page.locator("[data-interactive]").waitFor();
});

test("uploads a real PDF and shows it as ready", async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles({
    name: "jane-doe-resume.pdf",
    mimeType: "application/pdf",
    buffer: minimalPdf(),
  });
  const card = page.getByRole("region", { name: "Selected file" });
  await expect(card.getByRole("status")).toHaveText("Ready", SERVER);
  await expect(card).toContainText("jane-doe-resume.pdf");
  // The parsed summary comes back from the server.
  await expect(card).toContainText("1 page");
  await expect(card.getByRole("list", { name: "Sections" })).toContainText(
    "Experience, found",
  );
});

test("shows the full section checklist for a complete resume", async ({ page }) => {
  await page
    .locator('input[type="file"]')
    .setInputFiles(fixture("clean-single-column.pdf"));
  const card = page.getByRole("region", { name: "Selected file" });
  await expect(card.getByRole("status")).toHaveText("Ready", SERVER);
  await expect(
    card.getByRole("list", { name: "Sections" }).getByRole("listitem"),
  ).toHaveText([
    "Experience, found",
    "Education, found",
    "Skills, found",
    "Summary, found",
    "Certifications, found",
  ]);
  await expect(card.getByText(/weren't found/)).toHaveCount(0);
});

test("explains when a resume isn't in English", async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles(fixture("spanish.pdf"));
  const card = page.getByRole("region", { name: "Selected file" });
  await expect(card.getByRole("status")).toHaveText("Ready", SERVER);
  await expect(card).toContainText("doesn't appear to be in English");
  // No sections were recognized: the warning explains it, so the checklist hint isn't repeated.
  await expect(card).toContainText("couldn't find clear section headings");
  await expect(card.getByText(/weren't found/)).toHaveCount(0);
});

const PARSE_FAILURES = [
  {
    title: "a scanned resume with no text",
    file: () => fixture("scanned.pdf"),
    message: "This file contains no readable text.",
  },
  {
    title: "a PDF over the page limit",
    file: () => ({
      name: "long.pdf",
      mimeType: "application/pdf",
      buffer: minimalPdf({ pages: 11 }),
    }),
    message: "Resumes over 10 pages aren't supported.",
  },
  {
    title: "a PDF that needs a password",
    file: () => ({
      name: "locked.pdf",
      mimeType: "application/pdf",
      buffer: minimalPdf({ userPassword: "secret" }),
    }),
    message: "It may be corrupted or password-protected.",
  },
];

for (const failure of PARSE_FAILURES) {
  test(`explains ${failure.title}`, async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles(failure.file());
    const card = page.getByRole("region", { name: "Selected file" });
    await expect(card.getByRole("status")).toHaveText("Upload failed", SERVER);
    await expect(card).toContainText(failure.message);
  });
}

test("uploads a real DOCX and shows it as ready", async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles({
    name: "jane-doe-resume.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: minimalDocx(),
  });
  await expect(
    page.getByRole("region", { name: "Selected file" }).getByRole("status"),
  ).toHaveText("Ready", SERVER);
});

test("the server rejects a text file disguised as a PDF", async ({ page }) => {
  // Passes the browser's name and MIME checks; only the server's byte check catches it.
  await page.locator('input[type="file"]').setInputFiles({
    name: "resume.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("This is plain text pretending to be a PDF."),
  });
  const card = page.getByRole("region", { name: "Selected file" });
  await expect(card.getByRole("status")).toHaveText("Upload failed", SERVER);
  await expect(card).toContainText(
    "That file type isn't supported. Upload a PDF or DOCX.",
  );
});

test("the server rejects a password-protected Word document", async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles({
    name: "locked.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: encryptedOfficeContainer(),
  });
  await expect(page.getByRole("region", { name: "Selected file" })).toContainText(
    "It may be corrupted or password-protected.",
    SERVER,
  );
});
