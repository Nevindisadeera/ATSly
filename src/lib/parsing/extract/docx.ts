import { containsContactDetails, leadingBullet, normalizeText, wordCount } from "../text";
import { ParseError, type Extraction, type LayoutProbe, type Line } from "../types";
import { readZipDirectory, readZipText, ZipReadError, type ZipEntry } from "./zip";

/**
 * DOCX extraction straight from the OOXML — docs/PLANNING.md §17.3.
 * Reading the XML (rather than converting to HTML) keeps the signals the ATS checks need:
 * heading styles, bold, font size, list, table and text-box membership.
 */

/** Per-part decompression cap; a real document.xml is well under 1 MB. */
const MAX_PART_BYTES = 8 * 1024 * 1024;
/** Typical words per page, used only when the file has no page count metadata. */
const WORDS_PER_PAGE_ESTIMATE = 500;

type StyleInfo = {
  name: string;
  basedOn?: string;
  bold?: boolean;
  /** Half-points, as stored in OOXML. */
  size?: number;
  outlineLevel?: number;
  /** Paragraph style that attaches numbering, so it's a list style. */
  numbered?: boolean;
};

type Paragraph = {
  text: string;
  boldChars: number;
  totalChars: number;
  sizeWeights: Map<number, number>;
  styleId?: string;
  numbered: boolean;
  indentTwips: number;
  inTable: boolean;
  inTextBox: boolean;
};

const TAG_RE = /<(\/?)([A-Za-z][\w.-]*:?[\w.-]*)((?:\s+[^>]*?)?)\s*(\/?)>|([^<]+)/g;

function attr(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`(?:^|\\s)${name.replace(":", "\\:")}="([^"]*)"`));
  return match?.[1];
}

function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function safeCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return "�";
  }
}

/** OOXML booleans: <w:b/> is true; w:val="0"/"false"/"off" is false. */
function onOff(attrs: string): boolean {
  const val = attr(attrs, "w:val");
  return val === undefined || !/^(0|false|off)$/i.test(val);
}

