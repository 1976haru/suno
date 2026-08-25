import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importSongsForSrtOnly, importSongsJson } from '../src/core/claudeCodeBridge';
import { savePack, listPacks, deleteAllPacks } from '../src/core/library';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

function songJson(count: number, overrides: Partial<Record<string, unknown>> = {}) {
  return JSON.stringify({
    songs: Array.from({ length: count }, (_, i) => ({
      trackNo: i + 1,
      title: `Song ${i + 1}`,
      hookPhrase: `Hook ${i + 1}`,
      stylePrompt: `warm acoustic pop, mood ${i}, instrument ${i}, vocal ${i}, hook device ${i}, ${90 + i} BPM`,
      lyrics: `[verse 1]\nline a ${i}\nline b ${i}\n\n[chorus]\nHook ${i + 1}\nHook ${i + 1}\nHook ${i + 1}\n\n[end]`,
      seasonMoment: 'x',
      listenerSituation: 'x',
      emotionArc: 'x',
      youtube: { title: 'yt', description: 'desc', tags: ['tag'] },
      ...overrides
    }))
  });
}

// TASK (read-only SRT import) — importSongsForSrtOnly is the fix for a real,
// confirmed bug: App.tsx's SRT-focused import entry point used to delegate
// straight into the same pipeline a real import uses (importSongsJson feeding
// handleGenerationSuccess's hookLedger registration + library.saveImportedPack),
// even though that entry point's own purpose is display-only. These tests
// cover (a) importSongsForSrtOnly parses a real lyrics JSON into displayable
// SongIdea objects with real lyrics/trackNo, using the SAME real parsing
// primitives importSongsJson uses, and (b) a real before/after reproduction of
// the persistence side effects using the actual production primitives
// (library.savePack, hookLedger.recordPackHooks) the App.tsx write path calls
// under the hood — proving the SRT-only path never reaches them while the
// regular pipeline's own primitives still work exactly as before.
describe('[read-only SRT import] importSongsForSrtOnly parses real lyrics JSON for display', () => {
  it('parses songs into SongIdea-shaped objects with real lyrics, titles, and 1..N trackNo', () => {
    const opts = makeOptions({ songCount: 3 });
    const { songs, warnings } = importSongsForSrtOnly(songJson(3), opts);

    expect(warnings).toEqual([]);
    expect(songs).toHaveLength(3);
    expect(songs.map(s => s.trackNo)).toEqual([1, 2, 3]);
    songs.forEach((song, i) => {
      expect(song.title).toBe(`Song ${i + 1}`);
      expect(song.lyrics).toContain(`Hook ${i + 1}`);
      expect(song.hookPhrase).toBe(`Hook ${i + 1}`);
    });
  });

  it('renumbers out-of-order/gappy trackNo claims to a clean 1..N sequence, same as importSongsJson', () => {
    const opts = makeOptions({ songCount: 2 });
    const raw = JSON.stringify({
      songs: [
        { trackNo: 9, title: 'B', hookPhrase: 'Hook B', stylePrompt: 'x', lyrics: '[chorus]\nHook B' },
        { trackNo: 2, title: 'A', hookPhrase: 'Hook A', stylePrompt: 'x', lyrics: '[chorus]\nHook A' }
      ]
    });
    const { songs } = importSongsForSrtOnly(raw, opts);
    expect(songs.map(s => s.trackNo)).toEqual([1, 2]);
    expect(songs.map(s => s.title)).toEqual(['A', 'B']);
  });

  it('resolves effectiveArchetype/workspaceId with no slot plan at all (the no-slot fallback branch)', () => {
    const opts = makeOptions({ songCount: 1 });
    const { songs } = importSongsForSrtOnly(songJson(1), opts);
    expect(songs[0].effectiveArchetype).toBe(opts.channel.archetype);
    expect(songs[0].workspaceId).toBeTruthy();
  });

  it('collects a warning per invalid entry instead of throwing, and skips it from the returned songs', () => {
    const opts = makeOptions({ songCount: 2 });
    const raw = JSON.stringify({
      songs: [
        { trackNo: 1, title: 'Missing lyrics', hookPhrase: 'Hook 1', stylePrompt: 'x' },
        { trackNo: 2, title: 'Song 2', hookPhrase: 'Hook 2', stylePrompt: 'x', lyrics: '[chorus]\nHook 2' }
      ]
    });
    const { songs, warnings } = importSongsForSrtOnly(raw, opts);
    expect(songs).toHaveLength(1);
    expect(songs[0].title).toBe('Song 2');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('lyrics');
  });

  it('returns empty songs with a warning for unparseable JSON, instead of throwing', () => {
    const opts = makeOptions({ songCount: 1 });
    const { songs, warnings } = importSongsForSrtOnly('not json at all {{{', opts);
    expect(songs).toEqual([]);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('returns empty songs with a warning when there is no "songs" array', () => {
    const opts = makeOptions({ songCount: 1 });
    const { songs, warnings } = importSongsForSrtOnly(JSON.stringify({ notSongs: [] }), opts);
    expect(songs).toEqual([]);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('does NOT run the quality gate/title-dedup that importSongsJson runs — a bridge-import quality warning never appears here', () => {
    // Same raw input through both paths: importSongsJson runs scoreSongs/
    // dedupeTitlesAcrossPack/flagHookCollisions; importSongsForSrtOnly
    // deliberately does not (see its own doc comment) — a read-only display
    // path has no business gating or rewriting an already-finished pack.
    const opts = makeOptions({ songCount: 3, titleMode: 'ai-creative', hookMode: 'ai-creative' });
    const raw = songJson(3, { title: 'Same Title' }); // guaranteed title collision across all 3
    const jsonReport = importSongsJson(raw, opts, testGenres, testMoods, testSeason, [], [], []);
    const srtResult = importSongsForSrtOnly(raw, opts);

    // The real pipeline auto-uniquifies colliding titles (dedupeTitlesAcrossPack).
    expect(new Set(jsonReport.blueprint!.songs.map(s => s.title)).size).toBe(3);
    // The read-only path preserves the raw agent titles verbatim, unmodified.
    expect(srtResult.songs.every(s => s.title === 'Same Title')).toBe(true);
  });
});

// NOTE — core/hookLedger.ts's recordPackHooks/listChannelUsage call raw
// `indexedDB.open(...)` with no in-Node fallback (unlike core/library.ts,
// which has an explicit memory-fallback Map for exactly this environment —
// see library.test.ts's own "Runs against library.ts's memory-fallback path
// (no indexedDB in Node)" comment). tests/hookLedger.test.ts itself never
// calls recordPackHooks/listChannelUsage for the same reason — it only
// exercises hookLedger's DB-free pure functions. So the hook-ledger half of
// this proof is structural (below) rather than a live DB before/after; the
// library-pack half IS a live before/after, since library.ts really does
// work in this environment.
describe('[read-only SRT import] real before/after: library pack writes', () => {
  beforeEach(async () => {
    await deleteAllPacks();
  });

  it('PRE-FIX reproduction: the old delegation path (importSongsJson -> savePack, exactly what App.tsx onImportSongsJson/library.saveImportedPack does) really does create a new pack', async () => {
    const opts = makeOptions({ songCount: 2 });
    const beforePacks = (await listPacks()).length;

    const report = importSongsJson(songJson(2), opts, testGenres, testMoods, testSeason, [], [], []);
    expect(report.blueprint).not.toBeNull();
    // This mirrors App.tsx's library.saveImportedPack — the real write the
    // old `onImportSongsJsonForSrt(file) { return onImportSongsJson(file, 'srt') }`
    // delegation triggered on every SRT-only import before this fix.
    await savePack({ blueprint: report.blueprint!, options: opts, name: 'Repro Pack' });

    const afterPacks = (await listPacks()).length;
    expect(afterPacks, 'a new pack was saved').toBe(beforePacks + 1);
  });

  it('POST-FIX: importSongsForSrtOnly (the real function App.tsx now calls) never touches savePack/listPacks — zero new packs', async () => {
    const opts = makeOptions({ songCount: 2 });
    const beforePacks = (await listPacks()).length;

    const { songs, warnings } = importSongsForSrtOnly(songJson(2), opts);
    expect(songs).toHaveLength(2); // still correctly parsed/displayable
    expect(warnings).toEqual([]);

    const afterPacks = (await listPacks()).length;
    expect(afterPacks, 'no new pack was saved').toBe(beforePacks);
  });
});

describe('[read-only SRT import] structural proof: bridgeImport.ts cannot reach hookLedger/library at all', () => {
  const bridgeImportSource = readFileSync(resolve(__dirname, '../src/core/bridgeImport.ts'), 'utf8');

  it('src/core/bridgeImport.ts (home of importSongsForSrtOnly) never imports core/hookLedger or core/library', () => {
    // Both importSongsJson and importSongsForSrtOnly live in this one file;
    // neither can call recordPackHooks/savePack/saveImportedPack because the
    // module itself never imports those modules — the real writes only ever
    // happen one layer up, in App.tsx's onImportSongsJson (untouched) and
    // (before this fix) its old onImportSongsJsonForSrt delegation.
    expect(bridgeImportSource).not.toMatch(/from '\.\/hookLedger'/);
    expect(bridgeImportSource).not.toMatch(/from '\.\/library'/);
  });

  it('importSongsForSrtOnly\'s own function body contains no reference to recordPackHooks/savePack/saveImportedPack', () => {
    const start = bridgeImportSource.indexOf('export function importSongsForSrtOnly');
    expect(start).toBeGreaterThan(-1);
    const body = bridgeImportSource.slice(start);
    expect(body).not.toContain('recordPackHooks');
    expect(body).not.toContain('savePack');
    expect(body).not.toContain('saveImportedPack');
  });
});

// TASK (read-only SRT import) — App.tsx itself can't be unit-tested directly
// (no jsdom/React-rendering test infra in this project — every existing test
// exercises core/ modules directly, see tests/library.test.ts's own "memory
// fallback" note), so this is the realistic proxy for an App.tsx-level
// regression guard: read the real source and assert, textually, that the
// fixed onImportSongsJsonForSrt function body no longer contains the two
// literal calls that constituted the bug (library.saveImportedPack,
// handleGenerationSuccess), while onImportSongsJson — which this task was
// explicitly told NOT to modify — still contains both, unchanged.
describe('[read-only SRT import] App.tsx source-level regression guard', () => {
  const appSource = readFileSync(resolve(__dirname, '../src/App.tsx'), 'utf8');

  function extractFunctionBody(source: string, name: string): string {
    const signatureIndex = source.indexOf(`function ${name}(`);
    expect(signatureIndex, `function ${name} not found in App.tsx`).toBeGreaterThan(-1);
    const braceStart = source.indexOf('{', signatureIndex);
    let depth = 0;
    for (let i = braceStart; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) return source.slice(braceStart, i + 1);
      }
    }
    throw new Error(`Unbalanced braces while extracting ${name}`);
  }

  it('onImportSongsJsonForSrt no longer registers hooks or saves to the library', () => {
    const body = extractFunctionBody(appSource, 'onImportSongsJsonForSrt');
    expect(body).not.toContain('library.saveImportedPack');
    expect(body).not.toContain('handleGenerationSuccess');
    // Confirms it's wired to the new read-only primitive, not silently still
    // delegating to onImportSongsJson.
    expect(body).toContain('importSongsForSrtOnly');
    expect(body).not.toMatch(/return onImportSongsJson\(/);
  });

  it('onImportSongsJson (the regular import path) is completely unchanged — still autosaves and registers hooks', () => {
    const body = extractFunctionBody(appSource, 'onImportSongsJson');
    expect(body).toContain('library.saveImportedPack');
    expect(body).toContain('handleGenerationSuccess');
  });

  // codex 지시문 01 (TASK D) — real gap this closes: onImportSongsJsonForSrt
  // used to call cm.selectChannel(matchedChannel.id) whenever the file's own
  // embedded channel differed from the currently selected one — a real,
  // persistent side effect on live session state (applyChannelToOptions
  // derives market/audience/lyricLanguage from whichever channel is
  // selected), directly violating this function's own "read-only, changes
  // nothing but the current step/tab" contract. Fixed by scoping the
  // matched channel to this import's own local importOpts/importChannel
  // only, never touching cm/opts.
  it('onImportSongsJsonForSrt no longer changes the globally selected channel', () => {
    const body = extractFunctionBody(appSource, 'onImportSongsJsonForSrt');
    expect(body).not.toContain('cm.selectChannel');
    // Still resolves and uses the file's own matched channel for its own
    // local importOpts — just without the global side effect.
    expect(body).toContain('channelFromBridgeFile');
    expect(body).toContain('importChannel');
  });

  it('onImportSongsJson (the regular import path) still matches-and-selects the file\'s own channel — this task did not touch that path', () => {
    const body = extractFunctionBody(appSource, 'onImportSongsJson');
    expect(body).toContain('cm.selectChannel');
  });

  // codex 지시문 01 (TASK D) — SrtExportPanel.tsx's own read-only notice
  // (D2) depends on blueprint.isSrtOnlyImport being set at this exact
  // construction site; this guards that the flag survives if the function
  // is refactored later.
  it('onImportSongsJsonForSrt marks the displayed blueprint with isSrtOnlyImport: true', () => {
    const body = extractFunctionBody(appSource, 'onImportSongsJsonForSrt');
    expect(body).toContain('isSrtOnlyImport: true');
  });

  it('onImportSongsJson (the regular import path) never sets isSrtOnlyImport — a normally-saved pack must never show the read-only notice', () => {
    const body = extractFunctionBody(appSource, 'onImportSongsJson');
    expect(body).not.toContain('isSrtOnlyImport');
  });
});
