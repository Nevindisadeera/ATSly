import type { Confidence, Evidence, Finding } from "../types";
import type { ParsedResume } from "@/lib/parsing/types";
import type { Severity } from "@/types/report";

export const pass = (explanation: string): Finding => ({
  status: "pass",
  rawDeduction: 0,
  explanation,
});

/**
 * A problem. The engine reports it as "fail" for critical/major severity and "warn" for
 * minor/info, so checks only decide whether something is wrong and by how much.
 */
export const problem = (
  rawDeduction: number,
  explanation: string,
  evidence: Evidence[] = [],
  options: { confidence?: Confidence; severity?: Severity } = {},
): Finding => ({
  status: "fail",
  rawDeduction,
  explanation,
  evidence,
  ...options,
});

export const notApplicable = (reason: string) => ({ na: reason });

/** Checks built on English word lists don't apply to resumes in other languages. */
export function englishOnly(resume: ParsedResume): { na: string } | null {
  return resume.meta.language === "en"
    ? null
    : notApplicable(
        "This check uses English word lists, and your resume looks like it's in another language.",
      );
}

/** Up to `max` evidence items, so reports stay readable. */
export function sample<T>(items: T[], max = 3): T[] {
  return items.slice(0, max);
}
