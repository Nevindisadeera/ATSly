import { displayText, leadingBullet, stripBullet, wordCount } from "../text";
import type { Line } from "../types";

/**
 * Bullets are recognized by a glyph, by Word list membership, or by indentation from the
 * section's left margin — many PDFs draw bullet symbols as shapes, so the glyph is missing
 * from the extracted text.
 */
export function isBulletLine(line: Line, margin: number): boolean {
  if (line.listItem || leadingBullet(line.text)) return true;
  return line.x > margin + 0.015 && wordCount(line.text) >= 3;
}

const CONTINUES =
  /(?:[,;:&/-]|\b(?:and|or|of|to|the|for|with|in|a|an|by|on|at|from|into|across))$/i;

export type BulletItem = { text: string; marked: boolean };

/**
 * Turns lines into items, merging a line into the previous one when it is a wrapped
 * continuation: it starts in lowercase, or the previous line ends mid-phrase.
 */
export function collectItems(lines: Line[], margin: number): BulletItem[] {
  const items: BulletItem[] = [];
  let previous: Line | null = null;
  for (const line of lines) {
    const text = displayText(stripBullet(line.text));
    if (!text) continue;
    const marked = isBulletLine(line, margin);
    const last = items.at(-1);
    const continuation =
      last !== undefined &&
      previous !== null &&
      leadingBullet(line.text) === null &&
      !line.listItem &&
      // Only PDF lines wrap; a Word paragraph is already one line (its right edge is unknown, 1).
      previous.right < 1 &&
      line.page === previous.page &&
      (/^[\p{Ll}(]/u.test(text) || CONTINUES.test(last.text)) &&
      Math.abs(line.x - previous.x) < 0.04;
    if (continuation) {
      last.text = `${last.text} ${text}`;
    } else {
      items.push({ text, marked });
    }
    previous = line;
  }
  return items;
}

export function leftMargin(lines: Line[]): number {
  return lines.length === 0 ? 0 : Math.min(...lines.map((l) => l.x));
}
