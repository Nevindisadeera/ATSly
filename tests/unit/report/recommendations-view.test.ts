import { describe, expect, it } from "vitest";

import type { StoredRecommendation } from "@/lib/ai/recommendations";
import {
  buildRecommendationsView,
  placeholdersIn,
  quoteLocator,
  targetLocation,
} from "@/lib/report/build-recommendations-view";
import type { ScanAiDetail } from "@/types/api";

import { draft } from "../../support/ats";

const RESUME_ID = "6ad841d08cdb9b392cd03aa2";

function rec(overrides: Partial<StoredRecommendation> = {}): StoredRecommendation {
  return {
    id: "rules-1",
    source: "rules",
    priority: "high",
    category: "formatting",
    title: "Remove tables",
    detail: "Tables can scramble the reading order. Move their content into plain text.",
    before: null,
    after: null,
    target: null,
    ...overrides,
  };
}

function ai(overrides: Partial<ScanAiDetail> = {}): ScanAiDetail {
  return {
    status: "complete",
    skippedReason: null,
    contentQuality: 72,
    recommendations: [],
    ...overrides,
  };
}

describe("targetLocation", () => {
  const resume = draft().parsed;

  it("names the role or project and the bullet, as match evidence does", () => {
    expect(
      targetLocation({ section: "experience", entryIndex: 1, bulletIndex: 0 }, resume),
    ).toBe("Experience › Contoso Retail › bullet 1");
    expect(
      targetLocation({ section: "experience", entryIndex: 0, bulletIndex: null }, resume),
    ).toBe("Experience › Northwind Payments");
    expect(
      targetLocation({ section: "skills", entryIndex: null, bulletIndex: null }, resume),
    ).toBe("Skills");
  });

  it("falls back to what exists when the indexes don't", () => {
    expect(
      targetLocation({ section: "experience", entryIndex: 0, bulletIndex: 9 }, resume),
    ).toBe("Experience › Northwind Payments");
    expect(
      targetLocation({ section: "experience", entryIndex: 7, bulletIndex: 0 }, resume),
    ).toBe("Experience");
    expect(
      targetLocation({ section: "projects", entryIndex: -1, bulletIndex: 0 }, resume),
    ).toBe("Projects");
    expect(
      targetLocation({ section: "other", entryIndex: null, bulletIndex: null }, resume),
    ).toBeNull();
    expect(targetLocation(null, resume)).toBeNull();
  });

  it("numbers entries when the resume behind the report is gone", () => {
    expect(
      targetLocation({ section: "experience", entryIndex: 0, bulletIndex: 2 }, null),
    ).toBe("Experience › Role 1 › bullet 3");
  });
});

describe("quoteLocator", () => {
  it("finds a quote in the resume, allowing small differences", () => {
    const locate = quoteLocator(draft().parsed);
    expect(
      locate("Built a Python data pipeline on AWS that processes 2 million events"),
    ).toBe("Experience › Northwind Payments › bullet 2");
    expect(locate("“Automated release testing with Jenkins”")).toBe(
      "Experience › Contoso Retail › bullet 2",
    );
    expect(locate("Managed a fleet of delivery drones")).toBeUndefined();
    expect(quoteLocator(null)("Built a Python data pipeline")).toBeUndefined();
  });
});

describe("placeholdersIn", () => {
  it("lists each placeholder once", () => {
    expect(
      placeholdersIn("Improved [metric] by [X %], then [metric] again for [team size]"),
    ).toEqual(["[metric]", "[X %]", "[team size]"]);
    expect(placeholdersIn("Cut latency by 40%")).toEqual([]);
  });
});

