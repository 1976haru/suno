/**
 * TASK v3.71 (TASK A) — the single-file offline build (`npm run build:single`,
 * vite.config.single.ts) has no server behind it once it leaves the build
 * machine: no `/api/*` dev-proxy (vite.config.ts's devApiPlugin only exists
 * for `npm run dev`), and nothing to deploy api/*.js to either. Any UI path
 * that calls those endpoints (realtime generation, the concept agent's API
 * mode, AI evaluation, lyric translation via API) would otherwise fail with
 * an opaque network error at click time. `IS_SINGLE_FILE_BUILD` lets the UI
 * hide/disable those entry points instead, with a clear "개발 서버에서만
 * 동작합니다" message — never delete the feature, never silently no-op it.
 *
 * `__SINGLE_FILE_BUILD__` is `true` only under vite.config.single.ts's own
 * `define` (see vite-env.d.ts); it's `undefined` under the normal
 * `npm run dev`/`npm run build` config, which is why this checks truthiness
 * rather than assuming the global always exists.
 */
export const IS_SINGLE_FILE_BUILD: boolean = typeof __SINGLE_FILE_BUILD__ !== 'undefined' && __SINGLE_FILE_BUILD__ === true;

/** Standard message for a disabled API-only control in the single-file build. */
export const SINGLE_FILE_API_DISABLED_MESSAGE = '이 기능은 개발 서버(npm run dev)에서만 동작합니다. 독립 실행 HTML에서는 API 호출이 불가능합니다 — Claude Code/Codex 브릿지 지시문을 사용하세요.';
