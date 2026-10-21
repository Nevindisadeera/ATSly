import { APIConnectionTimeoutError, AuthenticationError } from "openai";
import { describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import { compactResume } from "@/lib/ai/inputs";
import { createMockProvider, mockRewrite } from "@/lib/ai/mock-provider";
import { createOpenAiProvider, supportsTemperature } from "@/lib/ai/openai-provider";
import { SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { AiError, type AiRequest } from "@/lib/ai/provider";
import { ContentAnalysisSchema } from "@/lib/ai/schemas";
import { AI_TASKS, type AiTaskOutput } from "@/lib/ai/tasks";
import {
  indexResume,
  isFaithfulRewrite,
  verifyContentAnalysis,
  verifyMatchAssessment,
} from "@/lib/ai/verify";

import { JOB_FIXTURES } from "../../fixtures/jobs/jobs";
import { cleanResume, setBullets, draft } from "../../support/ats";

function request<K extends keyof typeof AI_TASKS>(
  task: K,
  data: unknown,
): AiRequest<AiTaskOutput[K]> {
  return {
    task,
    instructions: AI_TASKS[task].instructions,
    data,
    schema: AI_TASKS[task].schema as unknown as z.ZodType<AiTaskOutput[K]>,
    maxOutputTokens: AI_TASKS[task].maxOutputTokens,
  };
}

function weakResume() {
  const d = draft();
  setBullets(d, [
    "Responsible for the checkout service and its daily operations",
    "Worked on the data pipeline with the analytics team",
    "Led a team of 6 engineers to rebuild billing, cutting latency by 40%",
  ]);
  return d.parsed;
}

describe("mock provider", () => {
  const mock = createMockProvider();

  it("answers every task with schema-valid, deterministic output", async () => {
    const resume = compactResume(weakResume());
    const first = await mock.complete(request("analyzeContent", { resume }));
    const second = await mock.complete(request("analyzeContent", { resume }));
    expect(first.data).toEqual(second.data);
    expect(ContentAnalysisSchema.safeParse(first.data).success).toBe(true);
    expect(first.usage.inputTokens).toBeGreaterThan(0);

    const job = await mock.complete(
      request("extractJobRequirements", { jobDescription: JOB_FIXTURES[0]!.load() }),
    );
    expect(job.data.hardSkills.map((s) => s.name)).toEqual(
      expect.arrayContaining(["Go", "Python"]),
    );
  });

  it("quotes the resume verbatim and rewrites faithfully, so verification keeps it all", async () => {
    const parsed = weakResume();
    const index = indexResume(parsed);
    const { data } = await mock.complete(
      request("analyzeContent", { resume: compactResume(parsed) }),
    );
    expect(data.bulletFindings.length).toBeGreaterThan(0);
    const { count } = verifyContentAnalysis(data, index);
    expect(count.dropped).toBe(0);

    const assessment = await mock.complete(
      request("assessMatch", {
        resume: compactResume(parsed),
        requirements: [
          { name: "Data Pipelines", importance: "required" },
          { name: "Rust", importance: "required" },
        ],
        responsibilities: ["Operate the checkout service in production"],
      }),
    );
    expect(assessment.data.coverage.map((c) => [c.requirement, c.covered])).toEqual([
      ["Data Pipelines", "partial"],
      ["Rust", "no"],
    ]);
    expect(verifyMatchAssessment(assessment.data, index).count.dropped).toBe(0);
  });

  it("rewrites without inventing facts", () => {
    const index = indexResume(cleanResume());
    expect(mockRewrite("Responsible for the checkout service")).toBe(
      "Delivered the checkout service, improving [metric] by [X %].",
    );
    expect(
      isFaithfulRewrite(mockRewrite("Worked on Kubernetes clusters for the team"), index),
    ).toBe(true);
  });
});

describe("OpenAI provider", () => {
  const valid = {
    overallQuality: 72,
    sectionQuality: { summary: 70, experience: 75, skills: null, projects: null },
    bulletFindings: [],
    possibleTypos: [],
    recommendations: [],
  };
  const response = (text: string, extra: Record<string, unknown> = {}) => ({
    output_text: text,
    status: "completed",
    usage: { input_tokens: 1_000, output_tokens: 200 },
    output: [{ type: "message", content: [{ type: "output_text", text }] }],
    ...extra,
  });

  function provider(create: ReturnType<typeof vi.fn>, model = "gpt-4.1-mini") {
    return createOpenAiProvider({
      apiKey: "test",
      model,
      timeoutMs: 1_000,
      client: { responses: { create } } as never,
    });
  }

  it("asks for strict structured output with the system prompt and untrusted data framing", async () => {
    const create = vi.fn().mockResolvedValue(response(JSON.stringify(valid)));
    const result = await provider(create).complete(
      request("analyzeContent", { resume: "R" }),
    );

    expect(result).toMatchObject({
      data: valid,
      repaired: false,
      usage: { inputTokens: 1_000, outputTokens: 200 },
    });
    const [params] = create.mock.calls[0]!;
    expect(params).toMatchObject({
      model: "gpt-4.1-mini",
      store: false,
      temperature: 0,
      max_output_tokens: AI_TASKS.analyzeContent.maxOutputTokens,
      text: { format: { type: "json_schema", name: "analyzeContent", strict: true } },
    });
    expect(params.instructions.startsWith(SYSTEM_PROMPT)).toBe(true);
    expect(params.input).toContain("untrusted content");
    expect(params.input).toContain('{"data":{"resume":"R"}}');
  });

  it("leaves out temperature for reasoning models", async () => {
    expect(supportsTemperature("gpt-4.1-mini")).toBe(true);
    expect(supportsTemperature("gpt-5-mini")).toBe(false);
    expect(supportsTemperature("o4-mini")).toBe(false);
    const create = vi.fn().mockResolvedValue(response(JSON.stringify(valid)));
    await provider(create, "gpt-5-mini").complete(request("analyzeContent", {}));
    expect(create.mock.calls[0]![0]).not.toHaveProperty("temperature");
  });

  it("repairs once when the answer fails validation, then succeeds", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(response(JSON.stringify({ ...valid, overallQuality: 140 })))
      .mockResolvedValueOnce(response(JSON.stringify(valid)));
    const result = await provider(create).complete(request("analyzeContent", {}));
    expect(result.repaired).toBe(true);
    expect(result.usage).toEqual({ inputTokens: 2_000, outputTokens: 400 });
    expect(create.mock.calls[1]![0].input).toMatch(
      /did not match the required schema \(overallQuality: /,
    );
  });

  it("gives up after two invalid answers, reporting the tokens spent", async () => {
    const create = vi
      .fn()
      .mockResolvedValue(response("{ not json", { status: "incomplete" }));
    await expect(
      provider(create).complete(request("analyzeContent", {})),
    ).rejects.toMatchObject({
      kind: "invalid_output",
      usage: { inputTokens: 2_000, outputTokens: 400 },
    });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("maps refusals, timeouts and bad credentials to typed failures", async () => {
    const refusal = vi.fn().mockResolvedValue(
      response("", {
        output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }],
      }),
    );
    await expect(
      provider(refusal).complete(request("analyzeContent", {})),
    ).rejects.toMatchObject({ kind: "refused" });

    const timeout = vi.fn().mockRejectedValue(new APIConnectionTimeoutError());
    await expect(
      provider(timeout).complete(request("analyzeContent", {})),
    ).rejects.toMatchObject({ kind: "timeout" });

    const auth = vi
      .fn()
      .mockRejectedValue(new AuthenticationError(401, {}, "bad key", new Headers()));
    const failure = provider(auth).complete(request("analyzeContent", {}));
    await expect(failure).rejects.toBeInstanceOf(AiError);
    await expect(failure).rejects.toMatchObject({ kind: "config" });
  });
});