export function extractDocx(bytes: Buffer): Extraction {
  const entries = readZipDirectory(bytes);
  if (!entries) throw new ParseError("PARSE_FAILED", "docx_zip_unreadable");
  const byName = new Map(entries.map((e) => [e.name, e]));

  const read = (name: string): string | undefined => {
    const entry: ZipEntry | undefined = byName.get(name);
    if (!entry) return undefined;
    try {
      return readZipText(bytes, entry, MAX_PART_BYTES);
    } catch (error) {
      if (error instanceof ZipReadError)
        throw new ParseError("PARSE_FAILED", `docx_${error.message}`);
      throw error;
    }
  };

  const documentXml = read("word/document.xml");
  if (!documentXml) throw new ParseError("PARSE_FAILED", "docx_missing_document");

  const styles = parseStyles(read("word/styles.xml") ?? "");
  const relationships = parseRelationships(read("word/_rels/document.xml.rels") ?? "");
  const numbering = read("word/numbering.xml") ?? "";
  const body = parseDocument(documentXml, styles, relationships);

  const headerFooterText: string[] = [];
  for (const entry of entries) {
    if (/^word\/(header|footer)\d*\.xml$/.test(entry.name)) {
      const xml = read(entry.name) ?? "";
      const text = normalizeText(
        [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)]
          .map((m) => decodeXml(m[1] ?? ""))
          .join(" "),
      );
      if (text) headerFooterText.push(text);
    }
  }

  const fonts = new Set<string>();
  for (const xml of [documentXml, read("word/styles.xml") ?? ""]) {
    for (const m of xml.matchAll(/<w:rFonts\b([^>]*)\/?>/g)) {
      const name = attr(m[1] ?? "", "w:ascii") ?? attr(m[1] ?? "", "w:hAnsi");
      if (name) fonts.add(name);
    }
  }

  // Bullet characters defined in list numbering; symbol fonts mean decorative glyphs.
  const numberingGlyphs = new Set<string>();
  for (const m of numbering.matchAll(/<w:lvl\b[\s\S]*?<\/w:lvl>/g)) {
    const lvl = m[0];
    if (!/<w:numFmt\s+w:val="bullet"/.test(lvl)) continue;
    const text = decodeXml(lvl.match(/<w:lvlText\s+w:val="([^"]*)"/)?.[1] ?? "");
    if (text) numberingGlyphs.add(text);
  }

  const lines: Line[] = [];
  const total = body.paragraphs.length || 1;
  body.paragraphs.forEach((p, index) => {
    const style = resolveStyle(styles, p.styleId);
    const headingLevel = headingLevelOf(style);
    const fontSize =
      ([...p.sizeWeights.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
        style.size ??
        body.defaultSize) / 2;
    const bold =
      p.totalChars > 0 ? p.boldChars / p.totalChars >= 0.6 : Boolean(style.bold);
    // A soft line break (<w:br/>) inside a paragraph produces separate visual lines.
    for (const part of p.text.split("\n")) {
      const text = normalizeText(part);
      if (!text) continue;
      lines.push({
        text,
        page: 1,
        y: index / total,
        x: Math.min(0.5, p.indentTwips / 12240),
        right: 1,
        fontSize: Math.round(fontSize * 10) / 10,
        bold,
        listItem: p.numbered || Boolean(style.numbered) || leadingBullet(text) !== null,
        inTable: p.inTable,
        inTextBox: p.inTextBox,
        headingLevel,
        region: "body",
      });
    }
  });

  const pagesFromMeta = Number(
    read("docProps/app.xml")?.match(/<Pages>(\d+)<\/Pages>/)?.[1],
  );
  const words = lines.reduce((sum, l) => sum + wordCount(l.text), 0);
  const hasPageMeta = Number.isFinite(pagesFromMeta) && pagesFromMeta > 0;
  const pageCount = hasPageMeta
    ? pagesFromMeta
    : Math.max(1, Math.ceil(words / WORDS_PER_PAGE_ESTIMATE));

  const layout: LayoutProbe = {
    columns: {
      detected: body.columns > 1,
      confidence: "high",
      pages: body.columns > 1 ? [1] : [],
    },
    tables: { count: body.tables, confidence: "high" },
    textBoxes: { count: body.textBoxes },
    images: { count: body.images, imageOnlyPages: [] },
    headerFooter: {
      applicable: true,
      text: headerFooterText,
      containsContact: headerFooterText.some(containsContactDetails),
      confidence: "high",
    },
    encoding: { replacementRatio: 0 },
    fonts: [...fonts].sort(),
    bulletGlyphs: [
      ...new Set([
        ...numberingGlyphs,
        ...lines.map((l) => leadingBullet(l.text)).filter((g): g is string => !!g),
      ]),
    ],
    links: body.links,
  };

  // Header/footer text is kept as lines too, so contact parsing can see it.
  const headerLines: Line[] = headerFooterText.map((text) => ({
    text,
    page: 1,
    y: 0,
    x: 0,
    right: 1,
    fontSize: body.defaultSize / 2,
    bold: false,
    listItem: false,
    inTable: false,
    inTextBox: false,
    region: "header",
  }));

  return {
    format: "docx",
    pageCount,
    pageCountSource: hasPageMeta ? "document" : "estimate",
    lines: [...headerLines, ...lines],
    layout,
  };
}

