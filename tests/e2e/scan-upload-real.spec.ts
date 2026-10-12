import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";

import { encryptedOfficeContainer, minimalDocx, minimalPdf } from "../support/documents";

// End-to-end against the real POST /api/resumes (no mocks).
// Each test uses its own client address so local re-runs don't hit the hourly rate limit.
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
  await expect(card.getByRole("status")).toHaveText("Ready");
  await expect(card).toContainText("jane-doe-resume.pdf");
});

test("uploads a real DOCX and shows it as ready", async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles({
    name: "jane-doe-resume.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: minimalDocx(),
  });
  await expect(
    page.getByRole("region", { name: "Selected file" }).getByRole("status"),
  ).toHaveText("Ready");
});

test("the server rejects a text file disguised as a PDF", async ({ page }) => {
  // Passes the browser's name and MIME checks; only the server's byte check catches it.
  await page.locator('input[type="file"]').setInputFiles({
    name: "resume.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("This is plain text pretending to be a PDF."),
  });
  const card = page.getByRole("region", { name: "Selected file" });
  await expect(card.getByRole("status")).toHaveText("Upload failed");
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
  );
});
