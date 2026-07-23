import { describe, expect, it } from 'vitest';
import { buildSetOptions, needsHookDedupPass, runMultiSetGeneration } from '../src/core/multiSetGeneration';
import { stripSetTitlePrefix } from '../src/utils/generation';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { ProviderSettings } from '../src/types';

describe('[v3.33] buildSetOptions', () => {
  it('names each set "{projectTitle} Set 0N" and sets its own songCount, leaving the base options otherwise untouched', () => {
    const base = makeOptions({ projectTitle: 'Weekly Pack', songCount: 12 });
    const set = buildSetOptions(base, 2, 5, 18);
    expect(set.projectTitle).toBe('Weekly Pack Set 03');
    expect(set.songCount).toBe(18);
    expect(set.channel).toBe(base.channel);
  });

  it('pads single-digit set numbers to two digits', () => {
    expect(buildSetOptions(makeOptions(), 0, 10, 18).projectTitle).toContain('Set 01');
    expect(buildSetOptions(makeOptions(), 9, 10, 18).projectTitle).toContain('Set 10');
  });
});

describe('[v3.33] needsHookDedupPass', () => {
  it('is false for the local provider regardless of hookMode', () => {
    expect(needsHookDedupPass(makeOptions({ hookMode: 'ai-creative' }), { provider: 'local', temperature: 0.8 })).toBe(false);
  });

  it('is false for hookMode="pool" on a remote provider (structurally collision-free already)', () => {
    expect(needsHookDedupPass(makeOptions({ hookMode: 'pool' }), { provider: 'anthropic', temperature: 0.8 })).toBe(false);
  });

  it('is true for the default (ai-creative) hookMode on a remote provider', () => {
    expect(needsHookDedupPass(makeOptions(), { provider: 'anthropic', temperature: 0.8 })).toBe(true);
  });
});

describe('[v3.33] runMultiSetGeneration (local provider)', () => {
  const settings: ProviderSettings = { provider: 'local', temperature: 0.8 };

  it('produces one independent blueprint per set, each with its own cold-open (trackNo 1) and flagship (trackNo 2-3)', async () => {
    const baseOpts = makeOptions({ projectTitle: 'Weekly Pack', songCount: 18 });
    const results = await runMultiSetGeneration(baseOpts, 3, 18, testGenres, testMoods, testSeason, settings, undefined);

    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result.blueprint.songs).toHaveLength(18);
      expect(result.blueprint.songs.map(s => s.trackNo)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
      expect(result.blueprint.songs[0].songRole).toBe('cold-open');
      expect(['flagship']).toContain(result.blueprint.songs[1].songRole);
      expect(['flagship']).toContain(result.blueprint.songs[2].songRole);
    }
  });

  it('names sets sequentially and saves each under its own trackNo-independent projectTitle', async () => {
    const baseOpts = makeOptions({ projectTitle: 'Weekly Pack', songCount: 18 });
    const results = await runMultiSetGeneration(baseOpts, 2, 18, testGenres, testMoods, testSeason, settings, undefined);
    expect(results[0].blueprint.projectTitle).not.toBe(results[1].blueprint.projectTitle);
    expect(results[0].opts.projectTitle).toBe('Weekly Pack Set 01');
    expect(results[1].opts.projectTitle).toBe('Weekly Pack Set 02');
  });

  it('90 songs (5x18) across all sets combined have zero title/hook collisions', async () => {
    const baseOpts = makeOptions({ projectTitle: 'Weekly Pack', songCount: 18 });
    const results = await runMultiSetGeneration(baseOpts, 5, 18, testGenres, testMoods, testSeason, settings, undefined);

    const allSongs = results.flatMap(r => r.blueprint.songs);
    expect(allSongs).toHaveLength(90);
    expect(new Set(allSongs.map(s => s.title.toLowerCase())).size).toBe(90);
    expect(new Set(allSongs.map(s => s.hookPhrase.toLowerCase())).size).toBe(90);
  });

  it('threads an initial cross-pack avoid list into every set (set 1 never reuses an older pack\'s title/hook)', async () => {
    const baseOpts = makeOptions({ projectTitle: 'Weekly Pack', songCount: 6 });
    const priorPack = await runMultiSetGeneration(baseOpts, 1, 6, testGenres, testMoods, testSeason, settings, undefined);
    const priorTitles = priorPack[0].blueprint.songs.map(s => s.title);
    const priorHooks = priorPack[0].blueprint.songs.map(s => s.hookPhrase);

    const nextPack = await runMultiSetGeneration(
      { ...baseOpts, projectTitle: 'Weekly Pack 2' },
      1,
      6,
      testGenres,
      testMoods,
      testSeason,
      settings,
      { usedTitles: priorTitles, usedHooks: priorHooks }
    );

    const nextTitles = nextPack[0].blueprint.songs.map(s => s.title.toLowerCase());
    const nextHooks = nextPack[0].blueprint.songs.map(s => s.hookPhrase.toLowerCase());
    expect(priorTitles.map(t => t.toLowerCase()).some(t => nextTitles.includes(t))).toBe(false);
    expect(priorHooks.map(h => h.toLowerCase()).some(h => nextHooks.includes(h))).toBe(false);
  });

  it('reports progress per set via onProgress', async () => {
    const baseOpts = makeOptions({ projectTitle: 'Weekly Pack', songCount: 6 });
    const progressCalls: { currentSet: number; totalSets: number }[] = [];
    await runMultiSetGeneration(baseOpts, 2, 6, testGenres, testMoods, testSeason, settings, undefined, progress => {
      progressCalls.push({ currentSet: progress.currentSet, totalSets: progress.totalSets });
    });
    expect(progressCalls.some(c => c.currentSet === 1 && c.totalSets === 2)).toBe(true);
    expect(progressCalls.some(c => c.currentSet === 2 && c.totalSets === 2)).toBe(true);
  });

  it('calls onSetComplete once per set, with that set\'s own result, before moving to the next', async () => {
    const baseOpts = makeOptions({ projectTitle: 'Weekly Pack', songCount: 6 });
    const completedIndexes: number[] = [];
    await runMultiSetGeneration(baseOpts, 3, 6, testGenres, testMoods, testSeason, settings, undefined, undefined, result => {
      completedIndexes.push(result.index);
    });
    expect(completedIndexes).toEqual([0, 1, 2]);
  });
});