function parseDocument(
  xml: string,
  styles: Map<string, StyleInfo>,
  relationships: Map<string, string>,
) {
  const paragraphs: Paragraph[] = [];
  const stack: Paragraph[] = [];
  const links: LayoutProbe["links"] = [];
  let tableDepth = 0;
  let textBoxDepth = 0;
  let skipDepth = 0; // inside mc:Fallback (duplicate content) or deleted text
  let inRun = false;
  let runBold: boolean | undefined;
  let runSize: number | undefined;
  let inText = false;
  let inRunProps = false;
  let tables = 0;
  let textBoxes = 0;
  let images = 0;
  let columns = 1;
  let link: { url: string; text: string } | null = null;
  let fieldUrl: string | null = null;
  let inInstr = false;
  let defaultSize = 22;

  for (const m of xml.matchAll(TAG_RE)) {
    const [, closing, rawName, attrs = "", selfClosing, textNode] = m;
    if (textNode !== undefined) {
      if (inInstr) {
        const url = textNode.match(/HYPERLINK\s+"([^"]+)"/)?.[1];
        if (url) fieldUrl = url;
        continue;
      }
      if (!inText || skipDepth > 0) continue;
      const p = stack.at(-1);
      if (!p) continue;
      const text = decodeXml(textNode);
      p.text += text;
      const n = text.trim().length;
      p.totalChars += n;
      const style = resolveStyle(styles, p.styleId);
      if (runBold ?? style.bold) p.boldChars += n;
      const size = runSize ?? style.size;
      if (size) p.sizeWeights.set(size, (p.sizeWeights.get(size) ?? 0) + n);
      if (link) link.text += text;
      continue;
    }

    const name = rawName ?? "";
    const isClose = closing === "/";
    const isOpenOnly = !isClose && selfClosing !== "/";

    if (name === "mc:Fallback" || name === "w:del") {
      if (isClose) skipDepth = Math.max(0, skipDepth - 1);
      else if (isOpenOnly) skipDepth += 1;
      continue;
    }
    if (skipDepth > 0) continue;

    switch (name) {
      case "w:p":
        if (isClose) {
          const p = stack.pop();
          if (p && p.text.trim()) paragraphs.push(p);
        } else if (isOpenOnly) {
          stack.push({
            text: "",
            boldChars: 0,
            totalChars: 0,
            sizeWeights: new Map(),
            numbered: false,
            indentTwips: 0,
            inTable: tableDepth > 0,
            inTextBox: textBoxDepth > 0,
          });
        }
        break;
      case "w:pStyle": {
        const p = stack.at(-1);
        const id = attr(attrs, "w:val");
        if (p && id) p.styleId = id;
        break;
      }
      case "w:numPr":
        if (!isClose && stack.at(-1)) stack.at(-1)!.numbered = true;
        break;
      case "w:ind": {
        const p = stack.at(-1);
        const left = Number(attr(attrs, "w:left") ?? attr(attrs, "w:start"));
        if (p && Number.isFinite(left) && !inRun) p.indentTwips = left;
        break;
      }
      case "w:r":
        if (isOpenOnly) {
          inRun = true;
          runBold = undefined;
          runSize = undefined;
        } else if (isClose) inRun = false;
        break;
      case "w:rPr":
        inRunProps = !isClose && isOpenOnly;
        break;
      case "w:b":
        if (inRun && inRunProps) runBold = onOff(attrs);
        break;
      case "w:sz": {
        const size = Number(attr(attrs, "w:val"));
        if (inRun && inRunProps && Number.isFinite(size)) runSize = size;
        break;
      }
      case "w:t":
        inText = isOpenOnly;
        if (isClose) inText = false;
        break;
      case "w:tab":
        if (inRun && stack.at(-1)) stack.at(-1)!.text += "\t";
        break;
      case "w:br":
      case "w:cr":
        if (inRun && stack.at(-1) && attr(attrs, "w:type") !== "page")
          stack.at(-1)!.text += "\n";
        break;
      case "w:tbl":
        if (isClose) tableDepth -= 1;
        else if (isOpenOnly) {
          tableDepth += 1;
          tables += 1;
        }
        break;
      case "w:txbxContent":
        if (isClose) textBoxDepth -= 1;
        else if (isOpenOnly) {
          textBoxDepth += 1;
          textBoxes += 1;
        }
        break;
      case "a:blip":
      case "v:imagedata":
        if (!isClose) images += 1;
        break;
      case "w:cols": {
        const num = Number(attr(attrs, "w:num"));
        if (Number.isFinite(num)) columns = Math.max(columns, num);
        break;
      }
      case "w:hyperlink":
        if (isClose) {
          if (link) links.push(finishLink(link));
          link = null;
        } else if (isOpenOnly) {
          const rid = attr(attrs, "r:id");
          const url = rid ? relationships.get(rid) : undefined;
          link = url ? { url, text: "" } : null;
        }
        break;
      case "w:instrText":
        inInstr = isOpenOnly;
        if (isClose) inInstr = false;
        break;
      case "w:fldChar": {
        const type = attr(attrs, "w:fldCharType");
        if (type === "separate" && fieldUrl) link = { url: fieldUrl, text: "" };
        if (type === "end") {
          if (link && fieldUrl) links.push(finishLink(link));
          link = null;
          fieldUrl = null;
        }
        break;
      }
      case "w:docDefaults":
        break;
      default:
        break;
    }
  }

  // Default run size from styles (docDefaults), stored on the "default" pseudo-style.
  defaultSize = styles.get("__default")?.size ?? defaultSize;
  return { paragraphs, tables, textBoxes, images, columns, links, defaultSize };
}

