import { COMPANY_WORDS, TITLE_WORDS } from "@/lib/taxonomy";

import { displayText, findEmail, leadingBullet, wordCount } from "../text";
import type { ExperienceEntry, Line } from "../types";
import { collectItems, isBulletLine, leftMargin } from "./bullets";
import { findDateRange } from "./dates";
import { isLocation, splitTrailingLocation } from "./location";

/**
 * Experience entries — docs/PLANNING.md §17.4.
 * Entries are anchored on date ranges; the one or two short lines above (or the date line
 * itself) hold title and company; what follows are the bullets.
 */

function isHeaderLine(line: Line, margin: number): boolean {
  if (leadingBullet(line.text) || line.listItem) return false;
  if (findEmail(line.text)) return false;
  const words = wordCount(line.text);
  if (words === 0 || words > 14) return false;
  // Sentences ending in a period are description, not headers.
  return !/\.$/.test(line.text.trim()) && !(isBulletLine(line, margin) && words >= 8);
}

function titleScore(piece: string): number {
  const tokens = piece.toLowerCase().split(/[\s/,()-]+/);
  return tokens.filter((t) => TITLE_WORDS.has(t)).length;
}

function companyScore(piece: string): number {
  const tokens = piece.toLowerCase().split(/[\s,()]+/);
  return tokens.filter((t) => COMPANY_WORDS.has(t)).length;
}

/** Splits header text into title, company and location. */
export function readHeader(
  text: string,
): Pick<ExperienceEntry, "title" | "company" | "location"> {
  const segments = displayText(text)
    .replace(/\(\s*\)/g, " ")
    .replace(/\s{2,}/g, "\t")
    .split(/\t|\s*\|\s*|\s+[–—-]\s+|\s*•\s*|\s*·\s*/)
    .map(clean)
    .filter((p) => p.length > 1);

  let location: string | undefined;
  const pieces: string[] = [];
  for (const segment of segments) {
    if (isLocation(segment)) {
      location ??= segment;
      continue;
    }
    const { rest, location: trailing } = splitTrailingLocation(segment);
    if (trailing) location ??= trailing;
    const at = rest.match(/^(.*?)\s+(?:at|@)\s+(.*)$/i);
    if (at && titleScore(at[1]!) > 0) {
      pieces.push(clean(at[1]!), clean(at[2]!));
      continue;
    }
    pieces.push(
      ...rest
        .split(/,\s+/)
        .map(clean)
        .filter((p) => p.length > 1 && !isLocation(p)),
    );
  }

  let title: string | undefined;
  let company: string | undefined;
  const ranked = pieces.map((p) => ({ p, t: titleScore(p), c: companyScore(p) }));
  const titlePiece = ranked.filter((r) => r.t > 0).sort((a, b) => b.t - a.t)[0];
  if (titlePiece) title = titlePiece.p;
  const companyPiece =
    ranked.filter((r) => r.p !== title && r.c > 0)[0] ??
    ranked.find((r) => r.p !== title && r.t === 0);
  if (companyPiece) company = companyPiece.p;
  // Nothing identifies the title: follow the common "Title, Company" order.
  if (!title && pieces.length >= 2) {
    title = pieces[0];
    company = pieces[1];
  } else if (!title && !company && pieces[0]) {
    company = pieces[0];
  }
  return { title, company, location };
}

function clean(text: string): string {
  return text.replace(/^[\s,|–—-]+|[\s,|–—-]+$/g, "").trim();
}

export function parseExperience(lines: Line[]): ExperienceEntry[] {
  if (lines.length === 0) return [];
  const margin = leftMargin(lines);
  const anchors = lines.flatMap((line, i) => (findDateRange(line.text) ? [i] : []));

  // Start of each entry: walk up from the date line over at most two header lines.
  const starts: number[] = [];
  anchors.forEach((anchor, k) => {
    const floor = k === 0 ? 0 : anchors[k - 1]! + 1;
    let start = anchor;
    for (let j = anchor - 1; j >= floor && anchor - j <= 2; j -= 1) {
      if (!isHeaderLine(lines[j]!, margin)) break;
      // Don't steal the previous entry's last bullet.
      if (k > 0 && j <= anchors[k - 1]! + 1 && lines[j]!.x > margin + 0.015) break;
      start = j;
    }
    starts.push(start);
  });

  if (starts.length === 0) {
    return [buildEntry(lines, null, margin)];
  }

  const entries: ExperienceEntry[] = [];
  // Lines before the first entry (e.g. a stray intro line) are attached to it.
  starts.forEach((start, k) => {
    const end = starts[k + 1] ?? lines.length;
    const from = k === 0 ? 0 : start;
    entries.push(buildEntry(lines.slice(from, end), anchors[k]! - from, margin));
  });
  return entries;
}

function buildEntry(
  lines: Line[],
  anchorOffset: number | null,
  margin: number,
): ExperienceEntry {
  const headerLines: Line[] = [];
  let bodyStart = 0;
  if (anchorOffset !== null) {
    headerLines.push(...lines.slice(0, anchorOffset + 1));
    bodyStart = anchorOffset + 1;
    // A company or location line right after the date line is still header.
    const next = lines[bodyStart];
    if (
      next &&
      isHeaderLine(next, margin) &&
      wordCount(next.text) <= 8 &&
      !isBulletLine(next, margin)
    ) {
      headerLines.push(next);
      bodyStart += 1;
    }
  } else {
    // No dates: treat leading short non-bullet lines as the header.
    while (
      bodyStart < Math.min(2, lines.length) &&
      isHeaderLine(lines[bodyStart]!, margin) &&
      !isBulletLine(lines[bodyStart]!, margin)
    ) {
      headerLines.push(lines[bodyStart]!);
      bodyStart += 1;
    }
  }

  const range = headerLines.map((l) => findDateRange(l.text)).find(Boolean) ?? null;
  const headerText = headerLines
    .map((l) => (range ? l.text.replace(range.raw, "\t") : l.text))
    .join("\t");
  const header = readHeader(headerText);
  const items = collectItems(lines.slice(bodyStart), margin);

  const confidence =
    (header.title ? 0.3 : 0) + (header.company ? 0.3 : 0) + (range ? 0.4 : 0);

  return {
    ...header,
    start: range?.start,
    end: range?.end,
    dateText: range?.raw,
    dateFormats: range?.formats ?? [],
    bullets: items.map((i) => i.text),
    rawText: lines.map((l) => displayText(l.text)).join("\n"),
    confidence: Math.round(confidence * 100) / 100,
  };
}
