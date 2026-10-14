// Builds src/lib/taxonomy/skills.json from the human-editable table in skills.txt.
// Usage: node scripts/taxonomy/build-skills.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "skills.txt"), "utf8");
const output = join(here, "../../src/lib/taxonomy/skills.json");

const KINDS = new Set(["skill", "tool", "technology", "soft"]);
const skills = [];
const ids = new Set();
const aliasOwner = new Map();

for (const [index, line] of source.split(/\r?\n/).entries()) {
  if (!line.trim() || line.startsWith("#")) continue;
  const [id, name, category, kind, aliases = ""] = line.split("|");
  const where = `skills.txt line ${index + 1}`;
  if (!id || !name || !category || !KINDS.has(kind))
    throw new Error(`Malformed row at ${where}`);
  if (ids.has(id)) throw new Error(`Duplicate id "${id}" at ${where}`);
  ids.add(id);
  const aliasList = aliases
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
  for (const alias of [name.toLowerCase(), ...aliasList]) {
    const owner = aliasOwner.get(alias);
    if (owner && owner !== id)
      throw new Error(`Alias "${alias}" used by ${owner} and ${id}`);
    aliasOwner.set(alias, id);
  }
  skills.push({ id, name, category, kind, aliases: aliasList });
}

writeFileSync(output, `${JSON.stringify(skills, null, 1)}\n`);
console.log(`Wrote ${skills.length} skills to ${output}`);