function finishLink(link: { url: string; text: string }) {
  const text = normalizeText(link.text);
  const lower = text.toLowerCase();
  let hidden = true;
  if (link.url.toLowerCase().startsWith("mailto:")) {
    hidden = !lower.includes(link.url.slice(7).toLowerCase().split("?")[0] ?? "");
  } else {
    try {
      hidden = !lower.includes(new URL(link.url).hostname.replace(/^www\./, ""));
    } catch {
      hidden = true;
    }
  }
  return { text, url: link.url, hidden };
}

function parseStyles(xml: string): Map<string, StyleInfo> {
  const styles = new Map<string, StyleInfo>();
  const defaults = xml.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/)?.[0] ?? "";
  const defaultSize = Number(defaults.match(/<w:sz\s+w:val="(\d+)"/)?.[1]);
  styles.set("__default", {
    name: "default",
    size: Number.isFinite(defaultSize) ? defaultSize : 22,
  });

  for (const m of xml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    const attrs = m[1] ?? "";
    const body = m[2] ?? "";
    const id = attr(attrs, "w:styleId");
    if (!id) continue;
    const bold = body.match(/<w:b(\s[^>]*)?\/>/);
    const size = Number(body.match(/<w:sz\s+w:val="(\d+)"/)?.[1]);
    const outline = Number(body.match(/<w:outlineLvl\s+w:val="(\d+)"/)?.[1]);
    styles.set(id, {
      name: body.match(/<w:name\s+w:val="([^"]*)"/)?.[1] ?? id,
      basedOn: body.match(/<w:basedOn\s+w:val="([^"]*)"/)?.[1],
      bold: bold ? onOff(bold[1] ?? "") : undefined,
      size: Number.isFinite(size) ? size : undefined,
      outlineLevel: Number.isFinite(outline) ? outline : undefined,
      numbered: /<w:numPr>/.test(body),
    });
  }
  return styles;
}

/** Follows basedOn chains so a style inherits bold, size and outline level. */
function resolveStyle(styles: Map<string, StyleInfo>, id?: string): StyleInfo {
  let current = id ? styles.get(id) : styles.get("Normal");
  // The style's own display name (e.g. "heading 1"), not a parent's.
  const resolved: StyleInfo = { name: current?.name ?? id ?? "Normal" };
  const seen = new Set<string>();
  while (current && !seen.has(current.name)) {
    seen.add(current.name);
    resolved.bold ??= current.bold;
    resolved.size ??= current.size;
    resolved.outlineLevel ??= current.outlineLevel;
    resolved.numbered ||= current.numbered;
    current = current.basedOn ? styles.get(current.basedOn) : undefined;
  }
  resolved.size ??= styles.get("__default")?.size;
  return resolved;
}

function headingLevelOf(style: StyleInfo): number | undefined {
  const name = style.name.toLowerCase();
  const heading = name.match(/^heading\s*(\d)$/);
  if (heading) return Number(heading[1]);
  if (name === "title") return 0;
  if (style.outlineLevel !== undefined && style.outlineLevel < 9)
    return style.outlineLevel + 1;
  return undefined;
}

function parseRelationships(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of xml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const attrs = m[1] ?? "";
    const id = attr(attrs, "Id");
    const target = attr(attrs, "Target");
    if (id && target && /hyperlink/i.test(attr(attrs, "Type") ?? ""))
      map.set(id, decodeXml(target));
  }
  return map;
}
