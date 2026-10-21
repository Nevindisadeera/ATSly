import { describe, expect, it } from "vitest";

import {
  CATEGORY_ORDER,
  CATEGORY_WEIGHTS,
  CHECKS,
  ENGINE_VERSION,
  bandFor,
  runAtsEngine,
  type CategoryKey,
  type CategoryReport,
  type Check,
  type Confidence,
} from "@/lib/ats";
import { buildHeadline } from "@/lib/ats/headline";
import { applyConfidence } from "@/lib/ats/scoring";
import type { Severity } from "@/types/report";

import { draft, setBullets } from "../../support/ats";

/** A check that always reports the given deduction, for testing the scoring model. */
function fixed(
  id: string,
  category: CategoryKey,
  deduction: number,
  options: {
    severity?: Severity;
    confidence?: Confidence;
    strength?: string;
    excerpt?: string;
  } = {},
): Check {
  return {
    id,
    category,
    title: id,
    rule: "Test rule.",
    maxDeduction: Math.max(deduction, 1),
    severity: options.severity ?? "major",
    confidence: options.confidence ?? "high",
    fix: `Fix ${id}.`,
    strength: options.strength,
    run: () =>
      deduction === 0
        ? { status: "pass", rawDeduction: 0, explanation: "Fine." }
        : {
            status: "fail",
            rawDeduction: deduction,
            explanation: "Problem.",
            evidence: options.excerpt ? [{ excerpt: options.excerpt }] : [],
          },
  };
}

function run(checks: Check[], ai?: { contentQuality: number }) {
  const d = draft();
  return runAtsEngine(
    { parsed: d.parsed, layout: d.layout, format: d.format, text: d.text },
    { checks, ai },
  );
}

const scores = (categories: CategoryReport[]) =>
  Object.fromEntries(categories.map((c) => [c.key, c.score]));

