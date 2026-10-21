import { describe, expect, it } from "vitest";

import { runAtsEngine } from "@/lib/ats";
import type { ParsedResume } from "@/lib/parsing";
import { buildReportView, topActions } from "@/lib/report/build-report-view";
import { summarizeAts } from "@/lib/services/scan-pipeline";
import type { ScanDetail } from "@/types/api";

import { draft, role, setBullets, type Draft } from "../../support/ats";

function scanOf(d: Draft): ScanDetail {
  const ats = runAtsEngine({
    parsed: d.parsed,
    layout: d.layout,
    format: d.format,
    text: d.text,
  });
  return {
    id: "6ad841d18cdb9b392cd03aa3",
    status: "complete",
    stage: null,
    error: null,
    updatedAt: "2026-10-04T10:00:05.000Z",
    createdAt: "2026-10-04T10:00:00.000Z",
    expiresAt: "2026-10-11T10:00:00.000Z",
    engineVersion: ats.engineVersion,
    resume: {
      id: "6ad841d08cdb9b392cd03aa2",
      fileName: "resume.pdf",
      pageCount: 1,
      wordCount: 420,
    },
    summary: summarizeAts(ats),
    ats,
    ai: { status: "skipped" },
    durationMs: 120,
  };
}

/** The clean resume with weak bullets, a missing date and a table: several issues. */
function flawed(): Draft {
  const d = draft();
  setBullets(d, [
    "Responsible for the checkout service and its daily operations",
    "Worked on the data pipeline with the analytics team members",
    "Helped with release testing for the mobile app every sprint",
  ]);
  d.parsed.experience.push(
    role({ company: "Fabrikam", start: undefined, end: undefined, dateText: undefined }),
  );
  d.layout.tables.count = 1;
  return d;
}

describe("buildReportView", () => {
  it("carries the engine's numbers unchanged, with dates formatted", () => {
    const d = draft();
    const scan = scanOf(d);
    const view = buildReportView(scan, d.parsed);

    expect(view).toMatchObject({
      score: scan.ats!.score,
      band: scan.ats!.band,
      bandDescription: "ATS-ready",
      headline: scan.ats!.headline,
      scannedOn: "4 Oct 2026",
      deletesOn: "11 Oct 2026",
      fileName: "resume.pdf",
    });
    expect(view.categories.map((c) => c.weightedPoints)).toEqual(
      scan.ats!.categories.map((c) => c.weightedPoints),
    );
    expect(Math.round(view.weightedTotal)).toBe(view.score);
  });

  it("lists the top actions by deduction, each fix once, linking to its check", () => {
    const scan = scanOf(flawed());
    const actions = topActions(scan.ats!);
    expect(actions.length).toBeLessThanOrEqual(3);
    expect(actions[0]!.anchor).toBe(`check-${scan.ats!.issues[0]!.id}`);
    expect(new Set(actions.map((a) => a.fix)).size).toBe(actions.length);
  });

  it("groups checks by category: issues by size, then passed and not applicable", () => {
    const d = flawed();
    const view = buildReportView(scanOf(d), d.parsed);
    expect(view.issueGroups.map((g) => g.key)).toEqual([
      "formatting",
      "structure",
      "completeness",
      "keywords",
      "content",
      "readability",
    ]);
    for (const group of view.issueGroups) {
      const points = group.issues.map((c) => c.points);
      expect(points).toEqual([...points].sort((a, b) => b - a));
      expect(group.passed.every((c) => c.status === "pass")).toBe(true);
      expect(group.notApplicable.every((c) => c.status === "na")).toBe(true);
    }
    const tables = view.issueGroups[0]!.issues.find((c) => c.id === "F01")!;
    expect(tables).toMatchObject({
      certainty: "Detected",
      points: 25,
      anchor: "check-F01",
    });
    expect(view.issueTotal).toBe(
      view.issueGroups.reduce((n, g) => n + g.issues.length, 0),
    );
  });

  it("shows which listed skills are backed by experience", () => {
    const d = draft();
    const keywords = buildReportView(scanOf(d), d.parsed).keywords!;
    const all = keywords.groups.flatMap((g) => g.skills);
    expect(all.find((s) => s.term === "Python")?.backed).toBe(true);
    expect(all.find((s) => s.term === "PostgreSQL")?.backed).toBe(false);
    expect(keywords.backedCount).toBe(all.filter((s) => s.backed).length);
    expect(keywords.hygiene.map((c) => c.id)).toEqual(["K04", "K05", "K06", "K07"]);
  });

  it("renders the parsed resume with flags where the parser was unsure", () => {
    const d = flawed();
    const parsed = buildReportView(scanOf(d), d.parsed).parsed!;
    expect(parsed.contact).toContainEqual({
      label: "Email",
      value: "jordan.rivera@example.com",
    });
    expect(parsed.contact).toContainEqual({
      label: "LinkedIn",
      value: "https://linkedin.com/in/jordanrivera",
    });
    const experience = parsed.sections.find((s) => s.kind === "experience")!;
    expect(experience.entries[0]).toMatchObject({
      heading: "Senior Backend Engineer",
      subheading: "Northwind Payments",
      meta: "Mar 2021 – Present",
    });
    expect(experience.entries.at(-1)!.flags).toContain(
      "No dates were found for this role.",
    );
    expect(parsed.sections.map((s) => s.kind)).toEqual([
      "summary",
      "experience",
      "education",
      "skills",
    ]);
  });

  it("still renders the report when the resume behind it is gone", () => {
    const view = buildReportView(scanOf(draft()), null);
    expect(view.keywords).toBeNull();
    expect(view.parsed).toBeNull();
    expect(view.issueGroups).toHaveLength(6);
  });

  it("names sections that are found but not broken down", () => {
    const d = draft();
    const resume: ParsedResume = {
      ...d.parsed,
      sections: [
        ...d.parsed.sections,
        {
          kind: "awards",
          heading: "Awards",
          headingIsStandard: true,
          startLine: 20,
          endLine: 22,
          confidence: 1,
        },
      ],
    };
    expect(buildReportView(scanOf(d), resume).parsed!.otherSections).toEqual(["Awards"]);
  });

  it("refuses a scan that isn't complete", () => {
    const scan = { ...scanOf(draft()), status: "running" as const };
    expect(() => buildReportView(scan, null)).toThrow();
  });
});
