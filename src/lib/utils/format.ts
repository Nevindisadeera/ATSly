/** Human-readable file size: "540 KB", "6.2 MB". Uses 1024-based units, as file managers do. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1).replace(/\.0$/, "") : Math.round(mb)} MB`;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "4 Oct 2026". Formatted in UTC so server and browser render the same text. */
export function formatDate(value: Date | string): string {
  return DATE_FORMAT.format(typeof value === "string" ? new Date(value) : value);
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "Mar 2021", or "2021" when the month is unknown. */
export function formatYearMonth(value: { year: number; month?: number }): string {
  const month = value.month ? MONTHS[value.month - 1] : undefined;
  return month ? `${month} ${value.year}` : String(value.year);
}

/** "Mar 2021 – Present". Empty when there are no dates. */
export function formatDateRange(
  start?: { year: number; month?: number },
  end?: { year: number; month?: number } | "present",
): string {
  const from = start ? formatYearMonth(start) : "";
  const to = end === "present" ? "Present" : end ? formatYearMonth(end) : "";
  if (from && to) return from === to ? from : `${from} – ${to}`;
  return from || to;
}

/** "1 page", "2 pages". */
export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? singular : plural}`;
}
