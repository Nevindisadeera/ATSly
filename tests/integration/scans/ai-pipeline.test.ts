import { afterEach, describe, expect, it } from "vitest";

import { createMockProvider } from "@/lib/ai/mock-provider";
import { PROMPT_VERSION } from "@/lib/ai/prompts";
import {
  AiError,
  type AiProvider,
  type AiRequest,
  type AiTaskName,
} from "@/lib/ai/provider";
import type { Owner } from "@/lib/auth/owner";
import { JobDescriptionModel } from "@/lib/db/models/job-description";
import { ScanModel } from "@/lib/db/models/scan";
import { aiRepository } from "@/lib/db/repositories/ai-repository";
import { scanRepository } from "@/lib/db/repositories/scan-repository";
import { setAiProviderForTests } from "@/lib/services/ai-service";
import { acceptResumeUpload } from "@/lib/services/resume-service";
import { runScanPipeline } from "@/lib/services/scan-pipeline";
import { createScan, getScanForOwner } from "@/lib/services/scan-service";

import { JOB_FIXTURES } from "../../fixtures/jobs/jobs";
import { FIXTURES } from "../../fixtures/resumes/fixtures";
import { setupTestDatabase } from "../../support/database";

/**
 * Phase 10a acceptance: AI only ever adds. Outages, a switched-off provider, the budget and
 * fabricated evidence all leave a complete report; AI moves the ATS score by ≤ 3 points.
 */

setupTestDatabase();
afterEach(() => setAiProviderForTests(undefined));

const mock = createMockProvider();

/** The mock's answers, presented as a paid provider (so budget and costs apply). */
function paid(
  options: {
    fail?: AiTaskName[];
    calls?: Record<string, number>;
    transform?: (task: AiTaskName, data: unknown) => unknown;
  } = {},
): AiProvider {
  return {
    name: "openai",
    model: "gpt-4.1-mini",
    async complete<T>(request: AiRequest<T>) {
      if (options.calls)
        options.calls[request.task] = (options.calls[request.task] ?? 0) + 1;
      if (options.fail?.includes(request.task)) {
        throw new AiError("network", "simulated outage", {
          inputTokens: 100,
          outputTokens: 0,
        });
      }
      const result = await mock.complete(request);
      const data = options.transform
        ? options.transform(request.task, result.data)
        : result.data;
      return {
        ...result,
        data: request.schema.parse(data),
        usage: { inputTokens: 2_000, outputTokens: 500 },
      };
    },
  };
}

const weakBullets = FIXTURES.find((f) => f.name === "weak-bullets")!;
const marketingJob = JOB_FIXTURES.find((j) => j.name === "marketing-manager")!;

async function scanOnce(owner: Owner, options: { job?: boolean } = {}) {
  const context = { requestId: "test", owner };
  const upload = await acceptResumeUpload(
    {
      name: "weak-bullets.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: weakBullets.load(),
    },
    context,
  );
  const { scanId } = await createScan(
    {
      resumeId: upload.id,
      ...(options.job ? { jobDescription: { text: marketingJob.load() } } : {}),
    },
    context,
  );
  await runScanPipeline(scanId);
  return { scanId, detail: await getScanForOwner(owner, scanId) };
}

const guest = (): Owner => ({ type: "guest", id: crypto.randomUUID() });
const q07 = (detail: Awaited<ReturnType<typeof scanOnce>>["detail"]) =>
  detail.ats!.categories.flatMap((c) => c.checks).find((c) => c.id === "Q07")!;

