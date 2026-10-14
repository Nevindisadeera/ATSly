/**
 * Strict location matching. A location is "Remote"/"Hybrid", "City, ST" (US/Canada style
 * two-letter region), or "City, Country" with a known country — so job titles like
 * "Senior Engineer, Northwind Labs" are never mistaken for places.
 */

const COUNTRIES = new Set(
  [
    "united states",
    "usa",
    "us",
    "united kingdom",
    "uk",
    "england",
    "scotland",
    "wales",
    "ireland",
    "canada",
    "australia",
    "new zealand",
    "india",
    "sri lanka",
    "pakistan",
    "bangladesh",
    "nepal",
    "singapore",
    "malaysia",
    "indonesia",
    "philippines",
    "vietnam",
    "thailand",
    "japan",
    "china",
    "hong kong",
    "taiwan",
    "south korea",
    "korea",
    "germany",
    "france",
    "spain",
    "españa",
    "portugal",
    "italy",
    "netherlands",
    "belgium",
    "switzerland",
    "austria",
    "sweden",
    "norway",
    "denmark",
    "finland",
    "poland",
    "czech republic",
    "romania",
    "greece",
    "turkey",
    "israel",
    "uae",
    "united arab emirates",
    "saudi arabia",
    "qatar",
    "egypt",
    "nigeria",
    "kenya",
    "ghana",
    "south africa",
    "brazil",
    "mexico",
    "argentina",
    "chile",
    "colombia",
    "peru",
  ].map((c) => c.toLowerCase()),
);

const CITY = "[\\p{Lu}][\\p{L}'.-]+(?:\\s+[\\p{Lu}][\\p{L}'.-]+){0,2}";
const REGION_CODE = "[A-Z]{2}";
const PLACE = "[\\p{Lu}][\\p{L}'.-]+(?:\\s+[\\p{Lu}][\\p{L}'.-]+){0,2}";

const WHOLE = new RegExp(
  `^(?:remote|hybrid|on-?site|(${CITY}),\\s*(${REGION_CODE}|${PLACE}))(?:\\s*\\([^)]*\\))?$`,
  "iu",
);
const TRAILING = new RegExp(`,\\s*((${CITY}),\\s*(${REGION_CODE}|${PLACE}))\\s*$`, "u");

function acceptRegion(region: string | undefined): boolean {
  if (!region) return false;
  return /^[A-Z]{2}$/.test(region) || COUNTRIES.has(region.toLowerCase());
}

/** True when the whole text is a location. */
export function isLocation(text: string): boolean {
  const t = text.trim();
  const m = t.match(WHOLE);
  if (!m) return false;
  return m[1] === undefined || acceptRegion(m[2]);
}

/** Splits a trailing ", City, ST" off text such as "Acme Analytics, New York, NY". */
export function splitTrailingLocation(text: string): { rest: string; location?: string } {
  const m = text.match(TRAILING);
  if (!m || !acceptRegion(m[3])) return { rest: text };
  return { rest: text.slice(0, m.index).trim(), location: m[1] };
}
