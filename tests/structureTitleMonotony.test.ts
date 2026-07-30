import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { lintInPackLyricDiversity } from '../src/core/diversityLinter';
import { titleHookOverlapWarning } from '../src/core/quality';
import { buildClaudeCodeInstruction } from '../src/core/claudeCodeBridge';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

function songWith(trackNo: number, overrides: { lyrics?: string; hookPhrase?: string; title?: string } = {}) {
  return {
    trackNo,
    hookPhrase: overrides.hookPhrase ?? `Hook ${trackNo}`,
    title: overrides.title ?? `Title ${trackNo}`,
    lyrics: overrides.lyrics ?? [
      '[verse 1]',
      'line a',
      'line b',
      '',
      '[chorus]',
      overrides.hookPhrase ?? `Hook ${trackNo}`,
      'line c',
      overrides.hookPhrase ?? `Hook ${trackNo}`,
      'line d',
      'line e',
      'line f',
      overrides.hookPhrase ?? `Hook ${trackNo}`,
      '',
      '[end]'
    ].join('\n')
  };
}

/**
 * TASK v3.60 (TASK D-1) — a real 17-song bridge pack shared the identical
 * chorus hook-repetition shape "HxHxxxH" (hook/line/hook/line/line/line/
 * hook) on every single track, because T1-T5's structure templates only fix
 * SECTION order, never hook placement/repeat count within the chorus
 * itself. Distinct from the pre-existing repeatedChorusStructures check,
 * which measured 0 repeats on this exact real pack despite the shape being
 * 100% identical (see this task's own diagnosis).
 */
describe('[v3.60 TASK D-1] repeatedChorusHookPatterns', () => {
  it('flags an identical HxHxxxH chorus hook-repetition shape shared by every song', () => {
    const songs = Array.from({ length: 6 }, (_, i) => songWith(i + 1));
    const report = lintInPackLyricDiversity(songs);
    expect(report.repeatedChorusHookPatterns.length).toBeGreaterThan(0);
    expect(report.repeatedChorusHookPatterns[0].pattern).toBe('HxHxxxH');
    expect(report.warnings.some(w => w.includes('Chorus hook-repetition shape'))).toBe(true);
  });

  it('does not flag a pack whose chorus hook-repetition shape actually varies', () => {
    const shapes = [
      ['[chorus]', 'HOOK', 'line', 'HOOK', '[end]'],
      ['[chorus]', 'HOOK', 'line', 'line', 'line', 'line', 'HOOK', '[end]'],
      ['[chorus]', 'HOOK', 'line', 'HOOK', 'line', 'HOOK', '[end]'],
      ['[chorus]', 'HOOK', 'line', 'line', 'HOOK', '[end]'],
      ['[chorus]', 'HOOK', 'HOOK', '[end]'],
      ['[chorus]', 'HOOK', 'line', 'line', 'line', 'HOOK', '[end]']
    ];
    const songs = shapes.map((lines, i) => songWith(i + 1, {
      hookPhrase: 'HOOK',
      lyrics: ['[verse 1]', 'line a', '', ...lines].join('\n')
    }));
    const report = lintInPackLyricDiversity(songs);
    expect(report.repeatedChorusHookPatterns).toEqual([]);
  });

  it('does not flag anything when hookPhrase is not provided (backward compatible)', () => {
    const songs = Array.from({ length: 6 }, (_, i) => ({ trackNo: i + 1, lyrics: songWith(i + 1).lyrics }));
    const report = lintInPackLyricDiversity(songs);
    expect(report.repeatedChorusHookPatterns).toEqual([]);
  });
});

/**
 * TASK v3.60 (TASK D-2) — every one of a real 17-song bridge pack's titles
 * ("Tableglow", "Steam Radio", "Porch Ember", ...) was a bare 1-2 word noun
 * pair, despite the bridge instruction already saying titles must "never
 * [be] the same shape for every song". Reuses diversityLinter.ts's own
 * pre-existing titleShape fingerprint (previously only checked cross-pack,
 * in lintChannelDiversity) at in-pack scope.
 */
