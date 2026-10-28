import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { closeDb, completedScan, randomAddress, uploadResume } from "./support/scans";

// Accounts end to end: sign-up keeps the guest's report, sign-out and sign-in, errors.
const SERVER = { timeout: 30_000 };
const PASSWORD = "correct horse battery";

test.beforeEach(async ({ context }) => {
  // Sign-up is limited per network; a fresh address keeps re-runs independent.
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomAddress() });
});

test.afterAll(async () => {
  await closeDb();
});

const uniqueEmail = () =>
  `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

async function register(page: Page, email: string, name = "Grace Hopper") {
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test("signing up keeps the guest's report; signing out and in again", async ({
  page,
}) => {
  await page.goto("/scan");
  const scanId = await completedScan(page, await uploadResume(page));
  await page.goto(`/results/${scanId}`);

  // The guest banner offers an account that keeps this report.
  await page
    .getByRole("note")
    .getByRole("link", { name: "Create a free account" })
    .click();
  await expect(page).toHaveURL(
    `/register?next=${encodeURIComponent(`/results/${scanId}`)}`,
  );
  await expect(
    page.getByText(
      "Your recent reports from this browser will be saved to your account.",
    ),
  ).toBeVisible();

  const email = uniqueEmail();
  await register(page, email);
  await page.waitForURL(`**/results/${scanId}`, SERVER);
  // The report now belongs to the account: no deletion notice, an account menu instead.
  await expect(
    page.getByRole("heading", { level: 2, name: "Score breakdown" }),
  ).toBeVisible(SERVER);
  await expect(page.getByText(/will be deleted on/)).toHaveCount(0);

  const menu = page.getByRole("button", { name: "Account menu for Grace Hopper" });
  await menu.click();
  await expect(page.getByRole("menuitem", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("menu")).toContainText(email);
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await page.waitForURL((url) => url.pathname === "/", SERVER);

  // Signed out, the report isn't reachable; signing in brings it back.
  await page.goto(`/results/${scanId}`);
  await expect(page.getByRole("heading", { name: /doesn't exist/ })).toBeVisible(SERVER);
  await page.goto(`/login?next=${encodeURIComponent(`/results/${scanId}`)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Password", { exact: true }).press("Enter");
  await page.waitForURL(`**/results/${scanId}`, SERVER);
  await expect(
    page.getByRole("heading", { level: 2, name: "Score breakdown" }),
  ).toBeVisible(SERVER);
});

test("explains sign-in and sign-up problems next to the right field", async ({
  page,
}) => {
  const email = uniqueEmail();
  await page.goto("/register");
  await page.locator("form[aria-label='Create account']").waitFor();

  // Checked in the browser before anything is sent.
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  const summary = page.locator("form").getByRole("alert");
  await expect(summary).toHaveText("Use at least 8 characters.");
  const password = page.getByLabel("Password", { exact: true });
  await expect(password).toHaveAttribute("aria-invalid", "true");
  await expect(password).toBeFocused();

  // An email that already has an account.
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard", SERVER);
  await page.context().clearCookies();
  await page.goto("/register");
  await register(page, email, "Someone Else");
  await expect(summary).toContainText(
    "An account with this email already exists.",
    SERVER,
  );
  await expect(summary.getByRole("link", { name: "Log in instead" })).toBeVisible();

  // A wrong password.
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("not the password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(summary).toHaveText("Email or password is incorrect.", SERVER);
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
});

test("account pages ask to sign in, then return", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL("/login?next=%2Fsettings");

  await page.goto("/login?next=%2Fscan");
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL("/register?next=%2Fscan");
  await register(page, uniqueEmail());
  await page.waitForURL("**/scan", SERVER);

  // Signed in, the sign-in pages send you on.
  await page.goto("/login?next=%2Fscan");
  await expect(page).toHaveURL(/\/scan$/);
});

for (const path of ["/login", "/register"]) {
  test(`${path} is accessible and fits a 320px screen`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible(SERVER);
    await expectNoAxeViolations(page);
    await page.setViewportSize({ width: 320, height: 720 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("signs in with the keyboard alone", async ({ page }) => {
  const email = uniqueEmail();
  const created = await page.request.post("/api/auth/register", {
    data: { name: "Kay Board", email, password: PASSWORD },
  });
  expect(created.status()).toBe(201);

  await page.goto("/login?next=%2Fsettings");
  await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible(
    SERVER,
  );
  const emailField = page.getByLabel("Email");
  // Skip link, logo, then the first field.
  for (let i = 0; i < 6; i++) {
    if (await emailField.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(emailField).toBeFocused();
  await page.keyboard.type(email);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page.keyboard.type(PASSWORD);
  await page.keyboard.press("Enter");
  await page.waitForURL("**/settings", SERVER);
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
});
