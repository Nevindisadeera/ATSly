import { describe, expect, it } from "vitest";

import {
  activeStepIndex,
  isSettled,
  pollDelay,
  progressMessage,
  progressSteps,
} from "@/lib/report/progress";

describe("progress steps", () => {
  it("shows matching and content steps only when they run", () => {
    expect(progressSteps({ hasJobDescription: false, aiEnabled: false })).toEqual([
      "reading",
      "structure",
    ]);
    expect(progressSteps({ hasJobDescription: true, aiEnabled: true })).toEqual([
      "reading",
      "structure",
      "matching",
      "content",
    ]);
  });

  it("maps scan status and stage to the active step", () => {
    const steps = progressSteps({ hasJobDescription: true, aiEnabled: true });
    expect(activeStepIndex(steps, "queued", null)).toBe(0);
    expect(activeStepIndex(steps, "running", "ats_rules")).toBe(1);
    expect(activeStepIndex(steps, "running", "job_matching")).toBe(2);
    expect(activeStepIndex(steps, "running", "ai_analysis")).toBe(3);
    expect(activeStepIndex(steps, "running", "finalizing")).toBe(4);
    expect(activeStepIndex(steps, "complete", null)).toBe(4);
  });

  it("falls back to the first step for a stage that isn't shown", () => {
    const steps = progressSteps({ hasJobDescription: false, aiEnabled: false });
    expect(activeStepIndex(steps, "running", "job_matching")).toBe(0);
  });

  it("uses the copy deck messages", () => {
    expect(progressMessage("queued", null)).toBe("Reading your resume…");
    expect(progressMessage("running", "ats_rules")).toBe(
      "Checking your resume structure…",
    );
    expect(progressMessage("running", "job_matching")).toBe(
      "Comparing against the job description…",
    );
    expect(progressMessage("running", "ai_analysis")).toBe("Evaluating content quality…");
    expect(progressMessage("running", "finalizing")).toBe("Preparing your report…");
  });
});

describe("polling", () => {
  it("polls every 1.5 s, then every 3 s after 20 s", () => {
    expect(pollDelay(0)).toBe(1_500);
    expect(pollDelay(19_999)).toBe(1_500);
    expect(pollDelay(20_000)).toBe(3_000);
    expect(pollDelay(120_000)).toBe(3_000);
  });

  it("stops once a scan is complete or failed", () => {
    expect(isSettled("queued")).toBe(false);
    expect(isSettled("running")).toBe(false);
    expect(isSettled("complete")).toBe(true);
    expect(isSettled("failed")).toBe(true);
  });
});
