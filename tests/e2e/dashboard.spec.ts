import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  closeDb,
  completedScan,
  randomAddress,
  seedUserScans,
  sessionUserId,
  uploadResume,
} from "./support/scans";

// The signed-in area: dashboard and settings, against the real API and database.
const SERVER = { timeout: 30_000 };

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomAddress() });
});

test.afterAll(async () => {
  await closeDb();
});

async function signUp(page: Page, name = "Grace Hopper") {
  await page.goto("/register?next=%2Fdashboard");
  await page.getByLabel("Name").fill(name);
  await page
    .getByLabel("Email")
    .fill(`e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard", SERVER);
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  await page.setViewportSize({ width: 320, height: 800 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

const recentRows = (page: Page) =>
  test.info().project.name.includes("mobile")
    ? page.locator("section[aria-labelledby='recent-title'] ul > li")
    : page.locator("section[aria-labelledby='recent-title'] tbody tr");

test("a new account starts empty, then shows its latest report", async ({ page }) => {
  await signUp(page);
  await expect(
    page.getByRole("heading", { level: 1, name: "Welcome back, Grace." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "No scans yet." })).toBeVisible();
  await expectNoAxeViolations(page);

  const scanId = await completedScan(page, await uploadResume(page));
  await page.reload();
  const latest = page.getByRole("region", { name: "Latest analysis" });
  await expect(latest).toContainText("clean-single-column.pdf", SERVER);
  await expect(
    latest.getByRole("img", { name: /^ATS score \d+ out of 100/ }),
  ).toBeVisible();
  await expect(latest).toContainText("Top action:");
  // One scan: no stats row yet.
  await expect(page.getByText("Best ATS score")).toHaveCount(0);

  await latest.getByRole("link", { name: "View report" }).click();
  await page.waitForURL(`**/results/${scanId}`, SERVER);
  await expect(
    page.getByRole("heading", { level: 2, name: "Score breakdown" }),
  ).toBeVisible(SERVER);
});

test("stats, the score trend and paging through scans", async ({ page }) => {
  await signUp(page);
  await seedUserScans(await sessionUserId(page), 35, { matchEvery: 3 });
  await page.reload();

  await expect(page.getByText("Best ATS score")).toBeVisible(SERVER);
  const chart = page.getByRole("group", { name: /^ATS score over your last 12 scans/ });
  await expect(chart).toBeVisible();

  // The chart reads out the focused point; arrow keys move it.
  await chart.focus();
  const readout = chart.getByRole("status");
  await expect(readout).toHaveText(/: 90$/);
  await page.keyboard.press("Home");
  await expect(readout).toHaveText(/: 79$/);
  // Every value is also in a table.
  await page.getByText("Show as table").click();
  await expect(
    page.getByRole("table", { name: "ATS score by scan date" }).locator("tbody tr"),
  ).toHaveCount(12);

  const rows = recentRows(page);
  // Ten on the dashboard, then pages of twenty.
  await expect(rows).toHaveCount(10);
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(rows).toHaveCount(30);
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(rows).toHaveCount(35);
  await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0);

  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
});

test("deletes a report from the list after confirming", async ({ page }) => {
  await signUp(page);
  await seedUserScans(await sessionUserId(page), 3);
  await page.reload();
  await expect(recentRows(page)).toHaveCount(3, SERVER);

  await page
    .getByRole("button", { name: "Delete report for seeded-3.pdf" })
    .filter({ visible: true })
    .click();
  const dialog = page.getByRole("alertdialog", { name: "Delete this report?" });
  await expect(dialog).toContainText("seeded-3.pdf");
  await dialog.getByRole("button", { name: "Delete report" }).click();
  await expect(dialog).toBeHidden();
  await expect(recentRows(page)).toHaveCount(2, SERVER);
  await expect(recentRows(page).filter({ hasText: "seeded-3.pdf" })).toHaveCount(0);
});

test("settings: delete all scans, then the account", async ({ page }) => {
  await signUp(page, "Ada Lovelace");
  await seedUserScans(await sessionUserId(page), 3);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await expect(page.getByText("Email and password")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Delete all scans" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete all scans?" });
  const confirm = dialog.getByRole("button", { name: "Delete all scans" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
  await confirm.click();
  await expect(page.getByRole("status").filter({ hasText: "Deleted" })).toHaveText(
    "Deleted 3 reports and 0 resumes.",
    SERVER,
  );
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "No scans yet." })).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete account" }).click();
  const account = page.getByRole("alertdialog", { name: "Delete your account?" });
  await account.getByLabel("Type DELETE to confirm").fill("DELETE");
  await account.getByLabel("Type DELETE to confirm").press("Enter");
  await page.waitForURL((url) => url.pathname === "/", SERVER);

  // Signed out for good.
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/login?next=%2Fdashboard");
  await expectNoHorizontalScroll(page);
});
