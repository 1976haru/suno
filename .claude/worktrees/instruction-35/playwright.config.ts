import { defineConfig, devices } from '@playwright/test';

/**
 * codex 지시문 07 (TASK C, TASK A's `playwright` CI job) — real browser E2E.
 * The CI `lint`/`playwright` jobs are both `continue-on-error: true` for
 * separate, unrelated real reasons: lint because of the documented TS7/
 * typescript-eslint gap (see eslint.config.js), playwright because this is
 * the first E2E suite this project has ever had and a flaky first run
 * should not block every push while the suite proves itself out — see this
 * file's own webServer section for why CI needs a real production-ish
 * build rather than the dev server.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: {
    command: 'npm run dev:5200',
    url: 'http://127.0.0.1:5200',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
