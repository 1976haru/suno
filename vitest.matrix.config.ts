import { defineConfig } from 'vitest/config';

/**
 * TASK (workspace contract matrix) — separate vitest config so
 * tests/workspaceContractMatrix.test.ts runs ONLY via its own
 * `npm run test:matrix` script, never via plain `vitest run`/`npm test`
 * (which uses the main vitest.config.ts, whose own `exclude` keeps this
 * file out) nor via `npm run test:fast` (which never lists it). A single
 * shared config can't express "explicitly runnable by path, but never
 * picked up by a broad include glob" — vitest resolves a CLI path argument
 * against `include`/`exclude` first, so an excluded file can't be re-added
 * by naming it on the command line. Two configs sidesteps that entirely.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/workspaceContractMatrix.test.ts'],
    testTimeout: 30000
  }
});
