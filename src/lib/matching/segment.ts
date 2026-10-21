import { stripBullet } from "@/lib/parsing/text";

import { BOILERPLATE, SEGMENT_HEADINGS, type SegmentKind } from "./lexicon";

/**
 * Normalization and segmentation of a job description — docs/PLANNING.md §19.1.
 * The original text is kept for display; these helpers prepare it for matching.
 */

/** Unicode NFKC, one line per line, single spaces, no blank-line runs. */
export function normalizeJobText(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t  ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type Segment = { kind: SegmentKind; heading?: string; lines: string[] };

/** The section a heading line opens, or null if the line isn't a heading. */
export function headingKind(line: string): SegmentKind | null {
  const text = stripBullet(line)
    .replace(/[:：]\s*$/, "")
    .replace(/^#+\s*/, "")
    .replace(/\*\*/g, "")
    .trim();
  if (!text || text.length > 60 || /[.!?]$/.test(text)) return null;
  return SEGMENT_HEADINGS.find((h) => h.pattern.test(text))?.kind ?? null;
}

/**
 * Splits a normalized job description into sections by heading. Lines before the first
 * heading are "other". A heading followed by content on the same line ("Nice to have:
 * Kubernetes") starts the section and keeps the content. Equal-opportunity boilerplate is
 * dropped.
 */
export function segmentJobText(text: string): Segment[] {
  const segments: Segment[] = [{ kind: "other", lines: [] }];
  // The section a heading line opened; an inline heading covers only its own line.
  let block: SegmentKind = "other";
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || BOILERPLATE.test(line)) continue;

    const kind = headingKind(line);
    if (kind) {
      block = kind;
      segments.push({ kind, heading: line.replace(/[:：]\s*$/, ""), lines: [] });
      continue;
    }
    const inline = line.match(/^([^:]{3,40}):\s+(.+)$/);
    const inlineKind = inline ? headingKind(inline[1]!) : null;
    if (inline && inlineKind) {
      segments.push({ kind: inlineKind, heading: inline[1], lines: [inline[2]!] });
      segments.push({ kind: block, lines: [] });
      continue;
    }
    segments.at(-1)!.lines.push(stripBullet(line));
  }
  return segments.filter((s) => s.lines.length > 0 || s.heading);
}
