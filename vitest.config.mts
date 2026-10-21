import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/support/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: ["tests/support/setup-env.ts"],
    // The first run downloads a MongoDB binary for the in-memory test database.
    hookTimeout: 120_000,
    // Integration tests parse real PDFs in parallel files; a cold pdf.js load under that
    // load can take several seconds, past Vitest's 5 s default.
    testTimeout: 30_000,
  },
});
