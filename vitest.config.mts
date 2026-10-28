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
    // npm run test:coverage — docs/TESTING.md. The engines carry the score, so they are
    // held to 90 % of lines; browser-only code is covered by the E2E suite instead.
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: [
        // Auth.js wiring and Server Component helpers run only inside Next.js (E2E).
        "src/lib/auth/auth.ts",
        "src/lib/auth/current-owner.ts",
        // XHR upload with progress events; exercised in the browser.
        "src/lib/client/upload-resume.ts",
      ],
      reporter: ["text-summary", "json-summary", "html"],
      reportsDirectory: "coverage",
      thresholds: {
        lines: 90,
        functions: 90,
        "src/lib/ats/**": { lines: 95 },
        "src/lib/matching/**": { lines: 95 },
        "src/lib/parsing/**": { lines: 90 },
        "src/lib/ai/**": { lines: 90 },
      },
    },
  },
});
