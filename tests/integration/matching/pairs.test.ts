import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { extractJobRequirements, runMatchEngine, type MatchReport } from "@/lib/matching";
import { analyzeDocument, type ParsedResume } from "@/lib/parsing";

import { JOB_FIXTURES } from "../../fixtures/jobs/jobs";
import { FIXTURES } from "../../fixtures/resumes/fixtures";

/**
 * Phase 9a acceptance: a match report is produced without AI for real resumes against real
 * postings, and a resume matches its own field better than an unrelated one.
 */

const RESUMES = [
  "clean-single-column",
  "strong-bullets",
  "two-column",
  "student-projects",
];
const AS_OF = new Date(Date.UTC(2026, 9, 1));
const parsed = new Map<string, ParsedResume>();
const reports = new Map<string, MatchReport>();

beforeAll(async () => {
  for (const name of RESUMES) {
    const fixture = FIXTURES.find((f) => f.name === name)!;
    const analysis = await analyzeDocument(fixture.load(), fixture.format, {
      maxPages: 10,
      asOf: AS_OF,
    });
    parsed.set(name, analysis.parsed);
  }
});

function score(resume: string, jobName: string): MatchReport {
  const key = `${resume}×${jobName}`;
  const cached = reports.get(key);
  if (cached) return cached;
  const job = extractJobRequirements(
    JOB_FIXTURES.find((j) => j.name === jobName)!.load(),
  );
  const report = runMatchEngine({ resume: parsed.get(resume)!, job });
  reports.set(key, report);
  return report;
}

describe("every resume against every posting", () => {
  it("produces a complete, consistent report", () => {
    for (const resume of RESUMES) {
      for (const job of JOB_FIXTURES) {
        const report = score(resume, job.name);
        expect(report.score).toBeGreaterThanOrEqual(0);
        expect(report.score).toBeLessThanOrEqual(100);
        expect(report.components).toHaveLength(6);
        const effective = report.components.reduce(
          (sum, c) => sum + c.effectiveWeight,
          0,
        );
        expect(effective).toBeCloseTo(100, 0);
        for (const c of report.components) {
          expect(c.score === null).toBe(c.effectiveWeight === 0);
        }
        // Every matched term carries evidence from the resume.
        for (const m of report.matched) expect(m.evidence).toBeTruthy();
        // Honesty: suggestions are conditional, never "Add X".
        for (const m of report.missing) expect(m.suggestion).toMatch(/^If you /);
      }
    }
  });
});

describe("relative matching", () => {
  it("matches each resume to its own field better than to an unrelated one", () => {
    expect(score("strong-bullets", "marketing-manager").score).toBeGreaterThan(
      score("strong-bullets", "backend-engineer").score,
    );
    expect(score("two-column", "product-designer").score).toBeGreaterThan(
      score("two-column", "financial-analyst").score,
    );
    expect(score("clean-single-column", "backend-engineer").score).toBeGreaterThan(
      score("clean-single-column", "marketing-manager").score,
    );
  });

  it("finds the marketing manager's core skills with evidence", () => {
    const report = score("strong-bullets", "marketing-manager");
    const terms = report.matched.map((m) => m.term);
    expect(terms).toEqual(expect.arrayContaining(["SEO", "HubSpot"]));
    const seo = report.matched.find((m) => m.term === "SEO")!;
    expect(seo.location).toMatch(/^Experience › /);
  });

  it("states the experience gap for a student applying to a senior role", () => {
    const report = score("student-projects", "backend-engineer");
    expect(report.fit.experience.status).toBe("gap");
    expect(report.honestyFlags.join(" ")).toContain("at least 5 years");
  });
});

afterAll(() => {
  const rows = RESUMES.map((resume) => ({
    resume,
    ...Object.fromEntries(
      JOB_FIXTURES.map((job) => {
        const r = reports.get(`${resume}×${job.name}`);
        return [job.name, r ? `${r.score} ${r.band}` : "-"];
      }),
    ),
  }));
  console.table(rows);
});
