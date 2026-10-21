import { getDocumentProxy, getResolvedPDFJS } from "unpdf";

import {
  containsContactDetails,
  isPrivateUse,
  leadingBullet,
  normalizeText,
} from "../text";
import { ParseError, type Extraction, type LayoutProbe, type Line } from "../types";

/**
 * PDF extraction with pdf.js — docs/PLANNING.md §17.3.
 * Produces lines in reading order plus layout signals for the ATS checks.
 */

type Item = {
  text: string;
  /** Left edge and width in points. */
  x: number;
  width: number;
  /** Baseline measured from the top of the page, in points. */
  top: number;
  fontSize: number;
  bold: boolean;
};

type PageLine = Line & { segmentStarts: number[] };

type Matrix = [number, number, number, number, number, number];

const BOLD_FONT = /bold|black|heavy|semibold|demibold|extrabold/i;

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function isMatrix(value: unknown): value is Matrix {
  return (
    Array.isArray(value) &&
    value.length === 6 &&
    value.every((v) => typeof v === "number")
  );
}

export async function extractPdf(
  bytes: Buffer,
  options: { maxPages: number },
): Promise<Extraction> {
  const pdfjs = await getResolvedPDFJS();
  let doc: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    doc = await getDocumentProxy(new Uint8Array(bytes), {
      verbosity: 0,
    });
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name === "PasswordException")
      throw new ParseError("ENCRYPTED_DOCUMENT", "pdf_password");
    throw new ParseError(
      "PARSE_FAILED",
      name === "InvalidPDFException" ? "pdf_invalid" : "pdf_open_failed",
    );
  }

  try {
    if (doc.numPages > options.maxPages) {
      throw new ParseError("TOO_MANY_PAGES", `pdf_pages_${doc.numPages}`);
    }

    const allLines: PageLine[] = [];
    const fonts = new Set<string>();
    const links: LayoutProbe["links"] = [];
    const imageOnlyPages: number[] = [];
    const columnPages: number[] = [];
    let imageCount = 0;

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const { width: pageWidth, height: pageHeight } = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      // The operator list loads fonts (for real names) and tells us where images are drawn.
      const ops = await page.getOperatorList();

      const fontName = (id: string): string => {
        try {
          if (page.commonObjs.has(id)) {
            const font = page.commonObjs.get(id) as { name?: string } | null;
            if (font?.name) return font.name.replace(/^[A-Z]{6}\+/, "");
          }
        } catch {
          // Font not loaded; fall back to the internal id.
        }
        return content.styles[id]?.fontFamily ?? id;
      };

      const items: Item[] = [];
      for (const raw of content.items) {
        if (!("str" in raw) || raw.str.trim() === "") continue;
        const t = raw.transform as number[];
        const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = t;
        // Skip rotated or vertical text, such as sideways sidebar labels.
        if (Math.abs(b) > 0.01 * Math.abs(a) || raw.dir === "ttb") continue;
        const name = fontName(raw.fontName);
        fonts.add(name);
        items.push({
          text: raw.str,
          x: e,
          width: raw.width,
          top: pageHeight - f,
          fontSize: Math.round((Math.hypot(c, d) || Math.hypot(a, b)) * 10) / 10,
          bold: BOLD_FONT.test(name),
        });
      }

      const split = detectColumnSplit(items, pageWidth, pageHeight);
      if (split !== null) columnPages.push(pageNumber);
      for (const group of readingOrder(items, split)) {
        allLines.push(...buildLines(group, pageNumber, pageWidth, pageHeight));
      }

      const pageChars = items.reduce((sum, i) => sum + i.text.trim().length, 0);
      const { count, coverage } = measureImages(ops, pdfjs.OPS, pageWidth * pageHeight);
      imageCount += count;
      if (coverage > 0.5 && pageChars < 200) imageOnlyPages.push(pageNumber);

      const annotations = (await page.getAnnotations()) as {
        subtype?: string;
        url?: string;
        rect?: number[];
      }[];
      for (const annotation of annotations) {
        if (annotation.subtype !== "Link" || !annotation.url || !annotation.rect)
          continue;
        const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = annotation.rect;
        const inside = items.filter((i) => {
          const cx = i.x + i.width / 2;
          const baseline = pageHeight - i.top;
          return cx >= x1 && cx <= x2 && baseline >= y1 - 2 && baseline <= y2 + 2;
        });
        const text = normalizeText(inside.map((i) => i.text).join(" "));
        links.push({
          text,
          url: annotation.url,
          hidden: isHiddenLink(text, annotation.url),
        });
      }

      page.cleanup();
    }

    markHeadersAndFooters(allLines, doc.numPages);

    const headerFooterLines = allLines.filter((l) => l.region !== "body");
    const layout: LayoutProbe = {
      columns: {
        detected: columnPages.length > 0 && columnPages.length * 2 >= doc.numPages,
        confidence: columnPages.length >= 2 ? "high" : "medium",
        pages: columnPages,
      },
      tables: { count: countTables(allLines), confidence: "low" },
      textBoxes: null,
      images: { count: imageCount, imageOnlyPages },
      headerFooter: {
        applicable: doc.numPages > 1,
        text: [...new Set(headerFooterLines.map((l) => l.text))],
        containsContact: headerFooterLines.some((l) => containsContactDetails(l.text)),
        confidence: "medium",
      },
      encoding: { replacementRatio: replacementRatio(allLines) },
      fonts: [...fonts].sort(),
      bulletGlyphs: [
        ...new Set(
          allLines.map((l) => leadingBullet(l.text)).filter((g): g is string => !!g),
        ),
      ],
      links,
    };

    return {
      format: "pdf",
      pageCount: doc.numPages,
      pageCountSource: "document",
      lines: allLines.map(stripSegments),
      layout,
    };
  } finally {
    await doc.loadingTask.destroy().catch(() => undefined);
  }
}

