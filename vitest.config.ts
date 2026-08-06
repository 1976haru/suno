import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // TASK (workspace contract matrix) — the doc's own explicit instruction
    // ("행렬 테스트를 전체 테스트에 합치지 말 것") is kept out of BOTH
    // test:fast (never added to that script's file list) AND the default
    // `npm test` (plain `vitest run`, which otherwise globs every
    // tests/**/*.test.ts file above, including this one) — run it only via
    // its own `npm run test:matrix` (see package.json), via a SEPARATE
    // vitest.matrix.config.ts whose own `include` names only this file.
    //
    // CORRECTION (CI test-tier split, verified against vitest 4.1.10) — an
    // earlier version of this comment claimed an explicit CLI path bypasses
    // `exclude` ("vitest resolves an explicit path argument against the
    // filesystem first, before applying exclude"). That is NOT what this
    // vitest version actually does: `npx vitest run tests/workspaceContractMatrix.test.ts`
    // under THIS config prints "No test files found, exiting with code 1" —
    // exclude wins over an explicit CLI path here. The reason test:matrix
    // has always worked is the separate config file, not CLI-path magic;
    // vitest.stress.config.ts (see test:stress) uses the identical pattern
    // for the same reason. Spreads vitest's own configDefaults.exclude
    // (node_modules/dist/.git/ etc.) rather than replacing it, so this
    // addition never re-enables scanning any of those default-excluded
    // paths.
    //
    // TASK (CI test-tier split) — every tests/stress* file (stress.test.ts,
    // stress-opening.test.ts, stress-production.test.ts, stress-v314.test.ts)
    // gets the same treatment: each is individually slow (7-25s in
    // isolation, measurably worse under the CPU contention of a full
    // parallel `vitest run`) and belongs to `npm run test:stress` (its own
    // vitest.stress.config.ts), never plain `npm test` (which CI's `unit`
    // job runs and which the task requires stay fast and non-flaky).
    // Verified need, not a guess: running the full untrimmed suite produced
    // real, reproducible failures purely from contention —
    // stress-production.test.ts's S4 timed out past its 30s default, and
    // stress.test.ts's own S1 (<50ms budget) tipped over to 52ms — neither
    // is a logic bug, both are exactly the "genuine timeout" class of
    // failure this whole task exists to fix. A glob (not 4 literal paths)
    // so any future tests/stress-*.test.ts file added later is excluded by
    // the same rule without this file needing another edit.
    // NOTE (CI test-tier split) — 'tests/providerResponseFixtures.test.ts'
    // joined vitest.matrix.config.ts's own `include` alongside
    // workspaceContractMatrix.test.ts (a concurrent sibling change, same
    // matrix-tier reasoning as that file's own header comment); mirrored
    // here so it gets the identical main-suite exclusion — without this it
    // would run under BOTH `npm test` and `npm run test:matrix`, which is
    // exactly the double-running/leak this exclude list exists to prevent.
    exclude: [...configDefaults.exclude, 'tests/workspaceContractMatrix.test.ts', 'tests/providerResponseFixtures.test.ts', 'tests/stress*.test.ts'],
    // TASK E1 (v3.7) — S4 (production stress test) exhaustively generates
    // one song per genre x language x season combination; on a loaded CI
    // runner this measured 11s+, over the 5s default. This is a slow-machine
    // flake, not a logic bug — raise the timeout rather than sample fewer
    // combinations, since the whole point of S4 is exhaustive coverage.
    testTimeout: 30000
  }
});
