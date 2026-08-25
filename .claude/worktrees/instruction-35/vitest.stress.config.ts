import { defineConfig } from 'vitest/config';

/**
 * TASK (CI test-tier split) — separate vitest config so every
 * tests/stress*.test.ts file runs ONLY via its own `npm run test:stress`
 * script, never via plain `vitest run`/`npm test` (which uses the main
 * vitest.config.ts, whose own `exclude` keeps `tests/stress*.test.ts` out).
 * Mirrors vitest.matrix.config.ts's own doc comment: a single shared config
 * can't express "explicitly runnable by path, but never picked up by a
 * broad include glob" in this vitest version — an excluded file's path
 * can't be re-added just by naming it on the CLI (verified: `vitest run
 * tests/workspaceContractMatrix.test.ts` under the main config prints "No
 * test files found" despite the explicit path). Two configs sidesteps that
 * entirely, same as the matrix test's own solution.
 *
 * Each stress file already carries its own per-case timeout where needed
 * (e.g. stress-production.test.ts's productionCase(..., 15_000),
 * stress-v314.test.ts's 60000ms first test) — this config's testTimeout is
 * just a floor above vitest's 5000ms default for the handful of cases that
 * don't set their own, consistent with vitest.matrix.config.ts's own 30000.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/stress*.test.ts'],
    testTimeout: 30000
  }
});
