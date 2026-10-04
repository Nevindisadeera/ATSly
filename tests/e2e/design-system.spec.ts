import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// /design exists only under `next dev`; production builds return 404.
test.beforeEach(async ({ page }) => {
  const response = await page.goto("/design");
  test.skip(response?.status() === 404, "The design page is development-only.");
});

test("has no detectable accessibility violations, including contrast", async ({
  page,
}) => {
  // Wait for one-shot ring and bar animations so contrast is measured on final colors.
  await page.waitForTimeout(1000);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("score ring exposes its value to assistive technology", async ({ page }) => {
  await expect(
    page.getByRole("img", { name: "ATS score 82 out of 100, Good" }),
  ).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Formatting" })).toHaveAttribute(
    "aria-valuenow",
    "87",
  );
});

test("primary button shows a visible focus ring from the keyboard", async ({ page }) => {
  const button = page.getByRole("button", { name: "Scan my resume" });
  await button.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(button).toBeFocused();
  const boxShadow = await button.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(boxShadow).not.toBe("none");
});

test("dialog traps focus and closes with Escape", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "How we score", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "How we score" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(dialog.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("menu opens from the keyboard and supports arrow keys", async ({ page }) => {
  // Radix hides the rest of the page from the accessibility tree while the menu is open,
  // so the trigger is located by its label rather than by role.
  const trigger = page.locator('[aria-label="Report actions"]');
  await trigger.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.locator(":focus")).toHaveCount(0); // focus is on the menu itself
  await expect(menu).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitem", { name: "Scan against another job" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "New scan" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("keyword chip tooltip appears on keyboard focus", async ({ page }) => {
  await page.getByRole("button", { name: /TypeScript/ }).focus();
  await expect(page.getByRole("tooltip")).toContainText("Exact match");
});
