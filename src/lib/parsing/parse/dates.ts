import type { DateFormatKind, DateRange, YearMonth } from "../types";

/** Date reading for resumes: "Jan 2021", "January, 2021", "01/2021", "2021-01", "2021", "Present". */

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const MONTH_NAME =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const YEAR = "(?:19|20)\\d{2}";
const SHORT_YEAR = "'\\d{2}";

const TOKEN = [
  `${MONTH_NAME}\\.?,?\\s*(?:${YEAR}|${SHORT_YEAR})`, // Jan 2021, Jan. 2021, January, 2021, Jan '21
  `(?:0?[1-9]|1[0-2])\\s*[/.]\\s*${YEAR}`, // 01/2021, 1.2021
  `${YEAR}\\s*[-/.]\\s*(?:0[1-9]|1[0-2])(?!\\d)`, // 2021-01
  YEAR, // 2021
].join("|");

const PRESENT = "(?:present|current(?:ly)?|now|today|ongoing|to date)";
const SEPARATOR = "\\s*(?:-|–|—|~|to|until|through|thru)\\s*";

const RANGE_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(${TOKEN}|${MONTH_NAME}\\.?)${SEPARATOR}(${TOKEN}|${PRESENT})(?![\\p{L}\\p{N}])`,
  "iu",
);
const SINGLE_RE = new RegExp(`(?<![\\p{L}\\p{N}/.-])(${TOKEN})(?![\\p{L}\\p{N}])`, "giu");
const PRESENT_RE = new RegExp(`^${PRESENT}$`, "i");

export function parseDateToken(
  token: string,
): { date: YearMonth; format: DateFormatKind } | null {
  const t = token.trim().toLowerCase();

  let m = t.match(new RegExp(`^(${MONTH_NAME})\\.?,?\\s*(${YEAR}|${SHORT_YEAR})$`, "i"));
  if (m) {
    const monthText = m[1]!.replace(/\.$/, "");
    const month = MONTHS[monthText] ?? MONTHS[monthText.slice(0, 3)];
    const yearText = m[2]!;
    const year = yearText.startsWith("'")
      ? 2000 + Number(yearText.slice(1))
      : Number(yearText);
    if (!month) return null;
    return {
      date: { year, month },
      format: monthText.length > 3 && monthText !== "sept" ? "month-yyyy" : "mon-yyyy",
    };
  }
  m = t.match(new RegExp(`^(\\d{1,2})\\s*[/.]\\s*(${YEAR})$`));
  if (m && validMonth(m[1]))
    return { date: { year: Number(m[2]), month: Number(m[1]) }, format: "mm/yyyy" };
  m = t.match(new RegExp(`^(${YEAR})\\s*[-/.]\\s*(\\d{2})$`));
  if (m && validMonth(m[2]))
    return { date: { year: Number(m[1]), month: Number(m[2]) }, format: "yyyy-mm" };
  m = t.match(new RegExp(`^(${YEAR})$`));
  if (m) return { date: { year: Number(m[1]) }, format: "yyyy" };
  return null;
}

/** Finds the first date range in a line ("Jan 2020 – Present", "2018 - 2021", "Jan – Mar 2021"). */
export function findDateRange(text: string): DateRange | null {
  const match = text.match(RANGE_RE);
  if (!match) return null;
  const [raw, startText = "", endText = ""] = match;
  const formats: DateFormatKind[] = [];

  let end: YearMonth | "present" | undefined;
  if (PRESENT_RE.test(endText.trim())) {
    end = "present";
  } else {
    const parsed = parseDateToken(endText);
    if (!parsed) return null;
    end = parsed.date;
    formats.push(parsed.format);
  }

  let start = parseDateToken(startText);
  if (!start) {
    // "Jan – Mar 2021": the start month borrows the end year.
    const month = MONTHS[startText.toLowerCase().replace(/\.$/, "").trim()];
    if (!month || end === "present") return null;
    start = { date: { year: end.year, month }, format: "mon-yyyy" };
  }
  formats.unshift(start.format);

  if (end !== "present" && compare(start.date, end) > 0) return null;
  return { start: start.date, end, raw: raw.trim(), formats };
}

/** All standalone dates in a line, in order. */
export function findDates(
  text: string,
): { date: YearMonth; format: DateFormatKind; raw: string }[] {
  const out: { date: YearMonth; format: DateFormatKind; raw: string }[] = [];
  for (const m of text.matchAll(SINGLE_RE)) {
    const parsed = parseDateToken(m[1] ?? "");
    if (parsed) out.push({ ...parsed, raw: m[0] });
  }
  return out;
}

function compare(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + (a.month ?? 1) - (b.year * 12 + (b.month ?? 1));
}

function monthIndex(date: YearMonth): number {
  return date.year * 12 + ((date.month ?? 1) - 1);
}

/**
 * Total months covered by the ranges, counting overlaps once. "Present" means `asOf`.
 * Year-only dates count from January.
 */
export function totalMonths(
  ranges: { start?: YearMonth; end?: YearMonth | "present" }[],
  asOf: Date,
): number {
  const now: YearMonth = { year: asOf.getUTCFullYear(), month: asOf.getUTCMonth() + 1 };
  const spans = ranges
    .filter(
      (r): r is { start: YearMonth; end: YearMonth | "present" } => !!r.start && !!r.end,
    )
    .map((r) => {
      const from = monthIndex(r.start);
      const to = monthIndex(r.end === "present" ? now : r.end);
      return [from, Math.max(from, to)] as const;
    })
    .sort((a, b) => a[0] - b[0]);

  let total = 0;
  let current: [number, number] | null = null;
  for (const [from, to] of spans) {
    if (!current || from > current[1]) {
      if (current) total += current[1] - current[0];
      current = [from, to];
    } else {
      current[1] = Math.max(current[1], to);
    }
  }
  if (current) total += current[1] - current[0];
  return total;
}

function validMonth(text: string | undefined): boolean {
  const month = Number(text);
  return Number.isInteger(month) && month >= 1 && month <= 12;
}
