/**
 * TASK v5.20 (독립 수노모드 뷰어, TASK A-1) — one-time CLI build for the
 * standalone, data-free "suno-mode.html" viewer (core/standaloneProgressExport.ts's
 * buildSunoViewerHtml). Run once, hand the output file to the user — it
 * works forever after that regardless of app rebuilds/redeploys, since it
 * carries zero pack data and loads a lyrics/*.json file at runtime via
 * FileReader (never fetch, never a live import of any other app module).
 *
 * Usage:
 *   npm run build:suno-viewer
 *   npx tsx scripts/buildSunoViewer.ts [outDir]   (outDir defaults to dist-viewer)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildSunoViewerHtml, SUNO_VIEWER_FILE_NAME, SUNO_VIEWER_VERSION } from '../src/core/sunoViewerExport';

const outDir = path.resolve(process.cwd(), process.argv[2] || 'dist-viewer');
const outPath = path.join(outDir, SUNO_VIEWER_FILE_NAME);

fs.mkdirSync(outDir, { recursive: true });
const html = buildSunoViewerHtml();
fs.writeFileSync(outPath, html, 'utf8');

const sizeKb = Buffer.byteLength(html, 'utf8') / 1024;
console.log(`[build:suno-viewer] ${SUNO_VIEWER_FILE_NAME} (v${SUNO_VIEWER_VERSION}) -> ${outPath}`);
console.log(`[build:suno-viewer] size: ${sizeKb.toFixed(1)} KB`);
if (sizeKb > 300) {
  console.warn(`[build:suno-viewer] WARNING: exceeds the 300KB target (${sizeKb.toFixed(1)} KB).`);
  process.exitCode = 1;
}
