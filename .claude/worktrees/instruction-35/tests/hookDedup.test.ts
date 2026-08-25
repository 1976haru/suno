import { describe, expect, it, vi } from 'vitest';
import { detectHookCollisions, resolveHookCollisions } from '../src/core/hookDedup';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { PlaylistBlueprint, ProviderSettings, SongIdea } from '../src/types';

function stubSong(trackNo: number, overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo,
    title: `Mock Song ${trackNo}`,
    seasonMoment: 'Christmas Cafe',
    listenerSituation: 'morning coffee',
    emotionArc: 'lonely to warm',
    hookPhrase: `Hold On ${trackNo}`,
    stylePrompt: 'warm pop, money chord foundation: I-V-vi-IV, no long instrumental break',
    lyrics: '[verse 1]\nline one\nline two\n[chorus]\nline three\nline four\n[end]',
    thumbnailText: 'Christmas Cafe',
    youtube: { title: 'yt', description: 'desc', tags: ['tag'], thumbnailText: 'th' },
    qualityScore: 0,
    warnings: [],
    ...overrides
  };
}

function stubFetchResponse(songs: SongIdea[]) {
  return new Response(
    JSON.stringify({
      blueprint: {
        projectTitle: 'P',
        channelName: 'C',
        oneLineConcept: 'x',
        sonicSignature: 'x',
        vocalSignature: 'x',
        lyricRules: [],
        harmonyRules: [],
        visualRules: [],
        songs
      }
    }),
    { status: 200 }
  );
}

function makeBlueprint(songs: SongIdea[]): PlaylistBlueprint {
  return {
    projectTitle: 'Test',
    channelName: 'Test Channel',
    oneLineConcept: 'concept',
    sonicSignature: 'sig',
    vocalSignature: 'vocal',
    lyricRules: [],
    harmonyRules: [],
    visualRules: [],
    songs
  };
}

describe('[v3.33] detectHookCollisions (pure)', () => {
  it('flags every trackNo that shares a hookPhrase with another song in the same list', () => {
    const songs = [stubSong(1, { hookPhrase: 'Same Hook' }), stubSong(2, { hookPhrase: 'Same Hook' }), stubSong(3)];
    const collisions = detectHookCollisions(songs);
    expect(collisions.map(c => c.trackNo)).toEqual([1, 2]);
    expect(collisions.every(c => c.reason === 'within-pack')).toBe(true);
  });

  it('flags a trackNo whose hook matches the avoid list (ledger collision), even if unique within the pack', () => {
    const songs = [stubSong(1, { hookPhrase: 'Old Channel Hook' }), stubSong(2, { hookPhrase: 'Fresh Hook' })];
    const collisions = detectHookCollisions(songs, ['Old Channel Hook']);
    expect(collisions).toEqual([{ trackNo: 1, hookPhrase: 'old channel hook', reason: 'ledger' }]);
  });

  it('is case-insensitive and trims whitespace', () => {
    const songs = [stubSong(1, { hookPhrase: ' Hold On ' }), stubSong(2, { hookPhrase: 'hold on' })];
    const collisions = detectHookCollisions(songs);
    expect(collisions.map(c => c.trackNo)).toEqual([1, 2]);
  });

  it('returns nothing for a fully unique pack with no ledger overlap', () => {
    const songs = [stubSong(1), stubSong(2), stubSong(3)];
    expect(detectHookCollisions(songs, ['Some Other Hook'])).toEqual([]);
  });
});

describe('[v3.33] resolveHookCollisions — regenerates colliding tracks via the existing regenerateTrack', () => {
  it('eliminates a within-pack hook collision using the local provider (real regeneration, no mocking)', async () => {
    const opts = makeOptions({ songCount: 6 });
    const settings: ProviderSettings = { provider: 'local', temperature: 0.8 };
    const base = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    // Force tracks 2 and 4 to share a hook, simulating what an AI-creative
    // hookMode generation could produce (parallel chunks can't see each
    // other's real pick).
    const collidingBlueprint: PlaylistBlueprint = {
      ...base,
      songs: base.songs.map(song => (song.trackNo === 4 ? { ...song, hookPhrase: base.songs[1].hookPhrase } : song))
    };
    expect(detectHookCollisions(collidingBlueprint.songs)).toHaveLength(2);

    const { blueprint, warnings } = await resolveHookCollisions(collidingBlueprint, opts, testGenres, testMoods, testSeason, settings);

    expect(detectHookCollisions(blueprint.songs)).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('regenerates a track whose hook matches the channel ledger (avoid list)', async () => {
    const opts = makeOptions({ songCount: 4 });
    const settings: ProviderSettings = { provider: 'local', temperature: 0.8 };
    const base = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const avoid = { usedHooks: [base.songs[0].hookPhrase] };

    const { blueprint, warnings } = await resolveHookCollisions(base, opts, testGenres, testMoods, testSeason, settings, avoid);

    expect(detectHookCollisions(blueprint.songs, avoid.usedHooks)).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('leaves a fully unique pack untouched (no collisions -> no regenerate calls, same object identity)', async () => {
    const opts = makeOptions({ songCount: 4 });
    const settings: ProviderSettings = { provider: 'local', temperature: 0.8 };
    const base = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);

    const { blueprint, warnings } = await resolveHookCollisions(base, opts, testGenres, testMoods, testSeason, settings);

    expect(blueprint).toBe(base);
    expect(warnings).toEqual([]);
  });

  it('gives up after HOOK_DEDUP_MAX_ROUNDS (2) and reports a warning instead of looping forever', async () => {
    const opts = makeOptions({ songCount: 2 });
    const settings: ProviderSettings = { provider: 'anthropic', temperature: 0.7, proxyEndpoint: '/api/generate' };
    const blueprint = makeBlueprint([
      stubSong(1, { hookPhrase: 'Stuck Hook' }),
      stubSong(2, { hookPhrase: 'Stuck Hook' })
    ]);

    let callCount = 0;
    // Every regenerate attempt deliberately echoes back the exact same
    // colliding hook, so collisions never actually resolve.
    vi.stubGlobal('fetch', vi.fn(async () => {
      callCount += 1;
      return stubFetchResponse([stubSong(1, { hookPhrase: 'Stuck Hook' })]);
    }));

    const { blueprint: result, warnings } = await resolveHookCollisions(blueprint, opts, testGenres, testMoods, testSeason, settings);

    expect(callCount).toBeGreaterThan(0);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('재시도 후에도 해결되지 않았습니다');
    expect(detectHookCollisions(result.songs)).not.toEqual([]);
    vi.unstubAllGlobals();
  });
});
