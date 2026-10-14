import { findSkillsInText, SPOKEN_LANGUAGES } from "@/lib/taxonomy";

import { displayText, leadingBullet, stripBullet, wordCount } from "../text";
import type { Line, ParsedResume } from "../types";
import { collectItems, isBulletLine, leftMargin } from "./bullets";
import { findDateRange, findDates } from "./dates";

/** Projects, certifications, languages and summary — the smaller sections. */

export function parseProjects(lines: Line[]): ParsedResume["projects"] {
  if (lines.length === 0) return [];
  const margin = leftMargin(lines);
  const groups: Line[][] = [];
  let current: Line[] = [];

  lines.forEach((line, i) => {
    const next = lines[i + 1];
    const isName =
      !isBulletLine(line, margin) &&
      !leadingBullet(line.text) &&
      wordCount(line.text) <= 10 &&
      !/\.$/.test(line.text.trim()) &&
      (next === undefined ||
        isBulletLine(next, margin) ||
        findDateRange(line.text) !== null);
    if (isName && current.length > 0) {
      groups.push(current);
      current = [];
    }
    current.push(line);
  });
  if (current.length) groups.push(current);

  return groups.map((group) => {
    const [first, ...rest] = group;
    const firstIsName =
      first && !isBulletLine(first, margin) && wordCount(first.text) <= 10;
    const nameLine = firstIsName ? first : undefined;
    const body = firstIsName ? rest : group;
    const range = nameLine ? findDateRange(nameLine.text) : null;
    const name = nameLine
      ? displayText(nameLine.text.replace(range?.raw ?? "\u0000", ""))
          .split(/\s*[|–—]\s*|\t|\s{2,}/)[0]
          ?.replace(/\s*\(?\b(?:19|20)\d{2}\)?\s*$/, "")
          .trim()
      : undefined;
    const rawText = group.map((l) => displayText(l.text)).join("\n");
    return {
      name: name || undefined,
      bullets: collectItems(body, margin).map((i) => i.text),
      technologies: findSkillsInText(rawText).map((s) => s.name),
      rawText,
    };
  });
}

export function parseCertifications(lines: Line[]): ParsedResume["certifications"] {
  return lines
    .map((line) => displayText(stripBullet(line.text)))
    .filter((text) => wordCount(text) >= 1)
    .map((text) => {
      const date = findDates(text).at(-1);
      const withoutDate = (date ? text.replace(date.raw, "") : text).replace(
        /\(\s*\)/g,
        "",
      );
      // Prefer commas, pipes and "by" as separators; a dash often belongs to the name
      // ("AWS Certified Developer – Associate"), so it only separates when nothing else does.
      const primary = /\s*\|\s*|,\s+|\s+by\s+|\t/i;
      const pieces = primary.test(withoutDate)
        ? withoutDate.split(primary)
        : withoutDate.split(/\s+[–—-]\s+/);
      const parts = pieces.map(trimPiece).filter(Boolean);
      return { name: parts[0] ?? text, issuer: parts[1], date: date?.date };
    })
    .filter((c) => c.name.length > 1);
}

export function parseLanguages(lines: Line[]): ParsedResume["languages"] {
  const out: ParsedResume["languages"] = [];
  for (const line of lines) {
    const pieces = displayText(stripBullet(line.text)).split(/\s*[,;|•·]\s*|\t/);
    for (const piece of pieces) {
      const m = piece.match(/^([\p{L} ]{2,30}?)\s*(?:\(([^)]+)\)|[:–—-]\s*(.+))?$/u);
      if (!m) continue;
      const name = m[1]!.trim();
      if (!SPOKEN_LANGUAGES.has(name.toLowerCase())) continue;
      out.push({ name, level: (m[2] ?? m[3])?.trim() || undefined });
    }
  }
  return out;
}

export function parseSummary(lines: Line[]): ParsedResume["summary"] {
  const text = lines
    .map((l) => displayText(l.text))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? { text } : undefined;
}

/** Trims separators and unbalanced brackets, keeping "Basic Life Support (BLS)" intact. */
function trimPiece(piece: string): string {
  let p = piece.replace(/^[\s,–—-]+|[\s,–—-]+$/g, "").trim();
  const opens = (p.match(/\(/g) ?? []).length;
  const closes = (p.match(/\)/g) ?? []).length;
  if (closes > opens) p = p.replace(/\)\s*$/, "").trim();
  if (opens > closes) p = p.replace(/^\(\s*/, "").trim();
  return p;
}
