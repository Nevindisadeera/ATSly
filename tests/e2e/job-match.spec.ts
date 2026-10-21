import { readFileSync } from "node:fs";
import { join } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  closeDb,
  completedScan,
  fixturePdf,
  randomAddress,
  uploadResume,
} from "./support/scans";

// Job matching end to end: paste a job description when scanning, re-scan an existing
// resume, and read the match with its evidence. Real API and database.
const SERVER = { timeout: 30_000 };

const jobText = (name: string) =>
  readFileSync(join(process.cwd(), "tests/fixtures/jobs", `${name}.txt`), "utf8");

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomAddress() });
});

test.afterAll(async () => {
  await closeDb();
});

async function uploadOnScanPage(page: Page, file = "strong-bullets.pdf") {
  await page.goto("/scan");
  await page.locator("[data-interactive]").waitFor();
  await page.locator('input[type="file"]').setInputFiles(fixturePdf(file));
  await expect(
    page.getByRole("region", { name: "Selected file" }).getByRole("status"),
  ).toHaveText("Ready", SERVER);
}

const jobPosting = (page: Page) => page.getByRole("textbox", { name: /Job posting/ });

test("matches a resume against a pasted job description", async ({ page }) => {
  await uploadOnScanPage(page);
  await expect(page.getByRole("navigation", { name: "Scan progress" })).toContainText(
    /Step 2 of 3|Job description/,
  );

  await jobPosting(page).fill(jobText("marketing-manager"));
  await expect(page.getByText("Looks like a complete posting.")).toBeVisible();
  await page.getByRole("button", { name: "Add details" }).click();
  await expect(page.getByRole("textbox", { name: "Job title" })).toHaveValue(
    "Digital Marketing Manager",
  );
  await page.getByRole("textbox", { name: "Company" }).fill("Brightline Software");

  await page.getByRole("button", { name: "Analyze resume" }).click();
  await page.waitForURL(/\/results\/[0-9a-f]{24}$/, SERVER);

  await expect(
    page.getByText(/Matched against\s*Digital Marketing Manager at Brightline Software/),
  ).toBeVisible(SERVER);
  await expect(
    page.getByRole("img", { name: /^Job match \d+ out of 100/ }).first(),
  ).toBeAttached();
  const section = page.locator("#job-match");
  await expect(section.getByRole("heading", { name: "Match breakdown" })).toBeVisible();
  await expect(section.getByText("Not assessed")).toBeVisible();
  await expect(section.getByRole("heading", { name: "Required skills" })).toBeVisible();
  await expect(section.getByText(/^If you have experience with /).first()).toBeVisible();
  await expect(section.getByRole("heading", { name: "Fit" })).toBeVisible();

  // Evidence opens on click or tap, and closes with Escape.
  const chip = section.getByRole("button", { name: /^SEO/ });
  if (test.info().project.name.includes("mobile")) await chip.tap();
  else await chip.click();
  const details = page.getByRole("dialog", { name: "SEO: how it matched" });
  await expect(details).toContainText("Exact match");
  await expect(details).toContainText(/Experience › .+ › bullet \d+/);
  await page.keyboard.press("Escape");
  await expect(details).toBeHidden();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("evidence is reachable from the keyboard", async ({ page }) => {
  await uploadOnScanPage(page);
  await jobPosting(page).fill(jobText("marketing-manager"));
  await page.getByRole("button", { name: "Analyze resume" }).click();
  const chip = page.locator("#job-match").getByRole("button", { name: /^HubSpot/ });
  await expect(chip).toBeVisible(SERVER);

  await chip.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "HubSpot: how it matched" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(chip).toBeFocused();
});

test("short, long and skipped job descriptions", async ({ page }) => {
  await uploadOnScanPage(page);
  const analyze = page.getByRole("button", { name: "Analyze resume" });

  await jobPosting(page).fill("Python developer for a fintech team.");
  await expect(
    page.getByText("Add at least 100 characters, or skip this step."),
  ).toBeVisible();
  await expect(analyze).toBeEnabled();

  await jobPosting(page).fill("x ".repeat(8_000));
  await expect(page.getByText(/can be up to 15,000 characters/)).toBeVisible();
  await expect(jobPosting(page)).toHaveAttribute("aria-invalid", "true");
  await expect(analyze).toBeDisabled();

  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(
    page.getByText("Skipped. The report will cover ATS compatibility only."),
  ).toBeVisible();
  await expect(analyze).toBeEnabled();

  // A skipped (or too short) description isn't sent with the scan.
  const request = page.waitForRequest(
    (r) => r.url().endsWith("/api/scans") && r.method() === "POST",
  );
  await analyze.click();
  expect((await request).postDataJSON()).not.toHaveProperty("jobDescription");
  await page.waitForURL(/\/results\//, SERVER);
  await expect(
    page
      .locator("#job-match")
      .getByRole("heading", { name: "Match this resume against a job" }),
  ).toBeVisible(SERVER);
});

test("re-scans the same resume against another job from the report", async ({ page }) => {
  await page.goto("/scan");
  const resumeId = await uploadResume(page, "strong-bullets.pdf");
  const scanId = await completedScan(page, resumeId);
  await page.goto(`/results/${scanId}`);

  await page.getByRole("link", { name: "Scan against another job" }).click();
  await page.waitForURL(`**/scan?resume=${resumeId}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Scan against another job" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Selected file" })).toContainText(
    "strong-bullets.pdf",
  );
  await expect(
    page.getByRole("button", { name: "Use a different resume" }),
  ).toBeVisible();

  await jobPosting(page).fill(jobText("marketing-manager"));
  await page.getByRole("button", { name: "Analyze resume" }).click();
  await page.waitForURL(
    (url) => url.pathname.startsWith("/results/") && !url.pathname.endsWith(scanId),
    SERVER,
  );
  await expect(
    page.locator("#job-match").getByRole("heading", { name: "Match breakdown" }),
  ).toBeVisible(SERVER);
});

test("matches against a job straight from a report without one", async ({ page }) => {
  await page.goto("/scan");
  const scanId = await completedScan(page, await uploadResume(page, "two-column.pdf"));
  await page.goto(`/results/${scanId}`);

  const card = page.locator("#job-match");
  const start = card.getByRole("button", { name: "Match against this job" });
  await expect(start).toBeDisabled();
  await card
    .getByRole("textbox", { name: /Job posting/ })
    .fill(jobText("product-designer"));
  await expect(start).toBeEnabled();
  await start.click();

  await page.waitForURL((url) => !url.pathname.endsWith(scanId), SERVER);
  await expect(
    page.locator("#job-match").getByRole("heading", { name: "Match breakdown" }),
  ).toBeVisible(SERVER);
  await expect(page.getByText(/Matched against\s*Product Designer/)).toBeVisible();
});

test("explains when the resume to re-scan is gone", async ({ page }) => {
  await page.goto("/scan?resume=0123456789abcdef01234567");
  await expect(page.getByRole("note")).toHaveText(
    "That resume is no longer available, so please upload it again.",
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Scan your resume" }),
  ).toBeVisible();
});
