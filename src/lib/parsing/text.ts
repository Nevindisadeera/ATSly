/** Text helpers shared by extractors and parsers. Pure functions only. */

/**
 * Characters used as bullets. "Standard" ones are what ATS parsers handle well; the rest
 * are decorative symbols that some parsers drop or garble (plan check F08).
 */
export const STANDARD_BULLETS = new Set([
  "•",
  "·",
  "-",
  "–",
  "—",
  "*",
  "◦",
  "▪",
  "‣",
  "⁃",
]);
export const DECORATIVE_BULLETS = new Set([
  "➤",
  "►",
  "▶",
  "▸",
  "➢",
  "➣",
  "✓",
  "✔",
  "✗",
  "★",
  "☆",
  "♦",
  "◆",
  "◇",
  "■",
  "□",
  "●",
  "○",
  "❖",
  "⚫",
  "⦿",
  "✦",
  "✧",
  "→",
  "⇒",
  "»",
]);

/** Private-use code points: often symbol-font bullets (e.g. Wingdings) that extract as garbage. */
export function isPrivateUse(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (code >= 0xe000 && code <= 0xf8ff) || (code >= 0xf0000 && code <= 0xffffd);
}

export function isBulletGlyph(char: string): boolean {
  return STANDARD_BULLETS.has(char) || DECORATIVE_BULLETS.has(char) || isPrivateUse(char);
}

/** Returns the leading bullet glyph of a line, if any (a hyphen counts only when followed by a space). */
export function leadingBullet(text: string): string | null {
  const t = text.trimStart();
  const first = Array.from(t)[0];
  if (!first) return null;
  if (first === "-" || first === "*") return /^[-*]\s/.test(t) ? first : null;
  return isBulletGlyph(first) ? first : null;
}

/** Removes a leading bullet glyph and the whitespace after it. */
export function stripBullet(text: string): string {
  const bullet = leadingBullet(text);
  if (!bullet) return text.trim();
  return text.trimStart().slice(bullet.length).trim();
}

/** NFKC (fixes ligatures like "ﬁ"), unify dashes and quotes, collapse spaces (tabs survive). */
export function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‐‑‒−]/g, "-")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/ /g, " ")
    .replace(/[ \f\v]+/g, " ")
    .replace(/ *\t */g, "\t")
    .trim();
}

/** Text for display and evidence: tabs (column gaps) become two spaces. */
export function displayText(text: string): string {
  return text.replace(/\t+/g, "  ").trim();
}

export function words(text: string): string[] {
  return text.match(/[\p{L}\p{N}][\p{L}\p{N}'’.+#&/-]*/gu) ?? [];
}

export function wordCount(text: string): number {
  return words(text).length;
}

export const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
/** Phone numbers with 9–15 digits, tolerant of spaces, dots, dashes, parentheses and a leading +. */
export const PHONE_RE = /(?:\+?\(?\d[\d\s().-]{7,}\d)/;

export function findEmail(text: string): string | undefined {
  return text.match(EMAIL_RE)?.[0];
}

export function findPhone(text: string): string | undefined {
  for (const match of text.matchAll(new RegExp(PHONE_RE, "g"))) {
    const candidate = match[0].trim();
    const digits = candidate.replace(/\D/g, "");
    // Exclude date ranges like "2019 - 2021" and years.
    if (digits.length < 9 || digits.length > 15) continue;
    if (/^(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}$/.test(candidate)) continue;
    return candidate;
  }
  return undefined;
}

export function containsContactDetails(text: string): boolean {
  return EMAIL_RE.test(text) || findPhone(text) !== undefined;
}

/** Share of letters that are uppercase, for lines with at least three letters. */
export function upperRatio(text: string): number {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length < 3) return 0;
  const upper = letters.filter((l) => l === l.toUpperCase() && l !== l.toLowerCase());
  return upper.length / letters.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
