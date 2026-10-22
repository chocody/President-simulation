import { defineConfig } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 360, height: 740 },
    locale: "th-TH",
    launchOptions: {
      // Chromium is pre-installed outside Playwright's cache. Never run `playwright install`.
      executablePath: process.env.PS_CHROMIUM ?? "/opt/pw-browsers/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    // Build once, then serve. DEV_FIXTURES=1 enables the invented dev country; PS_SEED makes the run repeatable.
    command: `pnpm exec next build && pnpm exec next start -p ${PORT} -H 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/api/game/info`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: { DEV_FIXTURES: "1", PS_SEED: "e2e-seed-1" },
  },
});