/**
 * Finds a vertical gutter that few text items cross while substantial text sits on both
 * sides. Returns the x position (points) separating two columns, or null.
 */
export function detectColumnSplit(
  items: Pick<Item, "x" | "width" | "top" | "text">[],
  pageWidth: number,
  pageHeight: number,
): number | null {
  if (items.length < 10) return null;
  const bins = new Array<number>(100).fill(0);
  for (const item of items) {
    const from = Math.max(0, Math.floor((item.x / pageWidth) * 100));
    const to = Math.min(99, Math.floor(((item.x + item.width) / pageWidth) * 100));
    for (let b = from; b <= to; b += 1) bins[b]! += 1;
  }
  const threshold = Math.max(1, items.length * 0.03);

  let best: { start: number; end: number } | null = null;
  let runStart = -1;
  for (let b = 18; b <= 82; b += 1) {
    if (bins[b]! <= threshold) {
      if (runStart === -1) runStart = b;
      const width = b - runStart + 1;
      if (width >= 2 && (!best || width > best.end - best.start + 1))
        best = { start: runStart, end: b };
    } else {
      runStart = -1;
    }
  }
  if (!best) return null;

  const split = (((best.start + best.end + 1) / 2) * pageWidth) / 100;
  const left = items.filter((i) => i.x + i.width <= split);
  const right = items.filter((i) => i.x >= split);
  const chars = (list: typeof items) => list.reduce((s, i) => s + i.text.length, 0);
  const total = chars(items);
  const span = (list: typeof items) =>
    list.length === 0
      ? 0
      : Math.max(...list.map((i) => i.top)) - Math.min(...list.map((i) => i.top));

  const balanced = chars(left) >= total * 0.2 && chars(right) >= total * 0.2;
  const tall = span(left) >= pageHeight * 0.25 && span(right) >= pageHeight * 0.25;
  return balanced && tall && left.length >= 5 && right.length >= 5 ? split : null;
}

/** Orders items for reading: full-width content above the columns, left, right, then the rest. */
function readingOrder(items: Item[], split: number | null): Item[][] {
  if (split === null) return [items];
  const left = items.filter((i) => i.x + i.width <= split);
  const right = items.filter((i) => i.x >= split);
  const spanning = items.filter((i) => !left.includes(i) && !right.includes(i));
  const columnTop = Math.min(...[...left, ...right].map((i) => i.top));
  return [
    spanning.filter((i) => i.top < columnTop),
    left,
    right,
    spanning.filter((i) => i.top >= columnTop),
  ].filter((group) => group.length > 0);
}