describe('[v3.35] set-number title prefix (default on)', () => {
  const settings: ProviderSettings = { provider: 'local', temperature: 0.8 };

  it('prefixes every set\'s titles 01. through 18., resetting to 01. at the start of each set', async () => {
    const baseOpts = makeOptions({ projectTitle: 'Weekly Pack', songCount: 18 });
    const results = await runMultiSetGeneration(baseOpts, 5, 18, testGenres, testMoods, testSeason, settings, undefined);

    for (const result of results) {
      const prefixes = result.blueprint.songs.map(song => song.title.slice(0, 4));
      expect(prefixes).toEqual(Array.from({ length: 18 }, (_, i) => `${String(i + 1).padStart(2, '0')}. `));
    }
  });

  it('toggle off (setNumberPrefix: false) leaves titles as the plain creative title, unchanged from pre-v3.35 behavior', async () => {
    const baseOpts = makeOptions({ projectTitle: 'Weekly Pack', songCount: 6, setNumberPrefix: false });
    const results = await runMultiSetGeneration(baseOpts, 2, 6, testGenres, testMoods, testSeason, settings, undefined);

    for (const result of results) {
      for (const song of result.blueprint.songs) {
        expect(song.title).toBe(stripSetTitlePrefix(song.title)); // no-op strip proves there was nothing to strip
        expect(/^\d{2}\.\s/.test(song.title)).toBe(false);
      }
    }
  });

  it('cross-set core-title dedup ignores the prefix: an initial avoid list built from a bare creative title still blocks reuse across a prefixed run', async () => {
    const baseOpts = makeOptions({ projectTitle: 'Weekly Pack', songCount: 6 });
    const firstRun = await runMultiSetGeneration(baseOpts, 1, 6, testGenres, testMoods, testSeason, settings, undefined);
    const firstCoreTitles = firstRun[0].blueprint.songs.map(song => stripSetTitlePrefix(song.title));
    // Confirm the real output actually was prefixed (otherwise this test would pass trivially).
    expect(firstRun[0].blueprint.songs[0].title).not.toBe(firstCoreTitles[0]);

    const secondRun = await runMultiSetGeneration(
      { ...baseOpts, projectTitle: 'Weekly Pack 2' },
      1,
      6,
      testGenres,
      testMoods,
      testSeason,
      settings,
      { usedTitles: firstCoreTitles, usedHooks: [] }
    );
    const secondCoreTitles = secondRun[0].blueprint.songs.map(song => stripSetTitlePrefix(song.title).toLowerCase());
    expect(firstCoreTitles.map(t => t.toLowerCase()).some(t => secondCoreTitles.includes(t))).toBe(false);
  });

  it('the ledger-facing accumulator across sets carries stripped titles, so "01. X" (set 1) and a hypothetical bare "X" avoid entry are recognized as the same core title', async () => {
    const baseOpts = makeOptions({ projectTitle: 'Weekly Pack', songCount: 4 });
    const results = await runMultiSetGeneration(baseOpts, 2, 4, testGenres, testMoods, testSeason, settings, undefined);
    const set1CoreTitles = results[0].blueprint.songs.map(s => stripSetTitlePrefix(s.title).toLowerCase());
    const set2CoreTitles = results[1].blueprint.songs.map(s => stripSetTitlePrefix(s.title).toLowerCase());
    // set 2 was generated with set 1's real (prefixed) titles folded into its avoid list
    // internally — if stripping ever broke, set 2 could collide on set 1's *display*
    // string instead of being blocked from reusing its *core* title.
    expect(set1CoreTitles.some(t => set2CoreTitles.includes(t))).toBe(false);
  });
});