describe("AI analysis in the scan pipeline", () => {
  it("completes with the content rating, merged recommendations, model and prompt version", async () => {
    setAiProviderForTests(paid());
    const owner = guest();
    const { scanId, detail } = await scanOnce(owner, { job: true });

    expect(detail.status).toBe("complete");
    expect(detail.ai).toMatchObject({
      status: "complete",
      contentQuality: expect.any(Number),
    });
    expect(q07(detail).status).not.toBe("na");
    const sources = new Set(detail.ai!.recommendations.map((r) => r.source));
    expect(sources).toEqual(new Set(["rules", "ai"]));

    const stored = await scanRepository.findForOwner(owner, scanId);
    expect(stored).toMatchObject({
      model: "gpt-4.1-mini",
      promptVersion: PROMPT_VERSION,
    });
    expect(stored!.ai!.usage).toEqual({
      promptTokens: 6_000,
      completionTokens: 1_500,
      costUsd: expect.any(Number),
    });

    const job = await JobDescriptionModel.findOne().lean();
    expect(job).toMatchObject({ extractionSource: "ai", promptVersion: PROMPT_VERSION });
  });

  it("degrades to partial when one task fails: no Q07, but a complete report", async () => {
    setAiProviderForTests(paid({ fail: ["analyzeContent"] }));
    const { detail } = await scanOnce(guest(), { job: true });
    expect(detail.status).toBe("complete");
    expect(detail.ai).toMatchObject({ status: "partial", contentQuality: null });
    expect(q07(detail).status).toBe("na");
    expect(detail.match?.components).toHaveLength(6);
    expect(detail.ai!.recommendations.length).toBeGreaterThan(0);
  });

  it("records failed when every task fails, and still completes the scan", async () => {
    setAiProviderForTests(
      paid({ fail: ["extractJobRequirements", "analyzeContent", "assessMatch"] }),
    );
    const { detail } = await scanOnce(guest(), { job: true });
    expect(detail.status).toBe("complete");
    expect(detail.ai!.status).toBe("failed");
    expect(
      detail.match?.components.find((c) => c.key === "responsibilities")?.score,
    ).toBeNull();
    // Failed calls still count against the budget.
    expect(await aiRepository.spentToday()).toBeGreaterThan(0);
  });

  it("skips AI when it's switched off, keeping rules recommendations", async () => {
    setAiProviderForTests(null);
    const { detail } = await scanOnce(guest());
    expect(detail.ai).toMatchObject({
      status: "skipped",
      skippedReason: "disabled",
      contentQuality: null,
    });
    expect(detail.ai!.recommendations.every((r) => r.source === "rules")).toBe(true);
    expect(q07(detail).status).toBe("na");
  });

  it("skips AI once today's budget is spent, without calling the provider", async () => {
    const calls: Record<string, number> = {};
    setAiProviderForTests(paid({ calls }));
    await aiRepository.addSpend(1_000);
    const { detail } = await scanOnce(guest());
    expect(detail.ai).toMatchObject({ status: "skipped", skippedReason: "budget" });
    expect(calls).toEqual({});
  });

  it("caches content analysis and job extraction, but not the match assessment", async () => {
    const calls: Record<string, number> = {};
    setAiProviderForTests(paid({ calls }));
    const owner = guest();
    await scanOnce(owner, { job: true });
    await scanOnce(owner, { job: true });
    expect(calls).toEqual({
      extractJobRequirements: 1,
      analyzeContent: 1,
      assessMatch: 2,
    });
  });

  it("drops fabricated evidence and never shows it", async () => {
    const fabricated = "Led a team of 200 engineers at Google to launch Gmail";
    setAiProviderForTests(
      paid({
        transform: (task, data) => {
          if (task === "assessMatch") {
            const assessment = data as {
              coverage: {
                covered: string;
                evidence: string | null;
                confidence: string;
              }[];
            };
            return {
              ...assessment,
              coverage: assessment.coverage.map((c) => ({
                ...c,
                covered: "yes",
                evidence: fabricated,
                confidence: "high",
              })),
            };
          }
          if (task === "analyzeContent") {
            const content = data as { recommendations: unknown[] };
            return {
              ...content,
              recommendations: [
                {
                  priority: "high",
                  category: "content",
                  title: "Fake",
                  detail: "d",
                  before: fabricated,
                  after: null,
                  target: null,
                },
              ],
            };
          }
          return data;
        },
      }),
    );
    const { scanId, detail } = await scanOnce(guest(), { job: true });
    expect(detail.match!.matched.some((m) => m.matchType === "semantic")).toBe(false);
    expect(JSON.stringify(detail.ai!.recommendations)).not.toContain("Gmail");
    const stored = await ScanModel.findById(scanId).lean();
    expect(stored!.ai!.verification!.dropped).toBeGreaterThan(0);
  });

  it("moves the ATS score by at most 3 points, even at the worst rating", async () => {
    setAiProviderForTests(null);
    const baseline = (await scanOnce(guest())).detail.ats!.score;
    setAiProviderForTests(
      paid({
        transform: (task, data) =>
          task === "analyzeContent" ? { ...(data as object), overallQuality: 0 } : data,
      }),
    );
    const worst = (await scanOnce(guest())).detail.ats!.score;
    expect(baseline - worst).toBeGreaterThanOrEqual(0);
    expect(baseline - worst).toBeLessThanOrEqual(3);
  });
});
