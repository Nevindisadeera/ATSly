import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  closeDb,
  completedScan,
  randomAddress,
  updateScan,
  uploadResume,
} from "./support/scans";

// Recommendations on the results page. A real scan provides the report; its recommendations
// and AI status are then set directly, so each state is tested exactly.
const SERVER = { timeout: 30_000 };

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomAddress() });
});

test.afterAll(async () => {
  await closeDb();
});

/** A completed scan of the clean fixture, its first fixable issue and its first bullet. */
async function scannedReport(page: Page) {
  await page.goto("/scan");
  const resumeId = await uploadResume(page);
  const scanId = await completedScan(page, resumeId);
  const scan = (await (await page.request.get(`/api/scans/${scanId}`)).json()).data;
  const resume = (await (await page.request.get(`/api/resumes/${resumeId}`)).json()).data;
  return {
    scanId,
    // The first top action comes from this issue.
    firstIssue: scan.ats.issues.find((issue: { fix?: string }) => issue.fix).id as string,
    bullet: resume.parsed.experience[0].bullets[0] as string,
  };
}

function recommendations(checkId: string, bullet: string) {
  return [
    {
      id: "rules-1",
      source: "rules",
      checkId,
      priority: "high",
      category: "formatting",
      title: "Fix the largest issue first",
      detail: "This check removed the most points from your score.",
      before: null,
      after: null,
      target: null,
    },
    {
      id: "ai-2",
      source: "ai",
      priority: "medium",
      category: "content",
      title: "Show the result of this work",
      detail: "Start with a strong verb and add the outcome.",
      before: bullet,
      after: `${bullet.replace(/\.$/, "")}, improving [metric] by [X %].`,
      target: { section: "experience", entryIndex: 0, bulletIndex: 0 },
    },
    {
      id: "ai-3",
      source: "ai",
      priority: "low",
      category: "completeness",
      title: "Add a short summary",
      detail: "Two or three sentences on your focus help recruiters place you quickly.",
      before: null,
      after: null,
      target: { section: "summary", entryIndex: null, bulletIndex: null },
    },
  ];
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test("filters by priority, copies a rewrite and links back to the check", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const { scanId, firstIssue, bullet } = await scannedReport(page);
  const recs = recommendations(firstIssue, bullet);
  await updateScan(scanId, {
    ai: { status: "complete", contentQuality: 70, recommendations: recs },
  });
  await page.goto(`/results/${scanId}`);

  const section = page.locator("#recommendations");
  const cards = section.getByRole("article");
  await expect(cards).toHaveCount(3, SERVER);
  await expect(section).toContainText(
    "3 specific changes to make, most important first.",
  );

  // Filters show one priority at a time and say what they show.
  const filters = section.getByRole("group", { name: "Filter by priority" });
  await expect(filters.getByRole("button", { name: /^All/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await filters.getByRole("button", { name: /^High/ }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("High priority");
  await expect(section.getByRole("status").filter({ hasText: "Showing" })).toHaveText(
    "Showing 1 high-priority recommendation.",
  );
  await filters.getByRole("button", { name: /^All/ }).click();
  await expect(cards).toHaveCount(3);

  // The rewrite shows the user's own bullet, where it is, and copies cleanly.
  const rewrite = section.locator("#recommendation-ai-2");
  await expect(rewrite).toContainText(bullet);
  await expect(rewrite).toContainText(/Experience › .+ › bullet 1/);
  await expect(rewrite).toContainText(
    "Replace [metric] and [X %] with your real details. Suggestions never invent numbers.",
  );
  await rewrite.getByRole("button", { name: "Copy suggested text" }).click();
  await expect(rewrite.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(recs[1]!.after);

  // A top action whose card is filtered out clears the filter and scrolls to it.
  await filters.getByRole("button", { name: /^Low/ }).click();
  await expect(cards).toHaveCount(1);
  await page.locator('#overview ol a[href="#recommendation-rules-1"]').click();
  await expect(cards).toHaveCount(3);
  await expect(section.locator("#recommendation-rules-1")).toBeInViewport();

  // Rules recommendations lead to the check they come from.
  await section
    .locator("#recommendation-rules-1")
    .getByRole("link", { name: /^See the check/ })
    .click();
  await expect(
    page.locator(`#check-${firstIssue}`).getByRole("button").first(),
  ).toHaveAttribute("aria-expanded", "true");

  await expectNoAxeViolations(page);
});

test("filters and copy work from the keyboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const { scanId, firstIssue, bullet } = await scannedReport(page);
  await updateScan(scanId, {
    ai: {
      status: "complete",
      contentQuality: 70,
      recommendations: recommendations(firstIssue, bullet),
    },
  });
  await page.goto(`/results/${scanId}`);

  const section = page.locator("#recommendations");
  const medium = section.getByRole("button", { name: /^Medium/ });
  await medium.focus();
  await page.keyboard.press("Enter");
  await expect(medium).toHaveAttribute("aria-pressed", "true");
  await expect(section.getByRole("article")).toHaveCount(1);

  const copy = section.getByRole("button", { name: "Copy suggested text" });
  await copy.focus();
  await page.keyboard.press("Enter");
  await expect(section.getByRole("button", { name: "Copied" })).toBeFocused();
});

test("explains AI review that didn't finish, and retries it", async ({ page }) => {
  const { scanId, firstIssue, bullet } = await scannedReport(page);
  await updateScan(scanId, {
    ai: {
      status: "partial",
      recommendations: recommendations(firstIssue, bullet).slice(0, 1),
    },
  });
  await page.goto(`/results/${scanId}`);

  const section = page.locator("#recommendations");
  await expect(
    section.getByRole("heading", {
      name: "Some recommendations are temporarily unavailable.",
    }),
  ).toBeVisible(SERVER);
  await expect(section).toContainText("Your scores aren't affected.");
  await expect(section.getByRole("article")).toHaveCount(1);
  await expectNoAxeViolations(page);

  // Retry runs the analysis again on the same resume.
  await section.getByRole("button", { name: "Try again" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith(scanId), SERVER);
  await expect(
    page.getByRole("heading", { level: 2, name: "Recommendations" }),
  ).toBeVisible(SERVER);
});

test("explains a paused AI review and reports from before recommendations", async ({
  page,
}) => {
  const { scanId, firstIssue, bullet } = await scannedReport(page);
  await updateScan(scanId, {
    ai: {
      status: "skipped",
      skippedReason: "budget",
      recommendations: recommendations(firstIssue, bullet).slice(0, 1),
    },
  });
  await page.goto(`/results/${scanId}`);
  const section = page.locator("#recommendations");
  await expect(
    section.getByRole("heading", { name: "Suggested rewrites are paused for today." }),
  ).toBeVisible(SERVER);
  await expect(section.getByRole("button", { name: "Try again" })).toHaveCount(0);

  // A report saved before recommendations existed.
  await updateScan(scanId, { ai: { status: "skipped" } });
  await page.reload();
  await expect(
    section.getByRole("heading", {
      name: "No recommendations were saved with this report",
    }),
  ).toBeVisible(SERVER);
  await expect(section.getByRole("button", { name: "Try again" })).toBeVisible();
  // Top actions fall back to the checks.
  await expect(page.locator('#overview ol a[href^="#check-"]').first()).toBeVisible();
  await expectNoAxeViolations(page);
});

test("recommendations fit a 320px screen", async ({ page }) => {
  const { scanId, firstIssue, bullet } = await scannedReport(page);
  await updateScan(scanId, {
    ai: {
      status: "partial",
      recommendations: recommendations(firstIssue, bullet),
    },
  });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`/results/${scanId}`);
  await expect(page.locator("#recommendation-ai-2")).toBeAttached(SERVER);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
