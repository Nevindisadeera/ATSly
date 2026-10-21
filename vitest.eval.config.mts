import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * AI evals — docs/PLANNING.md §21 (npm run eval:ai). Separate from the unit and integration
 * suites: with AI_PROVIDER=openai and OPENAI_API_KEY set it calls the real model and costs
 * money; otherwise it runs against the offline mock provider.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/support/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/evals/**/*.eval.ts"],
    setupFiles: ["tests/support/setup-env.ts"],
    testTimeout: 900_000,
    hookTimeout: 900_000,
  },
});
