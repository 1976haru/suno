import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * TASK v3.71 (TASK A) — a separate build config (never touches `npm run
 * dev`/`npm run build`, which keep using vite.config.ts unchanged) that
 * inlines the whole app into one offline HTML file: no server, no Node, no
 * internet required to run it — only to build it once.
 *
 * Deliberately excludes devApiPlugin (vite.config.ts's /api/* dev-server
 * mount for the realtime/Batch LLM providers) — this build has no server at
 * all once it leaves the build machine, so there is nothing to mount it
 * onto. The app's own IS_SINGLE_FILE_BUILD flag (src/core/buildFlags.ts,
 * injected via `define` below) hides the UI entry points that would call
 * those endpoints instead of leaving them to fail silently at runtime.
 */
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  define: {
    __SINGLE_FILE_BUILD__: 'true'
  },
  build: {
    outDir: 'dist-single',
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 10_000
  }
});
