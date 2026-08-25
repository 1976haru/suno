/**
 * TASK (post-generation operation snapshot) — regression coverage for
 * core/generationSnapshot.ts and the real bug it exists to fix: every
 * post-generation operation (retry, refine, evaluate, save, persona
 * rebuild, ...) used to read whatever `opts`/`cm.selectedChannel` happened
 * to be LIVE on screen at the moment that action was clicked, not what the
 * pack was actually generated under (App.tsx's onRetrySong/onRefineSelected/
 * onEvaluate — confirmed real bug before this task).
 *
 * These tests cover:
 *  - scenario A: generate under channel A, "switch" (in-memory) to channel
 *    B, retry a track (regenerateTrack's own `{...blueprint, songs}` spread
 *    pattern) — the ORIGINAL channel A's snapshot survives untouched.
 *  - resolveGenerationContext: default resolves to the snapshot (channel A)
 *    regardless of what's live; useCurrentSettings=true is the explicit,
 *    per-action escape hatch back to live state; a blueprint with no
 *    snapshot always falls back to live (old-pack backward compatibility).
 *  - the bridge-import fallbackGenres()/fallbackMoods() state-timing race:
 *    a component-state-reading closure (the OLD bug shape) can see a stale
 *    channel on the same synchronous pass a channel switch was requested;
 *    genresForOptions/moodsForOptions (pure functions of `options` alone)
 *    cannot, by construction.
 *  - exportJson now carries all 12 real meta fields when the blueprint has
 *    a GenerationSnapshot.
 */
import { describe, expect, it } from 'vitest';
import {
  buildGenerationSnapshot,
  genresForOptions,
  moodsForOptions,
  resolveGenerationContext,
  withGenerationSnapshot
} from '../src/core/generationSnapshot';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { exportJson } from '../src/utils/exporters';
import { makeOptions, testGenres, testMoods, testSeason, channelPresets, genrePacks } from './fixtures';
import type { GenerationOptions, ProviderSettings } from '../src/types';

const channelA = channelPresets[0];
const channelB = channelPresets.find(channel => channel.id !== channelA.id)!;

const providerA: ProviderSettings = { provider: 'local', temperature: 0.8 };
const providerB: ProviderSettings = { provider: 'anthropic', temperature: 0.5, model: 'claude-test' };

