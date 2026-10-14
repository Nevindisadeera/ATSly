import { ENGLISH_STOPWORDS } from "@/lib/taxonomy";

import { extractDocx } from "./extract/docx";
import { extractPdf } from "./extract/pdf";
import { parseContact } from "./parse/contact";
import { totalMonths } from "./parse/dates";
import { parseEducation } from "./parse/education";
import { parseExperience } from "./parse/experience";
import {
  parseCertifications,
  parseLanguages,
  parseProjects,
  parseSummary,
} from "./parse/other-sections";
import { parseSkills } from "./parse/skills";
import { detectSections, type SectionSpan } from "./sections/detect";
import { displayText, words } from "./text";
import {
  PARSER_VERSION,
  ParseError,
  type DocFormat,
  type Extraction,
  type Line,
  type ParsedResume,
  type SectionKind,
} from "./types";

export { ParseError, PARSER_VERSION } from "./types";
export type * from "./types";

export type AnalyzeOptions = {
  maxPages: number;
  /** Reference date for "Present" in experience totals; pass the scan time. */
  asOf: Date;
  timeoutMs?: number;
};

export type DocumentAnalysis = {
  extraction: Extraction;
  parsed: ParsedResume;
  /** Plain text of the body, one line per line, for storage and later re-scoring. */
  text: string;
  /** Short, user-facing notes about how well the file could be read. */
  warnings: string[];
};

/** Fewer words than this means there is effectively no readable text. */
const MIN_WORDS = 10;

export async function extractDocument(
  bytes: Buffer,
  format: DocFormat,
  options: Pick<AnalyzeOptions, "maxPages">,
): Promise<Extraction> {
  if (format === "pdf") return extractPdf(bytes, options);
  const extraction = extractDocx(bytes);
  // Word only knows its page count if the file was saved by an app that records it.
  const limit =
    extraction.pageCountSource === "document" ? options.maxPages : options.maxPages + 2;
  if (extraction.pageCount > limit) {
    throw new ParseError("TOO_MANY_PAGES", `docx_pages_${extraction.pageCount}`);
  }
  return extraction;
}

export async function analyzeDocument(
  bytes: Buffer,
  format: DocFormat,
  options: AnalyzeOptions,
): Promise<DocumentAnalysis> {
  const extraction = await withTimeout(
    extractDocument(bytes, format, options),
    options.timeoutMs ?? 15_000,
  );

  const bodyLines = extraction.lines.filter((l) => l.region === "body");
  const wordTotal = bodyLines.reduce((sum, l) => sum + words(l.text).length, 0);
  if (wordTotal < MIN_WORDS) {
    const scanned = extraction.layout.images.imageOnlyPages.length > 0;
    throw new ParseError("EMPTY_DOCUMENT", scanned ? "image_only" : "no_text");
  }

  const parsed = parseResume(extraction, { asOf: options.asOf });
  return {
    extraction,
    parsed,
    text: bodyLines.map((l) => displayText(l.text)).join("\n"),
    warnings: buildWarnings(extraction, parsed),
  };
}

export function parseResume(
  extraction: Extraction,
  options: { asOf: Date },
): ParsedResume {
  const lines = extraction.lines;
  const spans = detectSections(lines);

  const linesOf = (kind: SectionKind): Line[] =>
    spans
      .filter((s) => s.kind === kind)
      .flatMap((s) => lines.slice(s.contentStart, s.contentEnd))
      .filter((l) => l.region === "body");

  // The block above the first heading plus any section headed "Contact" (e.g. a sidebar).
  const contactLines = spans
    .filter((s: SectionSpan) => s.kind === "contact")
    .flatMap((s) => lines.slice(s.contentStart, s.contentEnd));

  const experience = parseExperience(linesOf("experience"));
  const projects = parseProjects(linesOf("projects"));
  const bodyWords = lines
    .filter((l) => l.region === "body")
    .reduce((sum, l) => sum + words(l.text).length, 0);

  const totalExperienceMonths = experience.some((e) => e.start)
    ? totalMonths(experience, options.asOf)
    : undefined;

  return {
    contact: parseContact(contactLines, lines, extraction.layout),
    summary: parseSummary(linesOf("summary")),
    skills: parseSkills(linesOf("skills")),
    experience,
    education: parseEducation(linesOf("education")),
    projects,
    certifications: parseCertifications(linesOf("certifications")),
    languages: parseLanguages(linesOf("languages")),
    sections: spans.map((s) => ({
      kind: s.kind,
      heading: s.heading,
      headingIsStandard: s.headingIsStandard,
      startLine: s.headingIndex ?? s.contentStart,
      endLine: s.contentEnd,
      confidence: s.confidence,
    })),
    stats: {
      wordCount: bodyWords,
      bulletCount:
        experience.reduce((sum, e) => sum + e.bullets.length, 0) +
        projects.reduce((sum, p) => sum + p.bullets.length, 0),
      pageCount: extraction.pageCount,
      totalExperienceMonths,
      wordsPerPage: Math.round(bodyWords / Math.max(1, extraction.pageCount)),
    },
    meta: { language: detectLanguage(lines), parserVersion: PARSER_VERSION },
  };
}

/** A light check: English resumes use common English function words; others rarely do. */
export function detectLanguage(lines: Line[]): "en" | "other" {
  const all = lines
    .filter((l) => l.region === "body")
    .flatMap((l) => words(l.text.toLowerCase()));
  if (all.length < 30) return "en";
  const hits = all.filter((w) => ENGLISH_STOPWORDS.has(w)).length;
  return hits / all.length >= 0.05 ? "en" : "other";
}

function buildWarnings(extraction: Extraction, parsed: ParsedResume): string[] {
  const warnings: string[] = [];
  const imagePages = extraction.layout.images.imageOnlyPages;
  if (imagePages.length > 0) {
    const pages = imagePages.join(", ");
    warnings.push(
      imagePages.length === 1
        ? `Page ${pages} looks like an image. ATS systems may not be able to read its text.`
        : `Pages ${pages} look like images. ATS systems may not be able to read their text.`,
    );
  }
  if (extraction.layout.encoding.replacementRatio > 0.01) {
    warnings.push(
      "Some characters couldn't be read correctly. ATS systems may see garbled text.",
    );
  }
  if (!parsed.sections.some((s) => s.kind !== "contact")) {
    warnings.push(
      "We couldn't find clear section headings. Standard headings like Experience and Education help ATS systems.",
    );
  }
  if (parsed.meta.language === "other") {
    warnings.push(
      "This resume doesn't appear to be in English. Our analysis is most accurate for English resumes.",
    );
  }
  return warnings;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ParseError("PARSE_FAILED", "timeout")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
