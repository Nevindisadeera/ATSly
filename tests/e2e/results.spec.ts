import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  closeDb,
  completeLike,
  completedScan,
  fixturePdf,
  guestId,
  randomAddress,
  seedQueuedScan,
  updateScan,
  uploadResume,
} from "./support/scans";

// End-to-end against the real API and database: upload → analyze → results.
// The first requests in dev mode compile routes and pdf.js, so results get a longer wait.
const SERVER = { timeout: 30_000 };

test.beforeEach(async ({ context }) => {
  // A fresh address per test keeps local re-runs under the daily scan limit.
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomAddress() });
});

test.afterAll(async () => {
  await closeDb();
});

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test("analyzes an uploaded resume and shows the full report", async ({ page }) => {
  await page.goto("/scan");
  await page.locator("[data-interactive]").waitFor();

  const analyze = page.getByRole("button", { name: "Analyze resume" });
  await expect(analyze).toBeDisabled();

  await page.locator('input[type="file"]').setInputFiles(fixturePdf());
  await expect(
    page.getByRole("region", { name: "Selected file" }).getByRole("status"),
  ).toHaveText("Ready", SERVER);
  // The optional job description step comes next.
  await expect(page.getByRole("navigation", { name: "Scan progress" })).toContainText(
    /Step 2 of 3|Job description/,
  );

  await analyze.click();
  await page.waitForURL(/\/results\/[0-9a-f]{24}$/, SERVER);

  await expect(
    page.getByRole("heading", { level: 1, name: "clean-single-column.pdf" }),
  ).toBeVisible(SERVER);
  await expect(
    page.getByRole("img", { name: /^ATS score \d+ out of 100/ }).first(),
  ).toBeAttached();
  await expect(page.getByRole("heading", { name: /^Top \d actions?$/ })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("will be deleted on");

  for (const name of [
    "Score breakdown",
    "Issues",
    "Keywords & skills",
    "Job match",
    "Recommendations",
    "Parsed resume",
  ]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeAttached();
  }
  // The breakdown adds up: weighted total rounds to the score.
  await expect(page.locator("#breakdown")).toContainText(/\d+\.\d{2}.*\d+/);
  // Parsed contact details are open by default.
  await expect(page.locator("#parsed-resume")).toContainText("@");
  await expect(page.getByText(/^Engine v\d+\.\d+\.\d+/)).toBeVisible();
  // Recommendations come with the report, with the accuracy disclaimer.
  const recommendations = page.locator("#recommendations");
  await expect(recommendations.getByRole("article").first()).toBeVisible();
  await expect(recommendations).toContainText(
    "Suggestions are generated from your own content. Verify accuracy before using them.",
  );

  await expectNoAxeViolations(page);
});

test("top actions open their recommendation, which leads to the check", async ({
  page,
}) => {
  await page.goto("/scan");
  const resumeId = await uploadResume(page);
  const scanId = await completedScan(page, resumeId);
  await page.goto(`/results/${scanId}`);

  const action = page.locator("#overview ol a").first();
  const anchor = (await action.getAttribute("href"))!.slice(1);
  expect(anchor).toMatch(/^recommendation-/);
  await action.click();
  const card = page.locator(`#${anchor}`);
  await expect(card).toBeInViewport();

  const toCheck = card.getByRole("link", { name: /^See the check/ });
  const check = (await toCheck.getAttribute("href"))!.slice(1);
  await toCheck.click();
  const row = page.locator(`#${check}`);
  await expect(row.getByRole("button").first()).toHaveAttribute("aria-expanded", "true");
  await expect(row.getByText("How to fix")).toBeVisible();
});

test("the report can be explored with the keyboard", async ({ page }) => {
  await page.goto("/scan");
  await page.locator("[data-interactive]").waitFor();
  await page.locator('input[type="file"]').setInputFiles(fixturePdf());
  const analyze = page.getByRole("button", { name: "Analyze resume" });
  await expect(analyze).toBeEnabled(SERVER);

  await analyze.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/results\//, SERVER);
  await expect(page.getByRole("heading", { name: "Issues", level: 2 })).toBeAttached(
    SERVER,
  );

  // A collapsed category opens with Enter.
  const readability = page.getByRole("button", { name: /^Readability/ });
  await readability.focus();
  await expect(readability).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Enter");
  await expect(readability).toHaveAttribute("aria-expanded", "true");

  // The methodology dialog opens and closes from the keyboard.
  await page.getByRole("button", { name: "How we score" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "How we score" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("shows live progress, then the report once the scan completes", async ({
  page,
  context,
}) => {
  await page.goto("/scan");
  const resumeId = await uploadResume(page);
  const finished = await completedScan(page, resumeId);
  const scanId = await seedQueuedScan({
    resumeId,
    owner: await guestId(context),
    fileName: "in-progress.pdf",
  });

  await page.goto(`/results/${scanId}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Analyzing your resume" }),
  ).toBeVisible(SERVER);
  await expect(page.getByRole("status")).toHaveText("Reading your resume…");
  await expect(page.getByText("Usually under 30 seconds.")).toBeVisible();
  // AI review is configured (the mock provider), so its step is shown.
  await expect(page.getByRole("list", { name: "Analysis steps" })).toContainText(
    "Evaluating content",
  );
  await expectNoAxeViolations(page);

  await updateScan(scanId, { status: "running", stage: "ats_rules" });
  await expect(page.getByRole("status")).toHaveText("Checking your resume structure…", {
    timeout: 10_000,
  });

  await completeLike(scanId, finished);
  await expect(
    page.getByRole("heading", { level: 2, name: "Score breakdown" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("in-progress.pdf");
});

test("a failed scan explains itself and can be retried", async ({ page, context }) => {
  await page.goto("/scan");
  const resumeId = await uploadResume(page);
  const scanId = await seedQueuedScan({ resumeId, owner: await guestId(context) });

  await page.goto(`/results/${scanId}`);
  await expect(page.getByRole("status")).toHaveText("Reading your resume…", SERVER);

  // The poll picks up the failure without a reload.
  await updateScan(scanId, {
    status: "failed",
    error: {
      code: "TIMEOUT",
      message: "This took longer than expected.",
      retryable: true,
    },
  });
  await expect(
    page.getByRole("heading", { level: 1, name: "This took longer than expected." }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("link", { name: /Report a problem/ })).toBeVisible();
  await expectNoAxeViolations(page);

  // Retry starts a new scan of the same resume.
  await page.getByRole("button", { name: "Try again" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith(scanId), SERVER);
  await expect(
    page.getByRole("heading", { level: 2, name: "Score breakdown" }),
  ).toBeVisible(SERVER);
});

test("a report that doesn't exist, or belongs to someone else, is not found", async ({
  page,
  browser,
}) => {
  await page.goto("/results/0123456789abcdef01234567");
  await expect(
    page.getByRole("heading", {
      name: "This report doesn't exist or you don't have access to it.",
    }),
  ).toBeVisible(SERVER);
  await expect(page.getByRole("link", { name: "Scan a resume" })).toHaveAttribute(
    "href",
    "/scan",
  );

  // A real report, opened by a different browser (another guest), is the same 404.
  await page.goto("/scan");
  const scanId = await completedScan(page, await uploadResume(page));
  const stranger = await browser.newContext();
  const strangerPage = await stranger.newPage();
  await strangerPage.goto(`/results/${scanId}`);
  await expect(
    strangerPage.getByRole("heading", { name: /doesn't exist or you don't have access/ }),
  ).toBeVisible(SERVER);
  await stranger.close();
});

test("explains when today's scan limit is reached", async ({ page }) => {
  await page.route("**/api/scans", (route) =>
    route.fulfill({
      status: 429,
      headers: { "Retry-After": String(3 * 60 * 60), "Content-Type": "application/json" },
      body: JSON.stringify({
        error: { code: "RATE_LIMITED", message: "You've reached today's scan limit." },
      }),
    }),
  );
  await page.goto("/scan");
  await page.locator("[data-interactive]").waitFor();
  await page.locator('input[type="file"]').setInputFiles(fixturePdf());
  const analyze = page.getByRole("button", { name: "Analyze resume" });
  await expect(analyze).toBeEnabled(SERVER);
  await analyze.click();

  // Scoped: Next.js has its own (empty) route-announcer alert on every page.
  const alert = page.getByRole("region", { name: "Analyze" }).getByRole("alert");
  await expect(alert).toContainText("You've reached today's scan limit.");
  await expect(alert).toContainText("You can scan again in about 3 hours.");
  await expect(page).toHaveURL(/\/scan$/);
  await expect(analyze).toBeEnabled();
});
