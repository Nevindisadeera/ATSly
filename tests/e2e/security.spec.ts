import { expect, test } from "@playwright/test";

import { closeDb, completedScan, randomAddress, uploadResume } from "./support/scans";

// Security headers and the Content Security Policy, which only production builds send
// (the dev server needs eval for hot reloading). CI runs E2E against a production build.
const SERVER = { timeout: 30_000 };

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomAddress() });
});

test.afterAll(async () => {
  await closeDb();
});

test("pages send security headers and run under their CSP without violations", async ({
  page,
}) => {
  const first = await page.request.get("/");
  test.skip(
    !first.headers()["content-security-policy"],
    "Security headers are sent by production builds only.",
  );

  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to (execute|load|apply)/i.test(message.text())) {
      violations.push(message.text());
    }
  });

  // A static page: the base policy.
  const landing = await page.goto("/");
  const headers = landing!.headers();
  expect(headers).toMatchObject({
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
  });
  expect(headers["x-powered-by"]).toBeUndefined();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");

  // Dynamic pages: a fresh nonce on every request, and the app still works under it.
  const scan = await page.goto("/scan");
  const policy = scan!.headers()["content-security-policy"]!;
  expect(policy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  const again = (await page.request.get("/scan")).headers()["content-security-policy"];
  expect(again).not.toBe(policy);

  const scanId = await completedScan(page, await uploadResume(page));
  await page.goto(`/results/${scanId}`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Score breakdown" }),
  ).toBeVisible(SERVER);
  // Client components hydrated: an interactive control responds.
  const filter = page.getByRole("button", { name: /^All/ });
  if (await filter.count()) await expect(filter).toHaveAttribute("aria-pressed", "true");

  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible();

  expect(violations).toEqual([]);
});
