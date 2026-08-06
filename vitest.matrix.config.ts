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
    // TASK (matrix gap-closing) — tests/providerResponseFixtures.test.ts
    // (the 12-fixture x 7-workspace provider-response matrix) is a sibling
    // of workspaceContractMatrix.test.ts: same "never picked up by npm
    // test/test:fast" isolation reasoning as this file's own header comment
    // already explains, so it's added here rather than getting a third config.
    include: ['tests/workspaceContractMatrix.test.ts', 'tests/providerResponseFixtures.test.ts'],
    testTimeout: 30000
  }
});
