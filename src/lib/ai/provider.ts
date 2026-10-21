import type { z } from "zod";

/**
 * The AI provider interface — docs/PLANNING.md §20. Small on purpose, so another vendor can
 * be added without touching services.
 */

export type AiTaskName = "extractJobRequirements" | "analyzeContent" | "assessMatch";

export type AiRequest<T> = {
  task: AiTaskName;
  /** Task instructions; the shared system prompt is added by the provider. */
  instructions: string;
  /** Structured task data. The OpenAI provider sends it as an untrusted JSON data block. */
  data: unknown;
  schema: z.ZodType<T>;
  maxOutputTokens: number;
  signal?: AbortSignal;
};

export type AiUsage = { inputTokens: number; outputTokens: number };

export type AiResult<T> = {
  data: T;
  usage: AiUsage;
  latencyMs: number;
  /** The first answer failed validation and a repair attempt succeeded. */
  repaired: boolean;
};

export interface AiProvider {
  readonly name: "openai" | "mock";
  readonly model: string;
  complete<T>(request: AiRequest<T>): Promise<AiResult<T>>;
}

export type AiFailureKind =
  "timeout" | "network" | "invalid_output" | "refused" | "config";

/** A task that produced no usable result. Callers degrade instead of failing the scan. */
export class AiError extends Error {
  readonly kind: AiFailureKind;
  /** Tokens spent before failing, so the budget still counts them. */
  readonly usage: AiUsage;
  constructor(
    kind: AiFailureKind,
    message: string,
    usage: AiUsage = { inputTokens: 0, outputTokens: 0 },
  ) {
    super(message);
    this.name = "AiError";
    this.kind = kind;
    this.usage = usage;
  }
}
