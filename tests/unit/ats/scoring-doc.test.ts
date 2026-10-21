import { describe, expect, it } from "vitest";

import { CHECKS } from "@/lib/ats";
import { renderScoringDoc } from "@/lib/ats/scoring-doc";

/**
 * docs/SCORING.md is generated from the check registry. This test fails when they drift;
 * `npm run docs:scoring` rewrites the file.
 */
describe("docs/SCORING.md", () => {
  const doc = renderScoringDoc();

  it("documents every check with its rule and fix", () => {
    for (const check of CHECKS) {
      expect(doc).toContain(`| ${check.id} | ${check.title} |`);
      expect(doc).toContain(check.rule);
    }
  });

  it("matches the committed file", async () => {
    await expect(doc).toMatchFileSnapshot("../../../docs/SCORING.md");
  });
});
