/**
 * Per-million-token prices in USD (input, output) for cost logging and the daily budget.
 * Checked against published pricing in October 2026; update when OpenAI changes prices.
 * Unknown models are costed at the highest known rate so the budget is never underestimated.
 */
const PRICES: Record<string, { input: number; output: number }> = {
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-5-mini": { input: 0.25, output: 2 },
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
};

const FALLBACK = { input: 0.75, output: 4.5 };

export function priceFor(model: string): { input: number; output: number } {
  if (model === "mock") return { input: 0, output: 0 };
  const known = Object.entries(PRICES).find(
    ([name]) => model === name || model.startsWith(`${name}-`),
  );
  return known ? known[1] : FALLBACK;
}

export function costUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = priceFor(model);
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
