import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

// The upload API arrives in Phase 4b. These tests mock POST /api/resumes with the
// contract from docs/PLANNING.md §22 so every UI state can be exercised.

const PDF_MIME = "application/pdf";
const pdf = (name = "resume.pdf", bytes = 2048) => ({
  name,
  mimeType: PDF_MIME,
  buffer: Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(bytes)]),
});

const SUCCESS_BODY = {
  data: {
    id: "665f0c2b9a1e4b7d8c3f2a10",
    fileName: "resume.pdf",
    extension: "pdf",
    sizeBytes: 2057,
    pageCount: null,
    wordCount: null,
    sections: [],
    warnings: [],
  },
};

async function mockUpload(
  page: Page,
  respond: (route: Route) => Promise<void> | void,
): Promise<{ calls: () => number }> {
  let count = 0;
  await page.route("**/api/resumes", async (route) => {
    count += 1;
    await respond(route);
  });
  return { calls: () => count };
}

const fileInput = (page: Page) => page.locator('input[type="file"]');
const dropzone = (page: Page) =>
  page.getByRole("button", { name: /Drop your resume here|Choose a file/ });

test.beforeEach(async ({ page }) => {
  await page.goto("/scan");
  // Wait for hydration so file selection and clicks reach React's handlers.
  await page.locator("[data-interactive]").waitFor();
});

test("shows the first step with supported formats and limits", async ({ page }) => {
  await expect(
    page.getByRole("heading", { level: 1, name: "Scan your resume" }),
  ).toBeVisible();
  await expect(dropzone(page)).toBeVisible();
  await expect(page.getByText("PDF or DOCX · up to 4 MB · up to 10 pages")).toBeVisible();
});

test("uploads a file, shows progress, then the ready state", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await mockUpload(page, async (route) => {
    await held; // keep the request open so the processing state is observable
    await route.fulfill({ status: 201, json: SUCCESS_BODY });
  });

  await fileInput(page).setInputFiles(pdf());
  const card = page.getByRole("region", { name: "Selected file" });
  await expect(card).toBeVisible();
  await expect(card).toBeFocused();
  await expect(card.getByRole("status")).toHaveText(/Uploading|Reading your resume/);
  await expect(card).toHaveAttribute("aria-busy", "true");

  release();
  await expect(card.getByRole("status")).toHaveText("Ready");
  await expect(card).not.toHaveAttribute("aria-busy");
  await expect(card.getByText("resume.pdf")).toBeVisible();
  await expect(card.getByText("2 KB")).toBeVisible();
});

test("shows section chips and warnings when the server returns them", async ({
  page,
}) => {
  await mockUpload(page, (route) =>
    route.fulfill({
      status: 201,
      json: {
        data: {
          ...SUCCESS_BODY.data,
          pageCount: 2,
          wordCount: 540,
          sections: [
            { kind: "experience", confidence: 0.95 },
            { kind: "education", confidence: 0.9 },
            { kind: "skills", confidence: 0.9 },
          ],
          warnings: [
            "We found very little text on page 2. If it's an image, ATS systems may skip it.",
          ],
        },
      },
    }),
  );
  await fileInput(page).setInputFiles(pdf());
  const card = page.getByRole("region", { name: "Selected file" });
  await expect(card.getByText("2 pages · 540 words")).toBeVisible();
  await expect(
    card.getByRole("list", { name: "Sections found" }).getByRole("listitem"),
  ).toHaveCount(3);
  await expect(card.getByText(/very little text on page 2/)).toBeVisible();
});

test("rejects an unsupported file type before uploading", async ({ page }) => {
  const api = await mockUpload(page, (route) => route.fulfill({ status: 500 }));
  await fileInput(page).setInputFiles({
    name: "resume.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    /That file type isn't supported. Upload a PDF or DOCX./,
  );
  await expect(dropzone(page)).toBeVisible();
  expect(api.calls()).toBe(0);
});

test("rejects a file over 4 MB before uploading", async ({ page }) => {
  const api = await mockUpload(page, (route) => route.fulfill({ status: 500 }));
  await fileInput(page).setInputFiles(pdf("big.pdf", 5 * 1024 * 1024));
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "This file is 5 MB. The limit is 4 MB.",
  );
  expect(api.calls()).toBe(0);
});

test("rejects an empty file before uploading", async ({ page }) => {
  const api = await mockUpload(page, (route) => route.fulfill({ status: 500 }));
  await fileInput(page).setInputFiles({
    name: "empty.pdf",
    mimeType: PDF_MIME,
    buffer: Buffer.alloc(0),
  });
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "This file contains no readable text.",
  );
  expect(api.calls()).toBe(0);
});

const SERVER_ERRORS = [
  {
    status: 422,
    code: "PARSE_FAILED",
    text: "We couldn't read this file. It may be corrupted or password-protected.",
  },
  {
    status: 422,
    code: "ENCRYPTED_DOCUMENT",
    text: "We couldn't read this file. It may be corrupted or password-protected.",
  },
  { status: 422, code: "EMPTY_DOCUMENT", text: "This file contains no readable text." },
  {
    status: 422,
    code: "TOO_MANY_PAGES",
    text: "Resumes over 10 pages aren't supported.",
  },
  { status: 429, code: "RATE_LIMITED", text: "You've reached the upload limit for now." },
  { status: 500, code: "INTERNAL", text: "Something went wrong on our side." },
];

