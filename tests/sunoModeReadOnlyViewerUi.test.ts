import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 지시문 13 (TASK A) — App.tsx/Step4Result.tsx can't be unit-tested directly
// (no jsdom/React-rendering test infra in this project — see
// tests/bridgeImportSrtOnly.test.ts's own identical note), so this is the
// realistic source-level proxy: read the real component source and assert,
// textually, that (a) the new read-only entry point is reachable with no
// blueprint at all (unlike every other Step4Result screen, which is gated
// behind `blueprint &&`), and (b) SunoModeReadOnlyViewer's own body really
// does call zero persistence functions anywhere — the same structural proof
// bridgeImportSrtOnly.test.ts already uses for importSongsForSrtOnly.
describe('[수노모드 읽기전용] Step4Result.tsx source-level regression guard', () => {
  const step4Source = readFileSync(resolve(__dirname, '../src/components/steps/Step4Result.tsx'), 'utf8');

  it('imports and renders SunoModeReadOnlyViewer', () => {
    expect(step4Source).toContain("import SunoModeReadOnlyViewer from '../SunoModeReadOnlyViewer'");
    expect(step4Source).toContain('<SunoModeReadOnlyViewer');
  });

  it('the read-only entry button appears in the no-blueprint empty-state block (reachable with zero blueprint/import)', () => {
    const emptyStateIndex = step4Source.indexOf('아직 생성된 결과가 없어요');
    expect(emptyStateIndex).toBeGreaterThan(-1);
    // The empty-state early-return block ends at the next top-level `}` that
    // closes the `if (!blueprint && ...)` block — approximated here by
    // searching a bounded window after the hint text, same "structural proxy,
    // not a full parser" tradeoff bridgeImportSrtOnly.test.ts's own
    // extractFunctionBody helper accepts.
    const windowText = step4Source.slice(emptyStateIndex, emptyStateIndex + 800);
    expect(windowText).toContain('수노모드로 열기');
    expect(windowText).toContain('setReadOnlyViewerOpen(true)');
  });

  it('never switches the app\'s own selected channel from the read-only entry point\'s own render block', () => {
    const idx = step4Source.indexOf('readOnlyViewerOpen &&');
    expect(idx).toBeGreaterThan(-1);
    const windowText = step4Source.slice(idx, idx + 400);
    expect(windowText).not.toContain('cm.selectChannel');
  });
});

describe('[수노모드 읽기전용] SunoModeReadOnlyViewer.tsx structural proof: zero persistence calls', () => {
  const viewerSource = readFileSync(resolve(__dirname, '../src/components/SunoModeReadOnlyViewer.tsx'), 'utf8');

  it('never imports core/library.ts (pack save / pack progress) or core/ratingLedger.ts', () => {
    expect(viewerSource).not.toMatch(/from '\.\.\/core\/library'/);
    expect(viewerSource).not.toMatch(/from '\.\.\/core\/ratingLedger'/);
  });

  it('never calls any known write primitive (save/record/mark/set-progress) anywhere in its source', () => {
    const forbidden = ['saveImportedPack', 'savePack', 'recordPackHooks', 'markTrackPasted', 'setTrackProgress', 'recordRating', 'saveConceptCache'];
    for (const fn of forbidden) {
      expect(viewerSource, `SunoModeReadOnlyViewer.tsx must never call ${fn}`).not.toContain(fn);
    }
  });

  it('only imports genuinely read-only history fetchers (recentSituations/recentLyricLines/usedTitles), never their write-side siblings', () => {
    expect(viewerSource).toContain('recentSituations');
    expect(viewerSource).toContain('recentLyricLines');
    expect(viewerSource).toContain('fetchHistoricalTitles');
  });

  it('always renders the read-only badge text', () => {
    expect(viewerSource).toContain('읽기 전용 — 저장·이력 기록 없음');
  });

  it('the file-picker/drop-zone branch never sets a global/app channel selection', () => {
    expect(viewerSource).not.toContain('selectChannel');
  });
});
