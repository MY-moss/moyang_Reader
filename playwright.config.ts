import { defineConfig } from "@playwright/test";

import { createPlaywrightRuntime } from "./scripts/playwright-runtime.mjs";

const runtime = createPlaywrightRuntime(process.cwd());

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  fullyParallel: true,
  workers: 4,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: runtime.baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/playwright-preview.mjs",
    url: runtime.healthURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
