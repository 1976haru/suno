import { CURRENT_SCHEMA_VERSION } from './schemaVersion';

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

/**
 * v5.14 — same `define`-time injection as APP_VERSION/COMMIT_SHA above
 * (`__BUILD_TIME__`, set from `new Date().toISOString()` at Vite config
 * eval time — see vite.config.ts/vite.config.single.ts). Deliberately
 * reuses this app's existing `define`-based injection mechanism rather than
 * introducing a parallel `import.meta.env.VITE_*` path for the same
 * purpose — Vitest never runs through Vite's build pipeline either, so this
 * is genuinely 'dev' outside a real `npm run build`/`build:single`.
 */
export const BUILT_AT: string = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev';

/** "v4.0.0 (e43faa1)" — the exact display format this task's spec asks for. */
export const APP_VERSION_LABEL = `v${APP_VERSION} (${COMMIT_SHA})`;

/**
 * v5.14 — single-object form of this module's version identifiers, for call
 * sites that want the whole bundle at once (export/backup meta, CSV
 * headers, the app's own version display) instead of importing each piece
 * separately. `schemaVersion` reuses schemaVersion.ts's
 * CURRENT_SCHEMA_VERSION — the same number that already travels as
 * exportMeta.ts's EXPORT_SCHEMA_VERSION in every export — rather than
 * inventing a second schema-version constant.
 */
export const BUILD_INFO = {
  appVersion: APP_VERSION,
  schemaVersion: CURRENT_SCHEMA_VERSION,
  commitSha: COMMIT_SHA,
  builtAt: BUILT_AT
} as const;
