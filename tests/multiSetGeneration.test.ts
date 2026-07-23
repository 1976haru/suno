import { describe, expect, it } from 'vitest';
import { buildSetOptions, needsHookDedupPass, runMultiSetGeneration } from '../src/core/multiSetGeneration';
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
