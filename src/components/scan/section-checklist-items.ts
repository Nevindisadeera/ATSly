import { SECTION_LABELS } from "@/lib/utils/section-labels";
import type { ResumeSectionKind } from "@/types/api";

/** Sections every resume is expected to have; shown even when missing. */
const CORE: ResumeSectionKind[] = ["experience", "education", "skills", "summary"];

/** Other sections, shown only when found, in this order. */
const EXTRA: ResumeSectionKind[] = [
  "projects",
  "certifications",
  "languages",
  "awards",
  "publications",
  "volunteering",
  "interests",
];

export { SECTION_LABELS };

export type ChecklistItem = { kind: ResumeSectionKind; label: string; found: boolean };

/**
 * Core sections first (found or not), then any other sections that were found.
 * Contact and unclassified ("other") sections are left out.
 */
export function sectionChecklist(
  sections: { kind: ResumeSectionKind }[],
): ChecklistItem[] {
  const found = new Set(sections.map((s) => s.kind));
  return [
    ...CORE.map((kind) => ({
      kind,
      label: SECTION_LABELS[kind],
      found: found.has(kind),
    })),
    ...EXTRA.filter((kind) => found.has(kind)).map((kind) => ({
      kind,
      label: SECTION_LABELS[kind],
      found: true,
    })),
  ];
}