describe("weights and registry", () => {
  it("weights sum to 100 and every category is ordered once", () => {
    expect(Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
    expect([...CATEGORY_ORDER].sort()).toEqual(Object.keys(CATEGORY_WEIGHTS).sort());
  });

  it("registers every catalogue check once, with complete metadata", () => {
    const ids = CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const prefix: Record<CategoryKey, string> = {
      formatting: "F",
      structure: "S",
      completeness: "C",
      keywords: "K",
      content: "Q",
      readability: "R",
    };
    const perCategory = { F: 12, S: 10, C: 11, K: 7, Q: 7, R: 8 };
    for (const [letter, count] of Object.entries(perCategory)) {
      expect(ids.filter((id) => id.startsWith(letter))).toHaveLength(count);
    }
    for (const check of CHECKS) {
      expect(check.id.startsWith(prefix[check.category])).toBe(true);
      expect(check.maxDeduction).toBeGreaterThan(0);
      expect(check.title && check.rule && check.fix).toBeTruthy();
    }
  });

  it("keeps AI's influence on the overall score within 3 points", () => {
    const q07 = CHECKS.find((c) => c.id === "Q07")!;
    expect((q07.maxDeduction * CATEGORY_WEIGHTS.content) / 100).toBeLessThanOrEqual(3);

    const d = draft();
    const input = { parsed: d.parsed, layout: d.layout, format: d.format, text: d.text };
    const without = runAtsEngine(input);
    const worst = runAtsEngine(input, { ai: { contentQuality: 0 } });
    expect(without.score - worst.score).toBeLessThanOrEqual(3);
  });
});

describe("scoring model", () => {
  it("scales deductions by confidence and rounds", () => {
    expect(applyConfidence(15, "high")).toBe(15);
    expect(applyConfidence(15, "medium")).toBe(11);
    expect(applyConfidence(12, "low")).toBe(6);
    expect(applyConfidence(5, "low")).toBe(3);
  });

  it("reproduces the worked example: 74.35 → 74 (PLANNING.md §18.5)", () => {
    const q07 = CHECKS.find((c) => c.id === "Q07")!;
    const report = run(
      [
        fixed("F03", "formatting", 8, { severity: "minor" }),
        fixed("F08", "formatting", 5, { severity: "minor" }),
        fixed("S01", "structure", 10),
        fixed("S04", "structure", 15),
        fixed("S06", "structure", 6, { severity: "minor" }),
        fixed("C04", "completeness", 5, { severity: "info" }),
        fixed("C06", "completeness", 8, { severity: "minor" }),
        fixed("K02", "keywords", 16),
        fixed("K03", "keywords", 10),
        fixed("Q02", "content", 25),
        fixed("Q05", "content", 9, { severity: "minor" }),
        q07,
        fixed("R02", "readability", 25),
        fixed("R01", "readability", 15, { severity: "minor" }),
        fixed("R06", "readability", 5, { severity: "info" }),
      ],
      { contentQuality: 75 },
    );

    expect(scores(report.categories)).toEqual({
      formatting: 87,
      structure: 69,
      completeness: 87,
      keywords: 74,
      content: 61,
      readability: 55,
    });
    expect(report.categories.map((c) => c.weightedPoints)).toEqual([
      21.75, 13.8, 13.05, 11.1, 9.15, 5.5,
    ]);
    expect(report.score).toBe(74);
    expect(report.band).toBe("good");
    expect(report.issues.find((i) => i.id === "Q07")?.deduction).toBe(5);
  });

  it("never takes a category below zero", () => {
    const report = run([
      fixed("F04", "formatting", 100, { severity: "critical" }),
      fixed("F05", "formatting", 20),
    ]);
    expect(report.categories[0]!.score).toBe(0);
    expect(report.score).toBe(75);
  });

  it("caps a finding at the check's maximum", () => {
    const check = { ...fixed("S01", "structure", 50), maxDeduction: 30 };
    expect(run([check]).issues[0]!.deduction).toBe(30);
  });

  it.each([
    [100, "excellent"],
    [85, "excellent"],
    [84, "good"],
    [70, "good"],
    [69, "fair"],
    [50, "fair"],
    [49, "needs_work"],
    [0, "needs_work"],
  ] as const)("score %i is %s", (score, band) => {
    expect(bandFor(score)).toBe(band);
  });
});

describe("report", () => {
  it("reports critical and major problems as failures, minor and info as warnings", () => {
    const report = run([
      fixed("F01", "formatting", 10, { severity: "critical" }),
      fixed("F05", "formatting", 10, { severity: "major" }),
      fixed("F03", "formatting", 10, { severity: "minor" }),
      fixed("F09", "formatting", 10, { severity: "info" }),
    ]);
    expect(report.issues.map((i) => i.status)).toEqual(["fail", "fail", "warn", "warn"]);
  });

  it("sorts issues by deduction, largest first", () => {
    const report = run([
      fixed("F03", "formatting", 8),
      fixed("S04", "structure", 15),
      fixed("C02", "completeness", 15, { confidence: "low" }),
      fixed("K01", "keywords", 25),
    ]);
    expect(report.issues.map((i) => [i.id, i.deduction])).toEqual([
      ["K01", 25],
      ["S04", 15],
      ["F03", 8],
      ["C02", 8],
    ]);
  });

  it("lists strengths from passing checks, highest impact first, at most five", () => {
    const passing = Array.from({ length: 7 }, (_, i) => ({
      ...fixed(`S0${i + 1}`, "structure", 0, { strength: `Strength ${i + 1}` }),
      maxDeduction: 10 + i,
    }));
    const report = run([
      ...passing,
      fixed("F01", "formatting", 25, { strength: "Not a strength" }),
    ]);
    expect(report.strengths).toEqual([
      "Strength 7",
      "Strength 6",
      "Strength 5",
      "Strength 4",
      "Strength 3",
    ]);
  });

  it("shortens long evidence excerpts at a word boundary", () => {
    const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const [issue] = run([fixed("R02", "readability", 25, { excerpt: long })]).issues;
    const excerpt = issue!.evidence[0]!.excerpt!;
    expect(excerpt.length).toBeLessThanOrEqual(161);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(long.startsWith(excerpt.slice(0, -1))).toBe(true);
    expect(excerpt.at(-2)).not.toBe(" ");
  });

  it("is deterministic and carries the engine version", () => {
    const d = draft();
    setBullets(d, [
      "Responsible for the checkout service",
      "Worked on the pipeline",
      "Led 3 launches",
    ]);
    const input = { parsed: d.parsed, layout: d.layout, format: d.format, text: d.text };
    const first = runAtsEngine(input);
    expect(runAtsEngine(structuredClone(input))).toEqual(first);
    expect(first.engineVersion).toBe(ENGINE_VERSION);
  });

  it("scores the clean resume 100 with no issues", () => {
    const d = draft();
    const report = runAtsEngine({
      parsed: d.parsed,
      layout: d.layout,
      format: d.format,
      text: d.text,
    });
    expect(report.score).toBe(100);
    expect(report.band).toBe("excellent");
    expect(report.issues).toEqual([]);
    expect(report.strengths.length).toBe(5);
    expect(report.headline).toBe("Strong across every category.");
  });
});

describe("headline", () => {
  const categories = (values: number[]): CategoryReport[] =>
    CATEGORY_ORDER.map((key, i) => ({
      key,
      label: {
        formatting: "Formatting",
        structure: "Structure",
        completeness: "Completeness",
        keywords: "Keywords & skills",
        content: "Content quality",
        readability: "Readability",
      }[key],
      weight: CATEGORY_WEIGHTS[key],
      score: values[i]!,
      weightedPoints: 0,
      checks: [],
    }));

  it.each([
    [
      [95, 90, 100, 60, 70, 80],
      "Strong completeness. Keywords & skills needs the most attention.",
    ],
    [
      [75, 72, 60, 50, 40, 65],
      "Solid formatting. Content quality needs the most attention.",
    ],
    [[60, 55, 40, 50, 45, 30], "Readability needs the most attention."],
    [
      [90, 95, 100, 88, 92, 100],
      "Strong across the board. Keywords & skills has the most room to improve.",
    ],
    [[100, 100, 100, 100, 100, 100], "Strong across every category."],
    [[60, 60, 60, 60, 60, 60], "Formatting needs the most attention."],
  ])("%j → %s", (values, headline) => {
    expect(buildHeadline(categories(values))).toBe(headline);
  });
});
