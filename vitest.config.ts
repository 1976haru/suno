import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // TASK E1 (v3.7) — S4 (production stress test) exhaustively generates
    // one song per genre x language x season combination; on a loaded CI
    // runner this measured 11s+, over the 5s default. This is a slow-machine
    // flake, not a logic bug — raise the timeout rather than sample fewer
    // combinations, since the whole point of S4 is exhaustive coverage.
    testTimeout: 30000
  }
});
