import { z } from "zod";

/**
 * Strict JSON schema for OpenAI structured outputs, derived from a Zod schema. Strict mode
 * needs every property listed in `required` and `additionalProperties: false`; length limits
 * aren't enforced by it, so they're left to the Zod validation every response goes through.
 */

type JsonSchema = Record<string, unknown>;

const DROPPED_KEYWORDS = new Set([
  "$schema",
  "minLength",
  "maxLength",
  "default",
  "format",
]);

function strictify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictify);
  if (!node || typeof node !== "object") return node;

  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(node as JsonSchema)) {
    if (DROPPED_KEYWORDS.has(key)) continue;
    out[key] = strictify(value);
  }
  if (out.type === "object" && out.properties && typeof out.properties === "object") {
    out.required = Object.keys(out.properties as JsonSchema);
    out.additionalProperties = false;
  }
  return out;
}

export function toStrictJsonSchema(schema: z.ZodType): JsonSchema {
  return strictify(
    z.toJSONSchema(schema, { target: "draft-7", io: "output" }),
  ) as JsonSchema;
}
