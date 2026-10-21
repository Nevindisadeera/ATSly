import { afterAll, describe, expect, it } from "vitest";

import { runAtsEngine, type AtsReport } from "@/lib/ats";
import { analyzeDocument } from "@/lib/parsing";

import { FIXTURES } from "../../fixtures/resumes/fixtures";

/**
 * The ATS engine over every parseable fixture — Phase 7a acceptance: each one produces a
 * complete, consistent report, and well-built resumes outscore weak ones.
 */

const AS_OF = new Date(Date.UTC(2026, 9, 1));
const reports = new Map<string, AtsReport>();

const parseable = FIXTURES.filter((f) => !f.expect.error);

async function scoreFixture(name: string): Promise<AtsReport> {
  const cached = reports.get(name);
  if (cached) return cached;
  const fixture = parseable.find((f) => f.name === name)!;
  const analysis = await analyzeDocument(fixture.load(), fixture.format, {
    maxPages: 10,
    asOf: AS_OF,
  });
  const report = runAtsEngine({
    parsed: analysis.parsed,
    layout: analysis.extraction.layout,
    format: fixture.format,
    text: analysis.text,
  });
  reports.set(name, report);
  return report;
}

describe.each(parseable)("$name ($format)", (fixture) => {
  it("produces a complete, consistent report", async () => {
    const report = await scoreFixture(fixture.name);

    expect(report.categories).toHaveLength(6);
    const weighted = report.categories.reduce((sum, c) => sum + c.weightedPoints, 0);
    expect(report.score).toBe(Math.round(weighted));
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.headline).not.toBe("");

    for (const category of report.categories) {
      const deducted = category.checks.reduce((sum, c) => sum + c.deduction, 0);
      expect(category.score).toBe(Math.max(0, 100 - deducted));
      for (const check of category.checks) {
        if (check.status === "fail" || check.status === "warn") {
          expect(check.deduction).toBeGreaterThan(0);
          expect(check.fix).toBeTruthy();
        } else {
          expect(check.deduction).toBe(0);
        }
        expect(check.explanation).toBeTruthy();
      }
    }
    // Without AI the content-quality check is never applied.
    const q07 = report.categories.flatMap((c) => c.checks).find((c) => c.id === "Q07");
    expect(q07?.status).toBe("na");
  });

  it("is deterministic", async () => {
    const first = await scoreFixture(fixture.name);
    reports.delete(fixture.name);
    const second = await scoreFixture(fixture.name);
    expect(second).toEqual(first);
  });
});

describe("relative scoring", () => {
  it("ranks well-built resumes above weak ones", async () => {
    const clean = await scoreFixture("clean-single-column");
    const strong = await scoreFixture("strong-bullets");
    const weak = await scoreFixture("weak-bullets");
    const tables = await scoreFixture("tables");
    const textbox = await scoreFixture("textbox-header-contact");

    expect(clean.score).toBeGreaterThan(weak.score);
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(clean.score).toBeGreaterThan(tables.score);
    expect(clean.score).toBeGreaterThan(textbox.score);
    expect(clean.band === "excellent" || clean.band === "good").toBe(true);
  });

  it("flags the layout problems each fixture was built to show", async () => {
    const failed = (report: AtsReport) => new Set(report.issues.map((i) => i.id));

    expect(failed(await scoreFixture("tables"))).toContain("F01");
    expect(failed(await scoreFixture("two-column"))).toContain("F05");
    const textbox = failed(await scoreFixture("textbox-header-contact"));
    expect(textbox).toContain("F02");
    expect(textbox).toContain("F06");
    expect(failed(await scoreFixture("nonstandard-headings"))).toContain("S01");
    const weak = failed(await scoreFixture("weak-bullets"));
    expect(weak).toContain("Q05");
  });
});

afterAll(() => {
  const rows = [...reports.entries()].map(([name, r]) => ({
    name,
    score: r.score,
    band: r.band,
    ...Object.fromEntries(r.categories.map((c) => [c.key.slice(0, 5), c.score])),
    issues: r.issues.map((i) => `${i.id}-${i.deduction}`).join(" "),
  }));
  console.table(rows);
});