function buildLines(
  items: Item[],
  page: number,
  pageWidth: number,
  pageHeight: number,
): PageLine[] {
  const sorted = [...items].sort((a, b) => a.top - b.top || a.x - b.x);
  const rows: Item[][] = [];
  for (const item of sorted) {
    const row = rows.at(-1);
    const tolerance = Math.max(
      2,
      0.4 * Math.min(item.fontSize, row?.[0]?.fontSize ?? item.fontSize),
    );
    if (row && Math.abs(row[0]!.top - item.top) <= tolerance) row.push(item);
    else rows.push([item]);
  }

  return rows
    .map((row) => {
      row.sort((a, b) => a.x - b.x);
      let text = "";
      let prevEnd: number | null = null;
      const segmentStarts: number[] = [];
      let boldChars = 0;
      let totalChars = 0;
      const sizeWeights = new Map<number, number>();

      for (const item of row) {
        const size = item.fontSize || 10;
        if (prevEnd === null) {
          segmentStarts.push(item.x / pageWidth);
        } else {
          const gap = item.x - prevEnd;
          if (gap > 0.9 * size) {
            text += "\t";
            segmentStarts.push(item.x / pageWidth);
          } else if (gap > 0.15 * size && !/\s$/.test(text) && !/^\s/.test(item.text)) {
            text += " ";
          }
        }
        text += item.text;
        prevEnd = Math.max(prevEnd ?? 0, item.x + item.width);
        const n = item.text.trim().length;
        totalChars += n;
        if (item.bold) boldChars += n;
        sizeWeights.set(size, (sizeWeights.get(size) ?? 0) + n);
      }

      const fontSize =
        [...sizeWeights.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10;
      const normalized = normalizeText(text);
      return {
        text: normalized,
        page,
        y: Math.min(1, Math.max(0, row[0]!.top / pageHeight)),
        x: Math.max(0, row[0]!.x / pageWidth),
        right: Math.min(1, (prevEnd ?? 0) / pageWidth),
        fontSize,
        bold: totalChars > 0 && boldChars / totalChars >= 0.6,
        listItem: leadingBullet(normalized) !== null,
        inTable: false,
        inTextBox: false,
        region: "body" as const,
        segmentStarts,
      };
    })
    .filter((line) => line.text.length > 0);
}

/** Lines in the top or bottom 8% that repeat (ignoring numbers) on two or more pages. */
function markHeadersAndFooters(lines: PageLine[], pageCount: number) {
  if (pageCount < 2) return;
  const key = (text: string) => text.toLowerCase().replace(/\d+/g, "#");
  const pagesByKey = new Map<string, Set<number>>();
  for (const line of lines) {
    if (line.y > 0.08 && line.y < 0.92) continue;
    const k = key(line.text);
    pagesByKey.set(k, (pagesByKey.get(k) ?? new Set()).add(line.page));
  }
  for (const line of lines) {
    if (line.y > 0.08 && line.y < 0.92) continue;
    if ((pagesByKey.get(key(line.text))?.size ?? 0) >= 2) {
      line.region = line.y <= 0.08 ? "header" : "footer";
    }
  }
}

/** Three or more consecutive lines with 3+ aligned segments look like a table (low confidence). */
export function countTables(lines: Pick<PageLine, "segmentStarts" | "page">[]): number {
  let tables = 0;
  let run = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const prev = lines[i - 1];
    const aligned =
      prev !== undefined &&
      prev.page === line.page &&
      prev.segmentStarts.length >= 3 &&
      line.segmentStarts.length >= 3 &&
      line.segmentStarts
        .slice(1)
        .filter((x) => prev.segmentStarts.some((px) => Math.abs(px - x) <= 0.03))
        .length >= 2;
    if (line.segmentStarts.length >= 3 && (run === 0 || aligned)) {
      run += 1;
    } else {
      if (run >= 3) tables += 1;
      run = line.segmentStarts.length >= 3 ? 1 : 0;
    }
  }
  if (run >= 3) tables += 1;
  return tables;
}

/** Counts image draws and the share of the page they cover, tracking the transform matrix. */
function measureImages(
  ops: { fnArray: number[]; argsArray: unknown[][] },
  OPS: Record<string, number>,
  pageArea: number,
): { count: number; coverage: number } {
  const imageOps = new Set(
    [
      OPS.paintImageXObject,
      OPS.paintInlineImageXObject,
      OPS.paintImageMaskXObject,
      OPS.paintImageXObjectRepeat,
      OPS.paintInlineImageXObjectGroup,
    ].filter((n): n is number => typeof n === "number"),
  );
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  let count = 0;
  let area = 0;

  for (let i = 0; i < ops.fnArray.length; i += 1) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i] ?? [];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform && isMatrix(args)) ctm = multiply(ctm, args);
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push(ctm);
      if (isMatrix(args[0])) ctm = multiply(ctm, args[0]);
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
    else if (fn !== undefined && imageOps.has(fn)) {
      count += 1;
      area += Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2]);
    }
  }
  return { count, coverage: pageArea > 0 ? Math.min(1, area / pageArea) : 0 };
}

function isHiddenLink(text: string, url: string): boolean {
  const lower = text.toLowerCase().replace(/\s+/g, "");
  if (url.toLowerCase().startsWith("mailto:")) {
    return !lower.includes(url.slice(7).toLowerCase().split("?")[0] ?? "");
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    return !lower.includes(host);
  } catch {
    return true;
  }
}

/** Share of non-space characters that are replacement or private-use characters. */
export function replacementRatio(lines: Line[]): number {
  let bad = 0;
  let total = 0;
  for (const line of lines) {
    const chars = Array.from(line.text.replace(/\s/g, ""));
    // A symbol-font bullet at the start is reported separately as a bullet glyph.
    const body = leadingBullet(line.text) ? chars.slice(1) : chars;
    total += body.length;
    bad += body.filter((ch) => ch === "�" || isPrivateUse(ch)).length;
  }
  return total === 0 ? 0 : bad / total;
}

function stripSegments(line: PageLine): Line {
  const { segmentStarts, ...rest } = line;
  void segmentStarts;
  return rest;
}
