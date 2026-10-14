import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { analyzeDocument, ParseError } from "@/lib/parsing";
import { extractDocx } from "@/lib/parsing/extract/docx";
import { countTables, detectColumnSplit } from "@/lib/parsing/extract/pdf";
import { readZipDirectory, readZipText, ZipReadError } from "@/lib/parsing/extract/zip";

import { zip } from "../../support/documents";
import { buildDocx } from "../../support/docx-builder";

const AS_OF = new Date(Date.UTC(2026, 9, 1));

describe("DOCX extraction", () => {
  it("reads styles, bold, size, lists, soft breaks and page metadata", () => {
    const extraction = extractDocx(
      buildDocx({
        pages: 2,
        blocks: [
          { text: "Ada Lovelace", style: "Title" },
          { text: "ada@example.com\nLondon, United Kingdom" },
          { text: "Experience", style: "Heading1" },
          { text: "Wrote the first published algorithm.", bullet: true },
        ],
      }),
    );
    const byText = new Map(extraction.lines.map((l) => [l.text, l]));
    expect(byText.get("Ada Lovelace")).toMatchObject({
      headingLevel: 0,
      bold: true,
      fontSize: 20,
    });
    expect(byText.get("Experience")).toMatchObject({
      headingLevel: 1,
      bold: true,
      fontSize: 14,
    });
    expect(byText.get("Wrote the first published algorithm.")?.listItem).toBe(true);
    // The soft line break produced two lines.
    expect(byText.has("ada@example.com")).toBe(true);
    expect(byText.has("London, United Kingdom")).toBe(true);
    expect(extraction.pageCount).toBe(2);
    expect(extraction.pageCountSource).toBe("document");
  });

  it("reads text boxes once, not twice, and counts them", () => {
    const extraction = extractDocx(
      buildDocx({
        blocks: [{ textBox: [{ text: "Inside a box" }] }, { text: "Outside" }],
      }),
    );
    expect(extraction.lines.filter((l) => l.text === "Inside a box")).toHaveLength(1);
    expect(extraction.lines.find((l) => l.text === "Inside a box")?.inTextBox).toBe(true);
    expect(extraction.layout.textBoxes).toEqual({ count: 1 });
  });

  it("flags tables, header contact details, columns and decorative bullets", () => {
    const extraction = extractDocx(
      buildDocx({
        header: ["Ada Lovelace | ada@example.com | +44 20 7946 0000"],
        columns: 2,
        bulletGlyph: "➤",
        blocks: [
          {
            table: [
              ["Skill", "Years"],
              ["Python", "5"],
            ],
          },
          { text: "Item", bullet: true },
        ],
      }),
    );
    expect(extraction.layout.tables.count).toBe(1);
    expect(extraction.lines.find((l) => l.text === "Python")?.inTable).toBe(true);
    expect(extraction.layout.headerFooter.containsContact).toBe(true);
    expect(extraction.lines.some((l) => l.region === "header")).toBe(true);
    expect(extraction.layout.columns.detected).toBe(true);
    expect(extraction.layout.bulletGlyphs).toContain("➤");
  });

  it("records hyperlinks and whether their URL is hidden behind other text", () => {
    const extraction = extractDocx(
      buildDocx({
        blocks: [
          { text: "My profile", link: "https://www.linkedin.com/in/ada" },
          { text: "github.com/ada", link: "https://github.com/ada" },
        ],
      }),
    );
    expect(extraction.layout.links).toEqual([
      { text: "My profile", url: "https://www.linkedin.com/in/ada", hidden: true },
      { text: "github.com/ada", url: "https://github.com/ada", hidden: false },
    ]);
  });

  it("estimates pages when the file has no page metadata", () => {
    const words = Array.from({ length: 60 }, () => ({ text: "word ".repeat(20).trim() }));
    const extraction = extractDocx(buildDocx({ blocks: words }));
    expect(extraction.pageCountSource).toBe("estimate");
    expect(extraction.pageCount).toBe(3); // 1,200 words at ~500 per page
  });

  it("rejects archives without a document part", () => {
    expect(() =>
      extractDocx(zip([{ name: "[Content_Types].xml", content: "<x/>" }])),
    ).toThrow(ParseError);
  });
});

describe("ZIP reading limits", () => {
  it("stops decompression at the size cap", () => {
    const archive = zip([{ name: "big.xml", content: "a".repeat(100_000) }], {
      deflate: true,
    });
    const [entry] = readZipDirectory(archive)!;
    expect(readZipText(archive, entry!, 200_000)).toHaveLength(100_000);
    expect(() => readZipText(archive, entry!, 1_000)).toThrow(ZipReadError);
  });
});

describe("PDF layout heuristics", () => {
  const item = (x: number, width: number, top: number, text = "word word") => ({
    x,
    width,
    top,
    text,
  });

  it("finds the gutter of a two-column page", () => {
    const items = [
      ...Array.from({ length: 12 }, (_, i) => item(40, 140, 100 + i * 40)),
      ...Array.from({ length: 12 }, (_, i) => item(260, 300, 100 + i * 40)),
    ];
    const split = detectColumnSplit(items, 612, 792);
    expect(split).not.toBeNull();
    expect(split!).toBeGreaterThan(180);
    expect(split!).toBeLessThan(260);
  });

  it("does not see columns in a single-column page with right-aligned dates", () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      i % 4 === 0 ? item(40, 200, 100 + i * 20) : item(40, 520, 100 + i * 20),
    );
    expect(detectColumnSplit(items, 612, 792)).toBeNull();
  });

  it("counts three or more aligned multi-segment lines as a table", () => {
    const row = { page: 1, segmentStarts: [0.1, 0.4, 0.7] };
    expect(countTables([row, row, row])).toBe(1);
    expect(countTables([row, row])).toBe(0);
  });
});

describe("analyzeDocument limits", () => {
  it("rejects a DOCX whose page metadata is over the limit", async () => {
    const bytes = buildDocx({
      pages: 12,
      blocks: [{ text: "Plenty of words in this resume body text." }],
    });
    await expect(
      analyzeDocument(bytes, "docx", { maxPages: 10, asOf: AS_OF }),
    ).rejects.toMatchObject({
      code: "TOO_MANY_PAGES",
    });
  });

  it("times out instead of hanging", async () => {
    // PDF extraction is asynchronous, so a 1 ms budget expires before it finishes.
    const bytes = readFileSync(join(process.cwd(), "tests/fixtures/resumes/long-cv.pdf"));
    await expect(
      analyzeDocument(bytes, "pdf", { maxPages: 10, asOf: AS_OF, timeoutMs: 1 }),
    ).rejects.toMatchObject({ code: "PARSE_FAILED", reason: "timeout" });
  });
});
