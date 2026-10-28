import { normalizeJobText, segmentJobText } from "@/lib/matching";
import type { ParsedResume } from "@/lib/parsing/types";
import { formatDateRange } from "@/lib/utils/format";

/**
 * Input packaging — docs/PLANNING.md §21. The resume goes as compact JSON with contact
 * details reduced to booleans and the name removed; bullets are indexed so the model can
 * point at them. Long inputs are trimmed: oldest roles first, bullets kept whole.
 */

/** ~4 characters per token for English text: 6k tokens for a resume, 3k for a posting. */
export const MAX_RESUME_CHARS = 24_000;
export const MAX_JOB_CHARS = 12_000;

export type CompactResume = {
  hasEmail: boolean;
  hasPhone: boolean;
  location: string | null;
  summary: string | null;
  experience: {
    entryIndex: number;
    title: string | null;
    company: string | null;
    dates: string | null;
    bullets: { bulletIndex: number; text: string }[];
  }[];
  projects: {
    entryIndex: number;
    name: string | null;
    technologies: string[];
    bullets: { bulletIndex: number; text: string }[];
  }[];
  education: string[];
  skills: string[];
  certifications: string[];
};

export function compactResume(resume: ParsedResume): CompactResume {
  const compact: CompactResume = {
    hasEmail: Boolean(resume.contact.email),
    hasPhone: Boolean(resume.contact.phone),
    location: resume.contact.location ?? null,
    summary: resume.summary?.text ?? null,
    experience: resume.experience.map((e, entryIndex) => ({
      entryIndex,
      title: e.title ?? null,
      company: e.company ?? null,
      dates: formatDateRange(e.start, e.end) || null,
      bullets: e.bullets.map((text, bulletIndex) => ({ bulletIndex, text })),
    })),
    projects: resume.projects.map((p, entryIndex) => ({
      entryIndex,
      name: p.name ?? null,
      technologies: p.technologies,
      bullets: p.bullets.map((text, bulletIndex) => ({ bulletIndex, text })),
    })),
    education: resume.education.map((e) => e.rawText.replace(/\n/g, ", ")),
    skills: resume.skills.map((s) => s.raw),
    certifications: resume.certifications.map((c) => c.name),
  };

  // Roles are newest first, so dropping from the end removes the oldest ones.
  while (
    JSON.stringify(compact).length > MAX_RESUME_CHARS &&
    compact.experience.length > 1
  ) {
    compact.experience.pop();
  }
  while (
    JSON.stringify(compact).length > MAX_RESUME_CHARS &&
    compact.projects.length > 0
  ) {
    compact.projects.pop();
  }
  return compact;
}

/**
 * The job description with the requirements first, trimmed from the end once the
 * requirements are kept. Boilerplate and benefits are dropped by segmentation. Text before
 * the first heading (usually the job title) stays on top: moved after another section, it
 * would read as that section's last lines.
 */
export function jobDescriptionInput(rawText: string): string {
  const segments = segmentJobText(normalizeJobText(rawText)).filter(
    (s) => s.kind !== "benefits",
  );
  const opening = segments[0] && !segments[0].heading ? segments.slice(0, 1) : [];
  const order = ["requirements", "preferred", "responsibilities", "other", "about"];
  const text = [
    ...opening,
    ...segments
      .slice(opening.length)
      .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)),
  ]
    .map((s) => [s.heading, ...s.lines].filter(Boolean).join("\n"))
    .join("\n\n");
  return text.length > MAX_JOB_CHARS ? text.slice(0, MAX_JOB_CHARS) : text;
}
