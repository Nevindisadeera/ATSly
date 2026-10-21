import { JOB_DESCRIPTION_LIMITS } from "@/lib/config/limits";
import type { JobDescriptionPayload } from "@/lib/client/scans";

/** Step 2 of the scan flow — docs/PLANNING.md §7.2 and §5 (states 12–14). Pure helpers. */

export type JobDescriptionValue = { text: string; title: string; company: string };

export const EMPTY_JOB_DESCRIPTION: JobDescriptionValue = {
  text: "",
  title: "",
  company: "",
};

export type JobDescriptionStatus = "empty" | "short" | "ready" | "complete" | "too_long";

export function jobDescriptionStatus(text: string): JobDescriptionStatus {
  const length = text.trim().length;
  if (length === 0) return "empty";
  if (length < JOB_DESCRIPTION_LIMITS.minChars) return "short";
  if (length > JOB_DESCRIPTION_LIMITS.maxChars) return "too_long";
  if (length >= JOB_DESCRIPTION_LIMITS.completeChars) return "complete";
  return "ready";
}

/** The line under the textarea, if any. */
export function jobDescriptionHint(
  status: JobDescriptionStatus,
): { text: string; tone: "muted" | "positive" | "danger" } | null {
  switch (status) {
    case "empty":
      return {
        text: "Optional. Paste the full posting for the most accurate match.",
        tone: "muted",
      };
    case "short":
      return { text: "Add at least 100 characters, or skip this step.", tone: "muted" };
    case "complete":
      return { text: "Looks like a complete posting.", tone: "positive" };
    case "too_long":
      return {
        text: `Job descriptions can be up to ${JOB_DESCRIPTION_LIMITS.maxChars.toLocaleString("en-US")} characters. Remove benefits or company information to shorten it.`,
        tone: "danger",
      };
    default:
      return null;
  }
}

/** "1,240 characters". */
export function characterCount(text: string): string {
  const length = text.trim().length;
  return `${length.toLocaleString("en-US")} ${length === 1 ? "character" : "characters"}`;
}

/**
 * What the scan sends: the job description only when it's long enough (§7.2: below 100
 * characters the step counts as skipped). Empty title and company are left out.
 */
export function jobDescriptionPayload(
  value: JobDescriptionValue,
): JobDescriptionPayload | undefined {
  const status = jobDescriptionStatus(value.text);
  if (status !== "ready" && status !== "complete") return undefined;
  const title = value.title.trim();
  const company = value.company.trim();
  return {
    text: value.text.trim(),
    ...(title ? { title } : {}),
    ...(company ? { company } : {}),
  };
}
