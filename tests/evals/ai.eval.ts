import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { compactResume, jobDescriptionInput, type CompactResume } from "@/lib/ai/inputs";
import { createMockProvider } from "@/lib/ai/mock-provider";
import { createOpenAiProvider } from "@/lib/ai/openai-provider";
import { costUsd } from "@/lib/ai/pricing";
import { PROMPT_VERSION } from "@/lib/ai/prompts";
import { AiError, type AiProvider, type AiTaskName } from "@/lib/ai/provider";
import { AI_TASKS, type AiTaskOutput } from "@/lib/ai/tasks";
import {
  indexResume,
  verifyContentAnalysis,
  verifyMatchAssessment,
  type ResumeTextIndex,
} from "@/lib/ai/verify";
import { extractJobRequirements, runMatchEngine } from "@/lib/matching";
import { lookupSkill } from "@/lib/taxonomy";
import { analyzeDocument, type ParsedResume } from "@/lib/parsing";
import type { z } from "zod";

import { JOB_FIXTURES } from "../fixtures/jobs/jobs";
import { FIXTURES } from "../fixtures/resumes/fixtures";

/**
 * AI eval set — docs/PLANNING.md §20–21. Every job fixture through extractJobRequirements,
 * every parseable resume through analyzeContent, and 20 resume × job pairs through
 * assessMatch. Thresholds are the plan's model policy: schema validity ≥ 99 %, evidence
 * verification ≥ 95 %, p95 latency ≤ 12 s, cost ≤ USD 0.02 per task.
 */

const THRESHOLDS = {
  schemaValidity: 0.99,
  evidencePass: 0.95,
  p95LatencyMs: 12_000,
  costPerTaskUsd: 0.02,
  requiredRecall: 0.8,
};
const PAIRS = 20;

function evalProvider(): AiProvider {
  if (process.env.AI_PROVIDER === "openai" && process.env.OPENAI_API_KEY) {
    return createOpenAiProvider({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 25_000,
    });
  }
  return createMockProvider();
}

type Call = {
  task: AiTaskName;
  ok: boolean;
  latencyMs: number;
  costUsd: number;
  repaired: boolean;
};

const provider = evalProvider();
const calls: Call[] = [];
const evidence = { checked: 0, dropped: 0 };
const recall: { job: string; found: number; expected: number }[] = [];
const resumes: {
  name: string;
  parsed: ParsedResume;
  compact: CompactResume;
  index: ResumeTextIndex;
}[] = [];

async function call<K extends AiTaskName>(
  task: K,
  data: unknown,
): Promise<AiTaskOutput[K] | null> {
  const started = Date.now();
  try {
    const result = await provider.complete({
      task,
      instructions: AI_TASKS[task].instructions,
      data,
      schema: AI_TASKS[task].schema as unknown as z.ZodType<AiTaskOutput[K]>,
      maxOutputTokens: AI_TASKS[task].maxOutputTokens,
    });
    calls.push({
      task,
      ok: true,
      latencyMs: result.latencyMs,
      costUsd: costUsd(
        provider.model,
        result.usage.inputTokens,
        result.usage.outputTokens,
      ),
      repaired: result.repaired,
    });
    return result.data;
  } catch (error) {
    const usage =
      error instanceof AiError ? error.usage : { inputTokens: 0, outputTokens: 0 };
    calls.push({
      task,
      ok: false,
      latencyMs: Date.now() - started,
      costUsd: costUsd(provider.model, usage.inputTokens, usage.outputTokens),
      repaired: false,
    });
    return null;
  }
}

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] ?? 0;
};

beforeAll(async () => {
  for (const fixture of FIXTURES.filter((f) => !f.expect.error)) {
    const { parsed, text } = await analyzeDocument(fixture.load(), fixture.format, {
      maxPages: 10,
      asOf: new Date(Date.UTC(2026, 9, 1)),
    });
    resumes.push({
      name: fixture.name,
      parsed,
      compact: compactResume(parsed),
      index: indexResume(parsed, text),
    });
  }
});