describe('[v3.60 TASK D-2] repeatedTitleShapes', () => {
  it('flags every title sharing the same short bare-noun shape', () => {
    const titles = ['Tableglow', 'Steam Radio', 'Porch Ember', 'Dew Lantern', 'Market Seat', 'Photo Floor'];
    const songs = titles.map((title, i) => songWith(i + 1, { title }));
    const report = lintInPackLyricDiversity(songs);
    expect(report.repeatedTitleShapes.length).toBeGreaterThan(0);
    expect(report.warnings.some(w => w.includes('Title shape repeats'))).toBe(true);
  });

  it('does not flag a pack whose title lengths actually vary across 3+ buckets', () => {
    const titles = [
      'Ember', 'Steam Radio', // plain-short (2)
      'The Old Radio Glow', 'Morning Light Returns', // plain-mid (2)
      'Wait for the Morning Light to Come', 'Riverside Thermos and the Quiet Road' // plain-long (2)
    ];
    const songs = titles.map((title, i) => songWith(i + 1, { title }));
    const report = lintInPackLyricDiversity(songs);
    expect(report.repeatedTitleShapes).toEqual([]);
  });

  it('does not flag anything when title is not provided (backward compatible)', () => {
    const songs = Array.from({ length: 6 }, (_, i) => ({ trackNo: i + 1, lyrics: songWith(i + 1).lyrics }));
    const report = lintInPackLyricDiversity(songs);
    expect(report.repeatedTitleShapes).toEqual([]);
  });
});

/**
 * TASK v3.60 (TASK D-3) — titleHookOverlapWarning (v3.58 TASK 5-6) already
 * applies uniformly to the bridge path: it's called per-song inside
 * albumAudit.ts's auditAlbum, which runs on whatever blueprint is being
 * displayed regardless of local-vs-bridge origin. A real 17-song bridge
 * pack has 0/17 word overlap between title and hook (e.g. "Tableglow" /
 * "Stay with Me Tonight") — this verifies the pre-existing check already
 * catches every one of them, no new code needed.
 */
describe('[v3.60 TASK D-3] titleHookOverlapWarning already applies to bridge-shaped title/hook pairs', () => {
  it('flags a real zero-overlap bridge title/hook pair', () => {
    expect(titleHookOverlapWarning('Tableglow', 'Stay with Me Tonight')).not.toBeNull();
    expect(titleHookOverlapWarning('Porch Ember', 'Catch the Morning Train')).not.toBeNull();
  });
});

describe('[v3.60 TASK D-1] bridge instruction encourages varying chorus hook-repetition shape', () => {
  it('includes guidance against a single fixed hook-repetition shape', () => {
    const opts = makeOptions({ songCount: 3 });
    const slots = preallocateSongSlots(opts, testGenres, { usedTitles: [], usedHooks: [] });
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, { usedTitles: [], usedHooks: [] }, slots, false);
    expect(instruction).toContain('Vary how many times the hook repeats inside each chorus');
  });
});

const realPackPath = path.resolve(__dirname, '..', 'songs-output.json');
const describeRealPack = existsSync(realPackPath) ? describe : describe.skip;

describeRealPack('[v3.60 TASK D] against the real bridge-path pack', () => {
  const data = existsSync(realPackPath) ? JSON.parse(readFileSync(realPackPath, 'utf-8')) : { songs: [] };

  it('flags the real HxHxxxH chorus hook-repetition shape shared by all 17 songs', () => {
    const report = lintInPackLyricDiversity(data.songs.map((s: any) => ({ trackNo: s.trackNo, lyrics: s.lyrics, hookPhrase: s.hookPhrase })));
    expect(report.repeatedChorusHookPatterns.length).toBeGreaterThan(0);
    expect(report.repeatedChorusHookPatterns[0].pattern).toBe('HxHxxxH');
    expect(report.repeatedChorusHookPatterns[0].count).toBe(17);
  });

  it('flags the real title-shape monotony shared by all 17 songs', () => {
    const report = lintInPackLyricDiversity(data.songs.map((s: any) => ({ trackNo: s.trackNo, lyrics: s.lyrics, title: s.title })));
    expect(report.repeatedTitleShapes.length).toBeGreaterThan(0);
    expect(report.repeatedTitleShapes[0].count).toBe(17);
  });

  it('flags all 17 real title/hook pairs as zero-overlap via the pre-existing check', () => {
    const flagged = data.songs.filter((s: any) => titleHookOverlapWarning(s.title, s.hookPhrase));
    expect(flagged.length).toBe(17);
  });
});
