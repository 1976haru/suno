/// <reference types="vite/client" />

/** TASK v3.71 (TASK A) — injected via vite.config.single.ts's `define`; undefined (not false) under the normal npm run dev/build config. See src/core/buildFlags.ts for the safe-to-import-anywhere boolean. */
declare const __SINGLE_FILE_BUILD__: boolean | undefined;

/** v4.0 (TASK C) — injected via vite.config.ts/vite.config.single.ts's `define` (package.json's own version / `git rev-parse --short HEAD`). See src/core/buildInfo.ts for the safe-to-import-anywhere accessor. */
declare const __APP_VERSION__: string;
declare const __COMMIT_SHA__: string;

/** v5.14 — same injection mechanism, `new Date().toISOString()` read once at Vite config eval time. See src/core/buildInfo.ts's BUILT_AT. */
declare const __BUILD_TIME__: string;
