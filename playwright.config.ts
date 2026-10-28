import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      // Local MongoDB (data in .data/mongo); an already-running MongoDB on 27017 is reused.
      command: "npm run db:local",
      port: 27017,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // CI runs against a production build; locally the dev server is reused if running.
      command: process.env.CI ? "npm run start" : "npm run dev",
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        MONGODB_URI: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/atsly",
        AUTH_SECRET:
          process.env.AUTH_SECRET ?? "e2e-only-secret-for-signing-cookies-0123456789",
        // The deterministic offline provider, so tests never call (or pay for) a real model.
        AI_PROVIDER: process.env.AI_PROVIDER ?? "mock",
      },
    },
  ],
});