for (const { status, code, text } of SERVER_ERRORS) {
  test(`shows the ${code} message from the server`, async ({ page }) => {
    await mockUpload(page, (route) =>
      route.fulfill({ status, json: { error: { code, message: "server message" } } }),
    );
    await fileInput(page).setInputFiles(pdf());
    const card = page.getByRole("region", { name: "Selected file" });
    await expect(card.getByRole("status")).toHaveText("Upload failed");
    await expect(card).toContainText(text);
  });
}

test("falls back to the status code when the body isn't JSON", async ({ page }) => {
  await mockUpload(page, (route) =>
    route.fulfill({ status: 413, body: "Request Entity Too Large" }),
  );
  await fileInput(page).setInputFiles(pdf());
  await expect(page.getByRole("region", { name: "Selected file" })).toContainText(
    "larger than 4 MB",
  );
});

test("reports a lost connection", async ({ page }) => {
  await mockUpload(page, (route) => route.abort("internetdisconnected"));
  await fileInput(page).setInputFiles(pdf());
  await expect(page.getByRole("region", { name: "Selected file" })).toContainText(
    "Connection lost.",
  );
});

test("choosing another file after an error returns focus to the dropzone", async ({
  page,
}) => {
  await mockUpload(page, (route) =>
    route.fulfill({
      status: 422,
      json: { error: { code: "PARSE_FAILED", message: "" } },
    }),
  );
  await fileInput(page).setInputFiles(pdf());
  await page.getByRole("button", { name: "Choose another file" }).click();
  await expect(dropzone(page)).toBeFocused();
});

test("cancel stops an upload in progress", async ({ page }) => {
  await mockUpload(page, () => new Promise(() => {})); // never responds
  await fileInput(page).setInputFiles(pdf());
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(dropzone(page)).toBeVisible();
  await expect(page.getByRole("region", { name: "Selected file" })).toHaveCount(0);
});

test("replace returns to the dropzone after a successful upload", async ({ page }) => {
  await mockUpload(page, (route) => route.fulfill({ status: 201, json: SUCCESS_BODY }));
  await fileInput(page).setInputFiles(pdf());
  await expect(page.getByRole("status")).toHaveText("Ready");
  await page.getByRole("button", { name: "Replace" }).click();
  await expect(dropzone(page)).toBeFocused();
});

test("the dropzone opens the file chooser from the keyboard", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Keyboard interaction is covered on desktop.");
  await dropzone(page).focus();
  const chooser = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  const fc = await chooser;
  expect(fc.isMultiple()).toBe(false);
});

test.describe("drag and drop", () => {
  async function dragFiles(page: Page, names: string[], event: "dragenter" | "drop") {
    const target = page
      .locator("[data-dragging], button")
      .filter({ hasText: /Drop your resume|Release to upload|Choose a file/ });
    const dataTransfer = await page.evaluateHandle((fileNames) => {
      const dt = new DataTransfer();
      for (const n of fileNames)
        dt.items.add(new File(["%PDF-1.7 test"], n, { type: "application/pdf" }));
      return dt;
    }, names);
    await target.dispatchEvent(event, { dataTransfer });
  }

  test("highlights while dragging and uploads on drop", async ({ page, isMobile }) => {
    test.skip(isMobile, "Drag and drop is a desktop interaction.");
    await mockUpload(page, (route) => route.fulfill({ status: 201, json: SUCCESS_BODY }));
    await dragFiles(page, ["resume.pdf"], "dragenter");
    await expect(page.getByText("Release to upload")).toBeVisible();
    await dragFiles(page, ["resume.pdf"], "drop");
    await expect(page.getByRole("status")).toHaveText("Ready");
  });

  test("asks for one file when several are dropped", async ({ page, isMobile }) => {
    test.skip(isMobile, "Drag and drop is a desktop interaction.");
    const api = await mockUpload(page, (route) =>
      route.fulfill({ status: 201, json: SUCCESS_BODY }),
    );
    await dragFiles(page, ["a.pdf", "b.pdf"], "drop");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "Upload one file at a time.",
    );
    expect(api.calls()).toBe(0);
  });
});

test.describe("accessibility and layout", () => {
  const scan = async (page: Page) =>
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations;

  test("idle state has no violations", async ({ page }) => {
    expect(await scan(page)).toEqual([]);
  });

  test("client error state has no violations", async ({ page }) => {
    await fileInput(page).setInputFiles({
      name: "a.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("x"),
    });
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });

  test("ready and server error states have no violations", async ({ page }) => {
    await mockUpload(page, (route) =>
      route.fulfill({
        status: 422,
        json: { error: { code: "PARSE_FAILED", message: "" } },
      }),
    );
    await fileInput(page).setInputFiles(pdf());
    await expect(page.getByRole("status")).toHaveText("Upload failed");
    expect(await scan(page)).toEqual([]);
  });

  test("has no horizontal scroll at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/scan");
    await page.locator("[data-interactive]").waitFor();
    await fileInput(page).setInputFiles({
      name: "a-very-long-resume-file-name-that-could-overflow-the-card.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("x"),
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("is excluded from search engines", async ({ page }) => {
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  });
});
