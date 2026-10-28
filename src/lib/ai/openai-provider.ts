import "server-only";

import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
} from "openai";
import type { z } from "zod";

import { toStrictJsonSchema } from "./json-schema";
import { dataMessage, SYSTEM_PROMPT } from "./prompts";
import {
  AiError,
  type AiFailureKind,
  type AiProvider,
  type AiRequest,
  type AiResult,
} from "./provider";

/**
 * OpenAI provider — docs/PLANNING.md §20: Responses API with strict structured outputs.
 * The SDK retries once on network errors, 429 and 5xx with backoff; a response that fails
 * Zod validation gets one repair attempt that names the problems.
 */

type ResponsesClient = Pick<OpenAI, "responses">;

/** Reasoning models (o-series, GPT-5) don't accept a sampling temperature. */
export function supportsTemperature(model: string): boolean {
  return !/^(?:o\d|gpt-5)/.test(model);
}

function failureKind(error: unknown): AiFailureKind {
  if (error instanceof APIConnectionTimeoutError || error instanceof APIUserAbortError)
    return "timeout";
  if (error instanceof APIConnectionError) return "network";
  if (error instanceof APIError) {
    const status = error.status ?? 0;
    return status === 400 || status === 401 || status === 403 || status === 404
      ? "config"
      : "network";
  }
  if (error instanceof Error && error.name === "AbortError") return "timeout";
  return "network";
}

function issuesSummary(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

export function createOpenAiProvider(options: {
  apiKey: string;
  model: string;
  timeoutMs: number;
  client?: ResponsesClient;
}): AiProvider {
  const client: ResponsesClient =
    options.client ??
    new OpenAI({ apiKey: options.apiKey, timeout: options.timeoutMs, maxRetries: 1 });
  const { model } = options;

  return {
    name: "openai",
    model,
    async complete<T>(request: AiRequest<T>): Promise<AiResult<T>> {
      const started = Date.now();
      const usage = { inputTokens: 0, outputTokens: 0 };
      const format = {
        type: "json_schema" as const,
        name: request.task,
        schema: toStrictJsonSchema(request.schema),
        strict: true,
      };
      let input = dataMessage(request.data);

      for (let attempt = 0; attempt < 2; attempt += 1) {
        let response;
        try {
          response = await client.responses.create(
            {
              model,
              instructions: `${SYSTEM_PROMPT}\n\n${request.instructions}`,
              input,
              text: { format },
              max_output_tokens: request.maxOutputTokens,
              store: false,
              ...(supportsTemperature(model) ? { temperature: 0 } : {}),
            },
            { signal: request.signal },
          );
        } catch (error) {
          throw new AiError(failureKind(error), `${request.task}: request failed`, usage);
        }

        usage.inputTokens += response.usage?.input_tokens ?? 0;
        usage.outputTokens += response.usage?.output_tokens ?? 0;

        const refused = response.output?.some(
          (item) =>
            item.type === "message" &&
            item.content.some((part) => part.type === "refusal"),
        );
        if (refused)
          throw new AiError("refused", `${request.task}: the model refused`, usage);

        let parsed: unknown = null;
        try {
          parsed = JSON.parse(response.output_text);
        } catch {
          // Truncated or empty output; handled as a validation failure below.
        }
        const result = request.schema.safeParse(parsed);
        if (result.success && response.status !== "incomplete") {
          return {
            data: result.data,
            usage,
            latencyMs: Date.now() - started,
            repaired: attempt > 0,
          };
        }
        const problems = result.success
          ? "the answer was cut off before it finished"
          : issuesSummary(result.error);
        input = `${dataMessage(request.data)}\n\nYour previous answer did not match the required schema (${problems}). Answer again with JSON that matches the schema exactly.`;
      }
      throw new AiError(
        "invalid_output",
        `${request.task}: output failed validation twice`,
        usage,
      );
    },
  };
}
