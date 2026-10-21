import type { ParsedResume, ParsedSkill } from "@/lib/parsing/types";
import { findSkillsInText } from "@/lib/taxonomy";

/** Text where skills are shown in use: experience and project entries. */
export function workText(resume: ParsedResume): string {
  return [
    ...resume.experience.map((e) => e.rawText),
    ...resume.projects.map((p) => p.rawText),
  ].join("\n");
}

export type SkillUsage = {
  skill: ParsedSkill;
  /** The skill also appears in experience or projects, not only in the skills list. */
  backed: boolean;
};

/**
 * Every skill listed in the skills section and recognized by the taxonomy, with whether
 * the resume shows it in use. Check K03 scores this; the report shows it as chips.
 */
export function recognizedSkillUsage(resume: ParsedResume): SkillUsage[] {
  const used = new Set(findSkillsInText(workText(resume)).map((s) => s.id));
  return resume.skills
    .filter((skill) => skill.taxonomyId)
    .map((skill) => ({ skill, backed: used.has(skill.taxonomyId!) }));
}
