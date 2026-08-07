import { defineConfig } from 'vitest/config';

/**
 * codex 지시문 07 (TASK D) — same "separate config, not CLI-path magic"
 * pattern as vitest.matrix.config.ts/vitest.stress.config.ts (see either
 * file's own doc comment for why a single shared config can't express
 * "explicitly runnable by path, but never picked up by a broad include
 * glob" under this vitest version). tests/apiIntegration*.test.ts runs
 * ONLY via `npm run test:api-integration`, matching TASK A's own listed
 * `api-integration` CI job — never doubled up inside plain `npm test`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/apiIntegration*.test.ts'],
    testTimeout: 30000
  }
});
