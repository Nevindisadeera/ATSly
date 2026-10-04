import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = [
  { path: "/", heading: /Make your resume ATS/ },
  { path: "/methodology", heading: "How ATSly scores your resume" },
  { path: "/privacy", heading: "Privacy" },
  { path: "/terms", heading: "Terms of use" },
];

for (const { path, heading } of PAGES) {
  test.describe(path, () => {
    test("renders with one h1 and no accessibility violations", async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.locator("h1")).toHaveCount(1);
      await page.waitForTimeout(1000); // let one-shot score animations finish
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });

    test("has no horizontal scroll at 320px", async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}

test("skip link moves focus to main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
});

test("header gains a surface after scrolling", async ({ page }) => {
  await page.goto("/");
  const header = page.locator("header").first();
  await expect(header).not.toHaveAttribute("data-scrolled");
  await page.mouse.wheel(0, 600);
  await expect(header).toHaveAttribute("data-scrolled");
});

test("'See how it works' jumps to the steps", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "See how it works" }).click();
  await expect(page).toHaveURL(/#how-it-works$/);
  await expect(
    page.getByRole("heading", { name: "Three steps. About a minute." }),
  ).toBeInViewport();
});

test("primary calls to action point to the scan page", async ({ page }) => {
  await page.goto("/");
  const ctas = page.getByRole("link", { name: "Scan my resume" });
  await expect(ctas).toHaveCount(3); // header, hero, closing band
  for (const href of await ctas.evaluateAll((els) =>
    els.map((e) => e.getAttribute("href")),
  )) {
    expect(href).toBe("/scan");
  }
});

test("robots and sitemap are served", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toContain("Disallow: /results/");
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).toContain("/methodology");
});

test("Open Graph image renders as a PNG", async ({ page, request }) => {
  await page.goto("/");
  const ogUrl = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(ogUrl).toBeTruthy();
  const image = await request.get(new URL(ogUrl!).pathname + new URL(ogUrl!).search);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
});