describe("buildRecommendationsView", () => {
  const resume = draft().parsed;
  const base = { resume, resumeId: RESUME_ID, jobDescriptionId: null };

  it("lists recommendations with their location, check and placeholders", () => {
    const view = buildRecommendationsView({
      ...base,
      ai: ai({
        recommendations: [
          rec({ checkId: "F01" }),
          rec({
            id: "ai-2",
            source: "ai",
            priority: "medium",
            category: "content",
            title: "Strengthen this bullet",
            before:
              "Built a Python data pipeline on AWS that processes 2 million events per day",
            after:
              "Built a Python data pipeline on AWS that processes 2 million events per day, improving [metric] by [X %]",
            // The quote, not the model's index, decides the location.
            target: { section: "experience", entryIndex: 1, bulletIndex: 0 },
          }),
          rec({ id: "ai-3", source: "ai", priority: "medium", category: "job_match" }),
          rec({ id: "rules-4", priority: "low", category: "job_match" }),
        ],
      }),
    });

    expect(view.notice).toBeNull();
    expect(view.empty).toBeNull();
    expect(view.counts).toEqual({ high: 1, medium: 2, low: 1 });
    expect(view.items[0]).toMatchObject({
      anchor: "recommendation-rules-1",
      categoryLabel: "Formatting",
      checkAnchor: "check-F01",
      sourceLabel: "From the checks",
      related: { href: "#check-F01", label: "See the check" },
      location: null,
      placeholders: [],
    });
    expect(view.items[1]).toMatchObject({
      categoryLabel: "Content quality",
      location: "Experience › Northwind Payments › bullet 2",
      placeholders: ["[metric]", "[X %]"],
      checkAnchor: null,
      source: "ai",
    });
    expect(view.items[2]).toMatchObject({
      categoryLabel: "Job match",
      sourceLabel: "AI suggestion",
      related: null,
    });
    // The missing-skills recommendation points at the job match it summarizes.
    expect(view.items[3]).toMatchObject({
      sourceLabel: "From the job match",
      checkAnchor: null,
      related: { href: "#job-match", label: "See the job match" },
    });
  });

  it("offers a retry when part of the AI review failed", () => {
    const view = buildRecommendationsView({
      ...base,
      ai: ai({ status: "partial", recommendations: [rec()] }),
    });
    expect(view.notice).toMatchObject({
      tone: "warning",
      title: "Some recommendations are temporarily unavailable.",
      retry: { resumeId: RESUME_ID, jobDescriptionId: null },
    });
    expect(view.notice!.body).toContain("Your scores aren't affected.");
    expect(view.items).toHaveLength(1);
  });

  it("says recommendations are unavailable when the review failed with nothing to show", () => {
    const view = buildRecommendationsView({ ...base, ai: ai({ status: "failed" }) });
    expect(view.notice!.title).toBe("Recommendations are temporarily unavailable.");
    expect(view.empty).toBeNull();
  });

  it("retries against the same saved job, and offers no retry without the resume", () => {
    const withJob = buildRecommendationsView({
      ...base,
      jobDescriptionId: "6ad85378fe232d218e42742a",
      ai: ai({ status: "failed" }),
    });
    expect(withJob.notice!.retry).toEqual({
      resumeId: RESUME_ID,
      jobDescriptionId: "6ad85378fe232d218e42742a",
    });

    const gone = buildRecommendationsView({
      ...base,
      resume: null,
      ai: ai({ status: "failed" }),
    });
    expect(gone.notice!.retry).toBeNull();
    expect(gone.notice!.body).not.toContain("again");
  });

  it("explains skipped AI review without offering a retry", () => {
    const budget = buildRecommendationsView({
      ...base,
      ai: ai({ status: "skipped", skippedReason: "budget", recommendations: [rec()] }),
    });
    expect(budget.notice).toMatchObject({
      tone: "info",
      title: "Suggested rewrites are paused for today.",
      retry: null,
    });
    expect(budget.notice!.body).toContain(
      "the recommendations below come from the checks",
    );

    const off = buildRecommendationsView({
      ...base,
      ai: ai({ status: "skipped", skippedReason: "disabled" }),
    });
    expect(off.notice).toMatchObject({
      tone: "info",
      title: "Suggested rewrites aren't available.",
    });
    expect(off.empty).toMatchObject({ title: "Nothing to recommend" });
  });

  it("says when a report predates recommendations", () => {
    for (const legacy of [null, ai({ status: "skipped" })]) {
      const view = buildRecommendationsView({ ...base, ai: legacy });
      expect(view.notice).toBeNull();
      expect(view.empty).toMatchObject({
        title: "No recommendations were saved with this report",
        retry: { resumeId: RESUME_ID, jobDescriptionId: null },
      });
    }
  });

  it("has nothing to recommend for a resume without issues", () => {
    const view = buildRecommendationsView({ ...base, ai: ai() });
    expect(view.empty).toEqual({
      title: "Nothing to recommend",
      description:
        "Your resume passed every check that applied, and the AI review found nothing to change.",
      retry: null,
    });
  });
});
