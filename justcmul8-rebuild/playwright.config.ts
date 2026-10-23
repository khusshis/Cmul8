import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

// Load .env.test.local (gitignored) without adding a dotenv dependency.
try {
  const raw = readFileSync(path.join(__dirname, ".env.test.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* no local env file: auth-required specs will skip */ }

// Next 16 allows only one dev server per project dir. Other agents already run one on
// :3000, so reuse it rather than spawning a second (which Next refuses). Override with E2E_PORT.
export const PORT = Number(process.env.E2E_PORT) || 3000;
// E2E_BASE_URL runs the suite against a deployed site (no local dev server).
export const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;
export const hasCreds = !!(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
export const hasSecondUser = !!(process.env.E2E_EMAIL_2 && process.env.E2E_PASSWORD_2);

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/cleanup.ts",
  globalTeardown: "./tests/e2e/cleanup.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "tests/e2e/.report" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "tests/e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: "pipe",
  },
});
