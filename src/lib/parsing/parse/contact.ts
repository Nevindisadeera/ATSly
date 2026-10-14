import { matchHeading } from "@/lib/taxonomy";

import { displayText, findEmail, findPhone } from "../text";
import { isLocation } from "./location";
import type { LayoutProbe, Line, ParsedResume } from "../types";

type Contact = ParsedResume["contact"];

const URL_RE =
  /(?:https?:\/\/[^\s|,;()<>]+|www\.[^\s|,;()<>]+|(?:linkedin\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com)\/[^\s|,;()<>]+)/gi;

/** A whole contact segment that is just a domain, e.g. "priyadesigns.io" or "janedoe.dev/work". */
const BARE_DOMAIN_RE =
  /^[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:io|dev|me|com|net|org|co|design|app|ai|tech|site|page|xyz)(?:\/\S*)?$/i;

/** Splits a contact line into its parts: "a@b.com | +1 555 | Austin, TX". */
function segments(text: string): string[] {
  return displayText(text)
    .split(/\s*(?:\||•|·|◦|▪|\t| {2,}| – | — )\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function linkType(url: string): Contact["links"][number]["type"] {
  if (/linkedin\.com/i.test(url)) return "linkedin";
  if (/github\.com|gitlab\.com/i.test(url)) return "github";
  if (/behance\.net|dribbble\.com|portfolio|\.dev\b|\.io\b|\.me\b|\.design\b/i.test(url))
    return "portfolio";
  return "other";
}

function looksLikeName(text: string): boolean {
  if (text.length > 40 || /[\d@/:]/.test(text) || matchHeading(text)) return false;
  const tokens = text.split(/\s+/);
  if (tokens.length < 2 || tokens.length > 4) return false;
  return tokens.every((t) => /^[\p{Lu}][\p{L}'’.-]*$/u.test(t));
}

/**
 * Contact details from the block above the first heading, plus header/footer text.
 * Email and phone fall back to the whole document, since some resumes put them at the end.
 */
export function parseContact(
  contactLines: Line[],
  allLines: Line[],
  layout: Pick<LayoutProbe, "links">,
): Contact {
  const body = contactLines.filter((l) => l.region === "body");
  const headerFooter = allLines.filter((l) => l.region !== "body");
  const near = [...headerFooter, ...body];

  const firstMatch = <T>(
    lines: Line[],
    find: (text: string) => T | undefined,
  ): T | undefined => {
    for (const line of lines) {
      const value = find(line.text);
      if (value !== undefined) return value;
    }
    return undefined;
  };

  const email = firstMatch(near, findEmail) ?? firstMatch(allLines, findEmail);
  const phone = firstMatch(near, findPhone) ?? firstMatch(allLines, findPhone);

  const inBody = (find: (text: string) => string | undefined) =>
    allLines.some((l) => l.region === "body" && find(l.text) !== undefined);
  const inHeaderOrFooter =
    (email !== undefined &&
      !inBody(findEmail) &&
      headerFooter.some((l) => findEmail(l.text))) ||
    (phone !== undefined &&
      !inBody(findPhone) &&
      headerFooter.some((l) => findPhone(l.text)));

  let name: string | undefined;
  for (const line of near) {
    const candidate = segments(line.text)[0];
    if (candidate && looksLikeName(candidate)) {
      name = candidate;
      break;
    }
  }

  let location: string | undefined;
  outer: for (const line of near) {
    for (const part of segments(line.text)) {
      if (findEmail(part) || findPhone(part) || /https?:|www\./i.test(part)) continue;
      if (isLocation(part) && part !== name) {
        location = part;
        break outer;
      }
    }
  }

  const urls = new Map<string, Contact["links"][number]>();
  const addUrl = (raw: string) => {
    const url = raw.replace(/[.,;)]+$/, "");
    if (/@/.test(url) || url.toLowerCase().startsWith("mailto:")) return;
    const key = url
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/$/, "");
    if (!urls.has(key)) urls.set(key, { type: linkType(url), url });
  };
  for (const line of allLines) for (const m of line.text.matchAll(URL_RE)) addUrl(m[0]);
  for (const link of layout.links) addUrl(link.url);
  // Bare domains ("priyadesigns.io") only count in the contact block, where they are links.
  for (const line of near) {
    for (const part of segments(line.text)) {
      if (!findEmail(part) && BARE_DOMAIN_RE.test(part)) addUrl(part);
    }
  }

  return {
    name,
    email,
    phone,
    location,
    links: [...urls.values()],
    inHeaderOrFooter,
  };
}
