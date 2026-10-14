import { findSkillsInText, lookupSkill, normalizeSkill } from "@/lib/taxonomy";

import { displayText, stripBullet, wordCount } from "../text";
import type { Line, ParsedSkill } from "../types";

/**
 * Skills from the skills section. Lists are split on common separators; a category label
 * before a colon ("Frontend: React, Vue") is dropped. Long phrases are scanned for known skills.
 */
export function parseSkills(lines: Line[]): ParsedSkill[] {
  const out = new Map<string, ParsedSkill>();
  const add = (raw: string) => {
    const cleaned = raw.replace(/^[\s.,;:–—-]+|[\s.,;:–—-]+$/g, "").trim();
    if (!cleaned || cleaned.length > 40 || /^\d+$/.test(cleaned)) return;
    const normalized = normalizeSkill(cleaned);
    if (!normalized) return;
    const known = lookupSkill(cleaned);
    const key = known?.id ?? normalized;
    if (out.has(key)) return;
    out.set(key, {
      raw: cleaned,
      normalized,
      taxonomyId: known?.id,
      category: known?.category,
      kind: known?.kind,
    });
  };

  for (const line of lines) {
    let text = displayText(stripBullet(line.text));
    const label = text.match(/^([^:]{2,40}):\s*(.+)$/);
    if (label && wordCount(label[1]!) <= 4) text = label[2]!;

    const tokens = text
      .split(/\s*(?:[,;|•·▪◦]|\t|\s{2,}|\s\/\s|\s[–—-]\s)\s*/)
      .map((t) => t.trim())
      .filter(Boolean);

    for (const token of tokens) {
      // Proficiency notes like "React (5 years)" keep only the skill.
      const bare = token.replace(/\s*\([^)]*\)\s*$/, "");
      if (wordCount(bare) <= 4) add(bare);
      else for (const skill of findSkillsInText(bare)) add(skill.name);
    }
  }
  return [...out.values()];
}
