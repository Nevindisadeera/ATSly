import { afterAll, describe, expect, it } from "vitest";

import { analyzeDocument, ParseError, type DocumentAnalysis } from "@/lib/parsing";

import { FIXTURES } from "../../fixtures/resumes/fixtures";

/**
 * Parser accuracy against realistic fixtures — Stage 5 acceptance:
 * every fixture parses (or fails with the expected code), section detection F1 ≥ 0.9,
 * and parse time is recorded (p95 target < 2 s locally).
 */

const AS_OF = new Date(Date.UTC(2026, 9, 1));
const durations: { name: string; ms: number }[] = [];
const counts = { truePositive: 0, predicted: 0, expected: 0 };

/** Multiset intersection size of two kind lists. */
function overlap(a: string[], b: string[]): number {
  const remaining = [...b];
  let hits = 0;
  for (const item of a) {
    const i = remaining.indexOf(item);
    if (i !== -1) {
      hits += 1;
      remaining.splice(i, 1);
    }
  }
  return hits;
}

describe.each(FIXTURES)("$name ($format)", (fixture) => {
  it("parses as expected", async () => {
    const bytes = fixture.load();
    const started = performance.now();
    let result: DocumentAnalysis | undefined;
    let error: unknown;
    try {
      result = await analyzeDocument(bytes, fixture.format, {
        maxPages: 10,
        asOf: AS_OF,
      });
    } catch (e) {
      error = e;
    }
    durations.push({ name: fixture.name, ms: performance.now() - started });

    const want = fixture.expect;
    if (want.error) {
      expect(error).toBeInstanceOf(ParseError);
      expect((error as ParseError).code).toBe(want.error);
      return;
    }
    if (error) throw error;
    const { parsed, extraction, warnings } = result!;

    if (want.name) expect(parsed.contact.name).toBe(want.name);
    if (want.email) expect(parsed.contact.email).toBe(want.email);
    if (want.phone) expect(parsed.contact.phone).toBeTruthy();
    if (want.experienceEntries !== undefined) {
      expect(parsed.experience).toHaveLength(want.experienceEntries);
    }
    if (want.educationEntries !== undefined) {
      expect(parsed.education).toHaveLength(want.educationEntries);
    }
    if (want.minSkills !== undefined) {
      expect(parsed.skills.filter((s) => s.taxonomyId).length).toBeGreaterThanOrEqual(
        want.minSkills,
      );
    }
    if (want.pageCount !== undefined) expect(extraction.pageCount).toBe(want.pageCount);
    if (want.columns !== undefined)
      expect(extraction.layout.columns.detected).toBe(want.columns);
    if (want.tables) expect(extraction.layout.tables.count).toBeGreaterThan(0);
    if (want.textBoxes) expect(extraction.layout.textBoxes?.count).toBeGreaterThan(0);
    if (want.contactInHeaderOrFooter !== undefined) {
      expect(
        parsed.contact.inHeaderOrFooter || extraction.layout.headerFooter.containsContact,
      ).toBe(want.contactInHeaderOrFooter);
    }
    if (want.language) expect(parsed.meta.language).toBe(want.language);
    for (const w of want.warnings ?? []) {
      expect(warnings.some((x) => x.includes(w))).toBe(true);
    }

    if (want.sections && !want.excludeFromAccuracy) {
      const predicted = parsed.sections.map((s) => s.kind).filter((k) => k !== "contact");
      counts.truePositive += overlap(predicted, want.sections);
      counts.predicted += predicted.length;
      counts.expected += want.sections.length;
      // Per-fixture detail helps when tuning; the aggregate F1 below is the gate.
      expect.soft(predicted.sort()).toEqual([...want.sections].sort());
    }
  });
});

afterAll(() => {
  const precision = counts.truePositive / Math.max(1, counts.predicted);
  const recall = counts.truePositive / Math.max(1, counts.expected);
  const f1 = (2 * precision * recall) / Math.max(1e-9, precision + recall);
  const sorted = durations.map((d) => d.ms).sort((a, b) => a - b);
  const p95 =
    sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
  console.log(
    `\nSection detection: precision ${precision.toFixed(3)}, recall ${recall.toFixed(3)}, F1 ${f1.toFixed(3)}` +
      `\nParse time: p95 ${p95.toFixed(0)} ms, max ${Math.max(...sorted).toFixed(0)} ms` +
      `\n${durations.map((d) => `  ${d.name}: ${d.ms.toFixed(0)} ms`).join("\n")}`,
  );
});

describe("aggregate", () => {
  it("section detection F1 is at least 0.9", () => {
    // Runs after the fixtures above (Vitest runs tests in a file in order).
    const precision = counts.truePositive / Math.max(1, counts.predicted);
    const recall = counts.truePositive / Math.max(1, counts.expected);
    const f1 = (2 * precision * recall) / Math.max(1e-9, precision + recall);
    expect(f1).toBeGreaterThanOrEqual(0.9);
  });
});
