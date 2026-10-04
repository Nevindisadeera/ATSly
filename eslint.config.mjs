import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Layer boundaries from docs/PLANNING.md §14.
const uiBoundary = {
  files: ["src/components/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/lib/db", "@/lib/db/*", "@/lib/ai", "@/lib/ai/*"],
            message:
              "UI code must not import the database or AI layers. Go through a service.",
          },
        ],
      },
    ],
  },
};

const domainBoundary = {
  files: [
    "src/lib/parsing/**/*.ts",
    "src/lib/ats/**/*.ts",
    "src/lib/matching/**/*.ts",
    "src/lib/taxonomy/**/*.ts",
  ],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [
              "@/lib/db",
              "@/lib/db/*",
              "@/lib/ai",
              "@/lib/ai/*",
              "@/lib/services",
              "@/lib/services/*",
              "next",
              "next/*",
            ],
            message:
              "Domain engines are pure: no database, AI, services, or Next.js imports.",
          },
        ],
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  uiBoundary,
  domainBoundary,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
