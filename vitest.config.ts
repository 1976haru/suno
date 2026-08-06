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
    // its own `npm run test:matrix` (see package.json), which passes this
    // exact file path as an explicit CLI filter and so still finds it
    // despite this exclude (vitest resolves an explicit path argument
    // against the filesystem first, before applying `exclude`).
    // Spreads vitest's own configDefaults.exclude (node_modules/dist/.git/
    // etc.) rather than replacing it, so this addition never re-enables
    // scanning any of those default-excluded paths.
    exclude: [...configDefaults.exclude, 'tests/workspaceContractMatrix.test.ts'],
    // TASK E1 (v3.7) — S4 (production stress test) exhaustively generates
    // one song per genre x language x season combination; on a loaded CI
    // runner this measured 11s+, over the 5s default. This is a slow-machine
    // flake, not a logic bug — raise the timeout rather than sample fewer
    // combinations, since the whole point of S4 is exhaustive coverage.
    testTimeout: 30000
  }
});
