import { describe, expect, it } from "vitest";

import type { AtsReport, CheckResult } from "@/lib/ats";
import { summarizeAts } from "@/lib/services/scan-pipeline";

const issue = (
  id: string,
  severity: CheckResult["severity"],
  deduction: number,
  fix: string,
): CheckResult => ({
  id,
  category: "formatting",
  title: id,
  status: severity === "critical" || severity === "major" ? "fail" : "warn",
  severity,
  confidence: "high",
  deduction,
  explanation: "",
  fix,
  evidence: [],
});

const report = (issues: CheckResult[]): AtsReport => ({
  score: 72,
  band: "good",
  headline: "Strong formatting. Content quality needs the most attention.",
  categories: [],
  strengths: [],
  issues,
  engineVersion: "1.0.0",
});

describe("summarizeAts", () => {
  it("counts issues by severity, with informational ones as minor", () => {
    const summary = summarizeAts(
      report([
        issue("F04", "critical", 60, "Export as text."),
        issue("S04", "major", 15, "Add dates."),
        issue("S06", "minor", 6, "Use one date format."),
        issue("F09", "info", 4, "Show link addresses."),
      ]),
    );
    expect(summary).toEqual({
      headline: "Strong formatting. Content quality needs the most attention.",
      atsScore: 72,
      atsBand: "good",
      topActions: ["Export as text.", "Add dates.", "Use one date format."],
      issueCounts: { critical: 1, major: 1, minor: 2 },
    });
  });

  it("lists each fix once and handles a report with no issues", () => {
    const repeated = summarizeAts(
      report([
        issue("K01", "major", 25, "Add a skills section."),
        issue("C09", "major", 12, "Add a skills section."),
      ]),
    );
    expect(repeated.topActions).toEqual(["Add a skills section."]);
    expect(summarizeAts(report([])).topActions).toEqual([]);
  });
});