describe(`AI eval (${provider.name}, ${provider.model}, prompt ${PROMPT_VERSION})`, () => {
  it("extractJobRequirements finds the posting's required skills", async () => {
    for (const job of JOB_FIXTURES) {
      const extracted = await call("extractJobRequirements", {
        jobDescription: jobDescriptionInput(job.load()),
      });
      if (!extracted) continue;
      const found = new Set(
        extracted.hardSkills.map((s) => lookupSkill(s.name)?.id ?? s.name.toLowerCase()),
      );
      const expected = job.expect.required.map(
        (name) => lookupSkill(name)?.id ?? name.toLowerCase(),
      );
      recall.push({
        job: job.name,
        found: expected.filter((id) => found.has(id)).length,
        expected: expected.length,
      });
    }
  });

  it("analyzeContent quotes the resume faithfully", async () => {
    for (const resume of resumes) {
      const content = await call("analyzeContent", { resume: resume.compact });
      if (!content) continue;
      const { count } = verifyContentAnalysis(content, resume.index);
      evidence.checked += count.checked;
      evidence.dropped += count.dropped;
    }
  });

  it(`assessMatch evidence is verifiable on ${PAIRS} resume × job pairs`, async () => {
    // A fixed, spread-out sample of all pairs, so runs are comparable.
    const pairs = resumes.flatMap((r, i) =>
      JOB_FIXTURES.map((j, k) => ({ r, j, order: (i * 7 + k * 13) % 61 })),
    );
    for (const { r, j } of pairs.sort((a, b) => a.order - b.order).slice(0, PAIRS)) {
      const job = extractJobRequirements(j.load());
      const match = runMatchEngine({ resume: r.parsed, job });
      const assessment = await call("assessMatch", {
        resume: r.compact,
        requirements: match.missing
          .filter((m) => m.kind !== "certification")
          .map((m) => ({
            name: m.term,
            importance: m.importance,
          })),
        responsibilities: job.responsibilities,
      });
      if (!assessment) continue;
      const { count } = verifyMatchAssessment(assessment, r.index);
      evidence.checked += count.checked;
      evidence.dropped += count.dropped;
    }
  });

  it("meets the model policy thresholds", () => {
    const valid = calls.filter((c) => c.ok).length / calls.length;
    const evidencePass =
      evidence.checked === 0 ? 1 : 1 - evidence.dropped / evidence.checked;
    const p95 = percentile(
      calls.map((c) => c.latencyMs),
      0.95,
    );
    const costPerTask = calls.reduce((sum, c) => sum + c.costUsd, 0) / calls.length;
    const requiredRecall =
      recall.reduce((sum, r) => sum + r.found, 0) /
      Math.max(
        1,
        recall.reduce((sum, r) => sum + r.expected, 0),
      );

    const report = {
      provider: provider.name,
      model: provider.model,
      promptVersion: PROMPT_VERSION,
      calls: calls.length,
      repaired: calls.filter((c) => c.repaired).length,
      schemaValidity: Number(valid.toFixed(4)),
      evidencePass: Number(evidencePass.toFixed(4)),
      evidenceChecked: evidence.checked,
      p95LatencyMs: p95,
      costPerTaskUsd: Number(costPerTask.toFixed(5)),
      totalCostUsd: Number(calls.reduce((sum, c) => sum + c.costUsd, 0).toFixed(4)),
      requiredRecall: Number(requiredRecall.toFixed(3)),
      recall,
      thresholds: THRESHOLDS,
    };
    const dir = join(process.cwd(), "test-results");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "ai-eval.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(report);

    expect(valid).toBeGreaterThanOrEqual(THRESHOLDS.schemaValidity);
    expect(evidencePass).toBeGreaterThanOrEqual(THRESHOLDS.evidencePass);
    expect(p95).toBeLessThanOrEqual(THRESHOLDS.p95LatencyMs);
    expect(costPerTask).toBeLessThanOrEqual(THRESHOLDS.costPerTaskUsd);
    expect(requiredRecall).toBeGreaterThanOrEqual(THRESHOLDS.requiredRecall);
  });
});
