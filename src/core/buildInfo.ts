/**
 * v4.0 (TASK C) — `__APP_VERSION__`/`__COMMIT_SHA__` only exist under Vite's
 * own `define` (vite.config.ts/vite.config.single.ts — see vite-env.d.ts);
 * Vitest never runs through Vite's build pipeline, so both globals are
 * genuinely `undefined` at runtime there despite the `string` type
 * declaration — same "check typeof before trusting the global" pattern as
 * this file's sibling, buildFlags.ts's IS_SINGLE_FILE_BUILD.
 */
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0-dev';
export const COMMIT_SHA: string = typeof __COMMIT_SHA__ !== 'undefined' ? __COMMIT_SHA__ : 'unknown';

/** "v4.0.0 (e43faa1)" — the exact display format this task's spec asks for. */
export const APP_VERSION_LABEL = `v${APP_VERSION} (${COMMIT_SHA})`;
