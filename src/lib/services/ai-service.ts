import "server-only";

import { createHash } from "node:crypto";

import type { z } from "zod";

import { createMockProvider } from "@/lib/ai/mock-provider";
import { createOpenAiProvider } from "@/lib/ai/openai-provider";
import { costUsd } from "@/lib/ai/pricing";
import { PROMPT_VERSION } from "@/lib/ai/prompts";
import { AiError, type AiProvider, type AiTaskName } from "@/lib/ai/provider";
import { AI_TASKS, type AiTaskOutput } from "@/lib/ai/tasks";
import { env } from "@/lib/config/env";
import { aiRepository } from "@/lib/db/repositories/ai-repository";
import { logger } from "@/lib/logging/logger";
import type { ScanAiStatus } from "@/types/api";

/**
 * AI orchestration — docs/PLANNING.md §20: provider choice, cache, daily budget and
 * per-call logging (task, model, prompt version, tokens, cost, latency; never content).
 */

/** AI work in a scan must finish within this, leaving room in the route's 60 s. */
export const AI_STAGE_BUDGET_MS = 40_000;

export type AiSkipReason = "disabled" | "not_configured" | "budget";

let override: AiProvider | null | undefined;
let openai: AiProvider | null = null;

/** Tests swap the provider; pass undefined to go back to the environment's choice. */
export function setAiProviderForTests(provider: AiProvider | null | undefined) {
  override = provider;
}

/** The configured provider, or why there is none. */
export function configuredAiProvider(): AiProvider | { skipped: AiSkipReason } {
  if (override !== undefined) return override ?? { skipped: "disabled" };
  const setting = env.AI_PROVIDER ?? (env.OPENAI_API_KEY ? "openai" : "mock");
  if (setting === "off") return { skipped: "disabled" };
  if (setting === "mock") return createMockProvider();
  if (!env.OPENAI_API_KEY) return { skipped: "not_configured" };
  openai ??= createOpenAiProvider({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    timeoutMs: env.AI_TIMEOUT_MS,
  });
  return openai;
}

/** A provider when AI may run now: configured and under today's spend cap. */
export async function availableAiProvider(): Promise<
  AiProvider | { skipped: AiSkipReason }
> {
  const provider = configuredAiProvider();
  if ("skipped" in provider) return provider;
  if (
    provider.name !== "mock" &&
    (await aiRepository.spentToday()) >= env.AI_DAILY_BUDGET_USD
  ) {
    logger.warn("ai.budget_reached", { budgetUsd: env.AI_DAILY_BUDGET_USD });
    return { skipped: "budget" };
  }
  return provider;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export type TaskRun<T> = {
  data: T;
  cached: boolean;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

/**
 * Runs one AI task. With `cacheInput`, results are cached under
 * sha256(task + promptVersion + model + inputHash) — §16.5. Throws AiError on failure,
 * after recording what the failed attempt cost.
 */
export async function runAiTask<K extends AiTaskName>(
  task: K,
  data: unknown,
  options: {
    provider: AiProvider;
    cacheInput?: string;
    signal?: AbortSignal;
    log?: Record<string, unknown>;
  },
): Promise<TaskRun<AiTaskOutput[K]>> {
  const { provider } = options;
  const definition = AI_TASKS[task];
  // The task name picks the schema; TypeScript can't narrow that through the generic.
  const schema = definition.schema as unknown as z.ZodType<AiTaskOutput[K]>;
  const key = options.cacheInput
    ? sha256(`${task}|${PROMPT_VERSION}|${provider.model}|${sha256(options.cacheInput)}`)
    : null;

  if (key) {
    const cached = await aiRepository.getCached(key);
    const parsed = cached ? schema.safeParse(cached.payload) : null;
    if (parsed?.success) {
      logger.info("ai.task", {
        ...options.log,
        task,
        model: provider.model,
        promptVersion: PROMPT_VERSION,
        cacheHit: true,
      });
      return {
        data: parsed.data,
        cached: true,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
      };
    }
  }

  try {
    const result = await provider.complete({
      task,
      instructions: definition.instructions,
      data,
      schema,
      maxOutputTokens: definition.maxOutputTokens,
      signal: options.signal,
    });
    const cost = costUsd(
      provider.model,
      result.usage.inputTokens,
      result.usage.outputTokens,
    );
    await aiRepository.addSpend(cost);
    if (key) {
      await aiRepository.putCached({
        key,
        task,
        model: provider.model,
        promptVersion: PROMPT_VERSION,
        payload: result.data,
        tokens: { input: result.usage.inputTokens, output: result.usage.outputTokens },
      });
    }
    logger.info("ai.task", {
      ...options.log,
      task,
      model: provider.model,
      promptVersion: PROMPT_VERSION,
      cacheHit: false,
      validation: result.repaired ? "repaired" : "ok",
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costUsd: Number(cost.toFixed(6)),
      latencyMs: result.latencyMs,
    });
    return {
      data: result.data,
      cached: false,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costUsd: cost,
    };
  } catch (error) {
    const failure =
      error instanceof AiError ? error : new AiError("network", String(error));
    const cost = costUsd(
      provider.model,
      failure.usage.inputTokens,
      failure.usage.outputTokens,
    );
    await aiRepository.addSpend(cost).catch(() => undefined);
    logger.warn("ai.task_failed", {
      ...options.log,
      task,
      model: provider.model,
      promptVersion: PROMPT_VERSION,
      kind: failure.kind,
      costUsd: Number(cost.toFixed(6)),
    });
    throw failure;
  }
}

/**
 * One scan's AI work: a shared deadline, totals and an overall status. A failed task
 * returns null so the scan degrades instead of failing — §20 graceful degradation.
 */
export function createAiRun(provider: AiProvider, log: Record<string, unknown>) {
  const started = Date.now();
  const deadline = started + AI_STAGE_BUDGET_MS;
  const outcomes: boolean[] = [];
  const usage = { promptTokens: 0, completionTokens: 0, costUsd: 0 };

  return {
    provider,
    usage,
    async run<K extends AiTaskName>(
      task: K,
      data: unknown,
      cacheInput?: string,
    ): Promise<AiTaskOutput[K] | null> {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        outcomes.push(false);
        logger.warn("ai.task_failed", { ...log, task, kind: "timeout" });
        return null;
      }
      try {
        const result = await runAiTask(task, data, {
          provider,
          cacheInput,
          signal: AbortSignal.timeout(remaining),
          log,
        });
        usage.promptTokens += result.inputTokens;
        usage.completionTokens += result.outputTokens;
        usage.costUsd += result.costUsd;
        outcomes.push(true);
        return result.data;
      } catch {
        outcomes.push(false);
        return null;
      }
    },
    status(): ScanAiStatus {
      if (outcomes.length === 0) return "skipped";
      if (outcomes.every(Boolean)) return "complete";
      return outcomes.some(Boolean) ? "partial" : "failed";
    },
    latencyMs: () => Date.now() - started,
  };
}