describe('generationSnapshot — buildGenerationSnapshot / withGenerationSnapshot', () => {
  it('attaches a real snapshot carrying this generation\'s own channel/options/provider/season', () => {
    const opts = makeOptions({ channel: channelA, songCount: 4 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const withSnapshot = withGenerationSnapshot(blueprint, { options: opts, provider: providerA, season: testSeason });

    expect(withSnapshot.generationSnapshot).toBeDefined();
    expect(withSnapshot.generationSnapshot!.channel.id).toBe(channelA.id);
    expect(withSnapshot.generationSnapshot!.options.songCount).toBe(4);
    expect(withSnapshot.generationSnapshot!.provider.provider).toBe('local');
    expect(withSnapshot.generationSnapshot!.season.id).toBe(testSeason.id);
    expect(withSnapshot.generationSnapshot!.slots.length).toBe(4);
    expect(typeof withSnapshot.generationSnapshot!.contractSignature).toBe('string');
    expect(withSnapshot.generationSnapshot!.contractSignature.length).toBeGreaterThan(0);
  });

  it('is a no-op once a snapshot is already present — later calls never overwrite the original', () => {
    const opts = makeOptions({ channel: channelA, songCount: 4 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const first = withGenerationSnapshot(blueprint, { options: opts, provider: providerA, season: testSeason });

    // Simulate a LATER re-finalize call (e.g. App.tsx's finalizeSinglePackBlueprint
    // running again after a retry) under completely different live settings.
    const laterOpts = makeOptions({ channel: channelB, songCount: 99 });
    const second = withGenerationSnapshot(first, { options: laterOpts, provider: providerB, season: testSeason });

    expect(second.generationSnapshot).toBe(first.generationSnapshot);
    expect(second.generationSnapshot!.channel.id).toBe(channelA.id);
    expect(second.generationSnapshot!.provider.provider).toBe('local');
  });
});

describe('generationSnapshot — scenario A: channel-switch-then-retry preserves the original channel', () => {
  it('a track "retried" after switching channels still carries channel A\'s snapshot', () => {
    // 1. Generate under channel A.
    const optsA = makeOptions({ channel: channelA, songCount: 5 });
    const generated = generateLocalBlueprint(optsA, testGenres, testMoods, testSeason);
    const blueprint = withGenerationSnapshot(generated, { options: optsA, provider: providerA, season: testSeason });
    expect(blueprint.generationSnapshot!.channel.id).toBe(channelA.id);

    // 2. User switches the sidebar to channel B WITHOUT regenerating — the
    // live state a naive retry would read is now channel B.
    const liveOptsAfterSwitch = makeOptions({ channel: channelB, songCount: 5 });
    expect(liveOptsAfterSwitch.channel.id).not.toBe(blueprint.generationSnapshot!.channel.id);

    // 3. "Retry track 1" — mirrors providers/index.ts's regenerateTrack,
    // which only ever replaces `songs`, spreading every other field of the
    // blueprint (including generationSnapshot) forward unchanged.
    const retriedSongs = blueprint.songs.map(song => (song.trackNo === 1 ? { ...song, title: 'Retried Title' } : song));
    const afterRetry = { ...blueprint, songs: retriedSongs };

    // The real bug: does the pack's own recorded settings still say channel
    // A, not the now-live channel B?
    expect(afterRetry.generationSnapshot!.channel.id).toBe(channelA.id);
    expect(afterRetry.generationSnapshot!.options.channel.id).toBe(channelA.id);
    expect(afterRetry.songs.find(s => s.trackNo === 1)?.title).toBe('Retried Title');

    // 4. App.tsx's finalizeSinglePackBlueprint re-runs after every retry too
    // (title-prefix reapplication) — confirm THAT doesn't clobber it either.
    const reFinalized = withGenerationSnapshot(afterRetry, { options: liveOptsAfterSwitch, provider: providerB, season: testSeason });
    expect(reFinalized.generationSnapshot!.channel.id).toBe(channelA.id);
  });
});

describe('generationSnapshot — resolveGenerationContext (the opt-in "use current settings" override)', () => {
  const optsA = makeOptions({ channel: channelA, songCount: 5 });
  const optsB = makeOptions({ channel: channelB, songCount: 5 });
  const generated = generateLocalBlueprint(optsA, testGenres, testMoods, testSeason);
  const blueprintWithSnapshot = withGenerationSnapshot(generated, { options: optsA, provider: providerA, season: testSeason });
  const liveState = { options: optsB, provider: providerB, season: testSeason, genres: testGenres, moods: testMoods };

  it('defaults to the pack\'s own snapshot (channel A), ignoring whatever is live', () => {
    const ctx = resolveGenerationContext(blueprintWithSnapshot, liveState);
    expect(ctx.options.channel.id).toBe(channelA.id);
    expect(ctx.provider.provider).toBe('local');
  });

  it('useCurrentSettings=true genuinely uses live settings (channel B) for that one call', () => {
    const ctx = resolveGenerationContext(blueprintWithSnapshot, liveState, true);
    expect(ctx.options.channel.id).toBe(channelB.id);
    expect(ctx.provider.provider).toBe('anthropic');
  });

  it('a blueprint with no snapshot at all (an old pack) always falls back to live state', () => {
    const blueprintNoSnapshot = generateLocalBlueprint(optsA, testGenres, testMoods, testSeason);
    expect(blueprintNoSnapshot.generationSnapshot).toBeUndefined();
    const ctx = resolveGenerationContext(blueprintNoSnapshot, liveState);
    expect(ctx.options.channel.id).toBe(channelB.id);
  });

  it('a null blueprint (nothing generated yet) falls back to live state without throwing', () => {
    const ctx = resolveGenerationContext(null, liveState);
    expect(ctx.options.channel.id).toBe(channelB.id);
  });
});

describe('generationSnapshot — bridge-import fallbackGenres()/fallbackMoods() state-timing race (TASK 4)', () => {
  /**
   * Reproduces the OLD bug shape directly: a closure that reads channel from
   * a shared, externally-mutated variable — exactly what
   * `cm.selectedChannel` is from fallbackGenres()'s point of view inside
   * App.tsx. `cm.selectChannel(matchedChannel.id)` is a React state setter;
   * it schedules a re-render, it does not mutate anything synchronously —
   * so a same-tick read after calling it can still see the OLD value. This
   * models that exact race with a plain mutable binding.
   */
  function oldFallbackGenresRace(liveSelectedChannelRef: { current: typeof channelA }, requestChannelSwitch: () => void) {
    // Real sequence from the old App.tsx onImportSongsJson:
    //   cm.selectChannel(matchedChannel.id);   // schedules, doesn't land synchronously
    //   const importOpts = { ...opts, channel: importChannel }; // correct
    //   fallbackGenres()                        // reads cm.selectedChannel directly — STALE
    requestChannelSwitch();
    const channelFallbackGenresActuallyRead = liveSelectedChannelRef.current; // same-tick: still old value
    return genrePacks.filter(genre => channelFallbackGenresActuallyRead.preferredGenres.includes(genre.id));
  }

  it('the OLD fallbackGenres()-shaped closure can read a stale channel on the same synchronous pass as a channel switch', () => {
    const liveSelectedChannelRef = { current: channelA };
    const requestChannelSwitch = () => {
      // A React state setter's real effect lands on a LATER render, not now —
      // simulated here by simply doing nothing synchronously.
    };
    const staleResult = oldFallbackGenresRace(liveSelectedChannelRef, requestChannelSwitch);
    const expectedForImportChannel = genrePacks.filter(genre => channelB.preferredGenres.includes(genre.id));
    // Reproduces the real bug: importOpts.channel is channelB, but the stale
    // read above still resolved against channelA.
    expect(staleResult.map(g => g.id)).not.toEqual(expectedForImportChannel.map(g => g.id));
    expect(staleResult.map(g => g.id)).toEqual(genrePacks.filter(g => channelA.preferredGenres.includes(g.id)).map(g => g.id));
  });

  it('genresForOptions/moodsForOptions cannot exhibit this race — they are pure functions of the already-resolved importOpts, no external state read', () => {
    const importOpts: GenerationOptions = makeOptions({ channel: channelB, genreIds: channelB.preferredGenres, moodIds: channelB.preferredMoods });
    const genres = genresForOptions(importOpts);
    const moods = moodsForOptions(importOpts);
    // Always resolves against whatever channel importOpts itself carries —
    // channelB, correctly — regardless of any external "live selected
    // channel" variable existing or having updated yet.
    expect(genres.every(g => channelB.preferredGenres.includes(g.id) || genres.length === 1)).toBe(true);
    expect(genres.length).toBeGreaterThan(0);
    expect(moods.length).toBeGreaterThan(0);
  });

  it('genresForOptions falls back through the real chain (explicit genreIds -> channel.preferredGenres -> genrePacks[0]) exactly like App.tsx\'s real fallbackGenres()', () => {
    const explicitOpts = makeOptions({ channel: channelA, genreIds: [channelA.preferredGenres[0]] });
    expect(genresForOptions(explicitOpts).map(g => g.id)).toEqual([channelA.preferredGenres[0]]);

    const noGenreIdsOpts = makeOptions({ channel: channelA, genreIds: [] });
    const fallback = genresForOptions(noGenreIdsOpts);
    expect(fallback.length).toBeGreaterThan(0);
    expect(fallback.every(g => channelA.preferredGenres.includes(g.id))).toBe(true);
  });
});

describe('generationSnapshot — exportJson carries all 12 real meta fields (TASK 5)', () => {
  it('a real exported file includes workspaceId/channelId/archetype/lyricLanguage/genreIds/moodIds/moneyChordMode/vocalTone/songCount/schemaVersion/appVersion/preassignedSlotHash', () => {
    const opts = makeOptions({ channel: channelA, songCount: 3, lyricLanguage: 'english', moneyChordMode: 'emotional', vocalTone: channelA.defaultVocal });
    const generated = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const snapshot = buildGenerationSnapshot({ options: opts, provider: providerA, season: testSeason });
    const blueprint = { ...generated, generationSnapshot: snapshot };

    const json = JSON.parse(exportJson(blueprint, undefined, undefined, false, channelA));

    const requiredFields = [
      'workspaceId', 'channelId', 'archetype', 'lyricLanguage', 'genreIds', 'moodIds',
      'moneyChordMode', 'vocalTone', 'songCount', 'schemaVersion', 'appVersion', 'preassignedSlotHash'
    ];
    for (const field of requiredFields) {
      expect(json, `missing export meta field: ${field}`).toHaveProperty(field);
      expect(json[field], `export meta field ${field} should not be undefined`).not.toBeUndefined();
    }
    expect(json.channelId).toBe(channelA.id);
    expect(json.lyricLanguage).toBe('english');
    expect(json.moneyChordMode).toBe('emotional');
    expect(json.songCount).toBe(3);
    expect(Array.isArray(json.genreIds)).toBe(true);
    expect(Array.isArray(json.moodIds)).toBe(true);
    expect(typeof json.preassignedSlotHash).toBe('string');
  });

  it('a blueprint with no snapshot exports without the 9 new fields (backward compatible — old behavior unchanged)', () => {
    const opts = makeOptions({ channel: channelA, songCount: 2 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    expect(blueprint.generationSnapshot).toBeUndefined();

    const json = JSON.parse(exportJson(blueprint, undefined, undefined, false, channelA));
    expect(json.channelId).toBeUndefined();
    expect(json.preassignedSlotHash).toBeUndefined();
    // Pre-existing fields still present, unaffected.
    expect(typeof json.appVersion).toBe('string');
    expect(typeof json.schemaVersion).toBe('number');
  });
});
