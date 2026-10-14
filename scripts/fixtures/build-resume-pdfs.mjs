// Renders the HTML resumes in tests/fixtures/resumes/src to PDF with Chromium (Playwright).
// Chromium's PDF output is representative of real resume exports from browsers and many
// online builders. Usage: node scripts/fixtures/build-resume-pdfs.mjs
import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "../../tests/fixtures/resumes/src");
const outDir = join(here, "../../tests/fixtures/resumes");

const LETTER = {
  format: "Letter",
  margin: { top: "0.6in", bottom: "0.6in", left: "0.7in", right: "0.7in" },
};

/** Per-fixture tweaks. */
const OPTIONS = {
  "long-cv": {
    // Larger type stretches the CV over several pages; contact details live in the page header.
    css: "body { font-size: 13pt; line-height: 1.7 } li { margin: 6pt 0 }",
    pdf: {
      displayHeaderFooter: true,
      headerTemplate:
        '<div style="font-family:Arial;font-size:9px;width:100%;padding:0 0.7in;color:#333">Dr. Amelia Chen · amelia.chen@example.ac.uk · +44 131 496 0215</div>',
      footerTemplate:
        '<div style="font-family:Arial;font-size:9px;width:100%;text-align:center;color:#333">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
      margin: { top: "0.9in", bottom: "0.8in", left: "0.7in", right: "0.7in" },
    },
  },
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });

for (const file of readdirSync(srcDir).filter((f) => f.endsWith(".html"))) {
  const name = file.replace(/\.html$/, "");
  const options = OPTIONS[name] ?? {};
  await page.goto(pathToFileURL(join(srcDir, file)).href);
  if (options.css) await page.addStyleTag({ content: options.css });
  const pdf = await page.pdf({ ...LETTER, ...options.pdf });
  writeFileSync(join(outDir, `${name}.pdf`), pdf);
  console.log(`${name}.pdf  ${(pdf.length / 1024).toFixed(0)} KB`);
}

// A scanned resume: the clean resume as a picture, with no text layer.
await page.goto(pathToFileURL(join(srcDir, "clean-single-column.html")).href);
const image = await page.screenshot({ fullPage: true, type: "png" });
await page.setContent(
  `<html><body style="margin:0"><img style="width:100%" src="data:image/png;base64,${image.toString("base64")}"></body></html>`,
);
const scanned = await page.pdf({
  format: "Letter",
  margin: { top: "0", bottom: "0", left: "0", right: "0" },
});
writeFileSync(join(outDir, "scanned.pdf"), scanned);
console.log(`scanned.pdf  ${(scanned.length / 1024).toFixed(0)} KB`);

await browser.close();
