import type { ResumeSectionKind } from "@/types/api";

/**
 * Parsing domain types — docs/PLANNING.md §17.3–17.4.
 * This module is pure: no I/O beyond the bytes it is given, no database, no AI, no Next.js.
 */

export type DocFormat = "pdf" | "docx";
export type Confidence = "high" | "medium" | "low";
export type SectionKind = ResumeSectionKind;

/** One visual line of text, in reading order, from either format. */
export type Line = {
  text: string;
  /** 1-based page number. DOCX has no reliable pages, so every line is page 1. */
  page: number;
  /** Position from the top of the page, 0–1 (PDF), or document order 0–1 (DOCX). */
  y: number;
  /** Left edge as a fraction of page width (PDF) or paragraph indent (DOCX). */
  x: number;
  /** Right edge as a fraction of page width; 1 when unknown. */
  right: number;
  /** Dominant font size in points. */
  fontSize: number;
  /** True when most characters on the line are bold. */
  bold: boolean;
  /** Starts with a bullet glyph or comes from a Word list paragraph. */
  listItem: boolean;
  inTable: boolean;
  inTextBox: boolean;
  /** Word heading style level (1 = Heading 1, 0 = Title), when the paragraph uses one. */
  headingLevel?: number;
  /** Lines repeated at the top or bottom of every page, or Word header/footer text. */
  region: "body" | "header" | "footer";
};

export type LayoutProbe = {
  columns: { detected: boolean; confidence: Confidence; pages: number[] };
  tables: { count: number; confidence: Confidence };
  /** Word text boxes. Not applicable (null) for PDF. */
  textBoxes: { count: number } | null;
  images: {
    count: number;
    /** Pages whose content is mostly an image with little text (likely scanned). */
    imageOnlyPages: number[];
  };
  headerFooter: {
    /** False for single-page PDFs, where repetition can't be observed. */
    applicable: boolean;
    text: string[];
    containsContact: boolean;
    confidence: Confidence;
  };
  encoding: { replacementRatio: number };
  fonts: string[];
  bulletGlyphs: string[];
  links: { text: string; url: string; hidden: boolean }[];
};

export type Extraction = {
  format: DocFormat;
  pageCount: number;
  /** Whether the page count is read from the file or estimated (DOCX without metadata). */
  pageCountSource: "document" | "estimate";
  lines: Line[];
  layout: LayoutProbe;
};

export type YearMonth = { year: number; month?: number };

export type DateFormatKind = "mon-yyyy" | "month-yyyy" | "mm/yyyy" | "yyyy-mm" | "yyyy";

export type DateRange = {
  start?: YearMonth;
  end?: YearMonth | "present";
  /** The exact text the range was read from. */
  raw: string;
  formats: DateFormatKind[];
};

export type ParsedSection = {
  kind: SectionKind;
  heading?: string;
  headingIsStandard: boolean;
  /** Indexes into ParsedResume line order (inclusive start, exclusive end). */
  startLine: number;
  endLine: number;
  confidence: number;
};

export type ExperienceEntry = {
  title?: string;
  company?: string;
  location?: string;
  start?: YearMonth;
  end?: YearMonth | "present";
  dateText?: string;
  dateFormats: DateFormatKind[];
  bullets: string[];
  rawText: string;
  confidence: number;
};

export type EducationLevel =
  "highschool" | "associate" | "bachelor" | "master" | "doctorate" | "other";

export type EducationEntry = {
  degree?: string;
  level?: EducationLevel;
  field?: string;
  institution?: string;
  start?: YearMonth;
  end?: YearMonth | "present";
  rawText: string;
};

export type SkillKind = "skill" | "tool" | "technology" | "soft";

export type ParsedSkill = {
  raw: string;
  normalized: string;
  taxonomyId?: string;
  category?: string;
  kind?: SkillKind;
};

export type ParsedResume = {
  contact: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    links: { type: "linkedin" | "github" | "portfolio" | "other"; url: string }[];
    /** True when any contact detail was found only in a header or footer. */
    inHeaderOrFooter: boolean;
  };
  summary?: { text: string };
  skills: ParsedSkill[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  projects: {
    name?: string;
    bullets: string[];
    technologies: string[];
    rawText: string;
  }[];
  certifications: { name: string; issuer?: string; date?: YearMonth }[];
  languages: { name: string; level?: string }[];
  sections: ParsedSection[];
  stats: {
    wordCount: number;
    bulletCount: number;
    pageCount: number;
    totalExperienceMonths?: number;
    wordsPerPage: number;
  };
  meta: { language: "en" | "other"; parserVersion: string };
};

/** Typed parsing failures; the service maps these to API error codes. */
export type ParseFailureCode =
  "EMPTY_DOCUMENT" | "ENCRYPTED_DOCUMENT" | "PARSE_FAILED" | "TOO_MANY_PAGES";

export class ParseError extends Error {
  readonly code: ParseFailureCode;
  readonly reason: string;
  constructor(code: ParseFailureCode, reason: string) {
    super(`${code}: ${reason}`);
    this.name = "ParseError";
    this.code = code;
    this.reason = reason;
  }
}

export const PARSER_VERSION = "1.0.0";
