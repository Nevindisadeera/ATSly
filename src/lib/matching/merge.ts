import { lookupSkill } from "@/lib/taxonomy";

import type { JobRequirements } from "./types";

/**
 * Merges AI-extracted requirements into the rules extraction — docs/PLANNING.md §19.1:
 * rules win on numeric fields when both are present; AI fills what rules missed and adds
 * skills, normalized to taxonomy names so the alias tier can match them.
 */

const MAX_HARD_SKILLS = 40;
const MAX_SOFT_SKILLS = 12;
const MAX_CERTIFICATIONS = 10;

function canonicalSkill(skill: JobRequirements["hardSkills"][number]) {
  const known = lookupSkill(skill.name);
  if (!known || known.kind === "soft") return { key: skill.name.toLowerCase(), skill };
  return { key: known.id, skill: { ...skill, name: known.name, kind: known.kind } };
}

export function mergeRequirements(
  rules: JobRequirements,
  ai: JobRequirements,
): JobRequirements {
  const hard = new Map<string, JobRequirements["hardSkills"][number]>();
  for (const s of rules.hardSkills) {
    const { key, skill } = canonicalSkill(s);
    hard.set(key, skill);
  }
  for (const s of ai.hardSkills) {
    const { key, skill } = canonicalSkill(s);
    // A skill the rules already found keeps the rules' importance.
    if (!hard.has(key)) hard.set(key, skill);
  }

  const soft = new Map<string, string>();
  for (const s of [...rules.softSkills, ...ai.softSkills]) {
    if (!soft.has(s.toLowerCase())) soft.set(s.toLowerCase(), s);
  }

  const certifications = new Map<string, JobRequirements["certifications"][number]>();
  for (const c of [...rules.certifications, ...ai.certifications]) {
    if (!certifications.has(c.name.toLowerCase()))
      certifications.set(c.name.toLowerCase(), c);
  }

  const rulesYears = rules.yearsExperience.min !== null;
  return {
    jobTitle: rules.jobTitle ?? ai.jobTitle,
    seniority: rules.seniority !== "unspecified" ? rules.seniority : ai.seniority,
    yearsExperience: rulesYears ? rules.yearsExperience : ai.yearsExperience,
    education: rules.education.level !== "unspecified" ? rules.education : ai.education,
    hardSkills: [...hard.values()].slice(0, MAX_HARD_SKILLS),
    softSkills: [...soft.values()].slice(0, MAX_SOFT_SKILLS),
    certifications: [...certifications.values()].slice(0, MAX_CERTIFICATIONS),
    responsibilities:
      ai.responsibilities.length > 0 ? ai.responsibilities : rules.responsibilities,
    domain: ai.domain ?? rules.domain,
  };
}
