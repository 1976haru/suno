import { describe, expect, it, vi } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { regenerateTrack } from '../src/providers';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { ProviderSettings, SongIdea } from '../src/types';

function stubSong(trackNo: number, overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo,
    title: `Mock Song ${trackNo}`,
    seasonMoment: 'Christmas Cafe',
    listenerSituation: 'morning coffee',
    emotionArc: 'lonely to warm',
    hookPhrase: `Mock Song ${trackNo}, hold on`,
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

describe('regenerateTrack', () => {
  it('does not collide with the other 29 songs (local provider)', async () => {
    const opts = makeOptions({ songCount: 30 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const settings: ProviderSettings = { provider: 'local', temperature: 0.8 };

    const { blueprint: next } = await regenerateTrack(blueprint, 15, opts, testGenres, testMoods, testSeason, settings, []);

    const others = next.songs.filter(song => song.trackNo !== 15);
    const replaced = next.songs.find(song => song.trackNo === 15)!;
    expect(others.some(song => song.title === replaced.title)).toBe(false);
    expect(others.some(song => song.hookPhrase === replaced.hookPhrase)).toBe(false);
  });

  it('leaves every other song unchanged', async () => {
    const opts = makeOptions({ songCount: 12 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const settings: ProviderSettings = { provider: 'local', temperature: 0.8 };

    const { blueprint: next } = await regenerateTrack(blueprint, 4, opts, testGenres, testMoods, testSeason, settings, []);

    for (const song of blueprint.songs) {
      if (song.trackNo === 4) continue;
      expect(next.songs.find(s => s.trackNo === song.trackNo)).toEqual(song);
    }
  });

  it('produces a different result than the original track (local provider)', async () => {
    const opts = makeOptions({ songCount: 5 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const settings: ProviderSettings = { provider: 'local', temperature: 0.8 };
    const original = blueprint.songs.find(song => song.trackNo === 2)!;

    const { blueprint: next } = await regenerateTrack(blueprint, 2, opts, testGenres, testMoods, testSeason, settings, []);
    const replaced = next.songs.find(song => song.trackNo === 2)!;

    expect(replaced.lyrics).not.toBe(original.lyrics);
    expect(replaced.title).not.toBe(original.title);
  });

  it('includes feedback text in the request payload sent to the proxy', async () => {
    const opts = makeOptions({ songCount: 3 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const settings: ProviderSettings = { provider: 'anthropic', temperature: 0.7, proxyEndpoint: '/api/generate' };

    let capturedBody: any = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        capturedBody = JSON.parse(init.body as string);
        return stubFetchResponse([stubSong(1)]);
      })
    );

    await regenerateTrack(blueprint, 1, opts, testGenres, testMoods, testSeason, settings, ['famous artist imitation risk', 'chorus too long']);

    expect(capturedBody).not.toBeNull();
    expect(capturedBody.user.customConcept).toContain('famous artist imitation risk');
    expect(capturedBody.user.customConcept).toContain('chorus too long');
    vi.unstubAllGlobals();
  });

  it('returns the best-effort result with a warning after exhausting retries, without looping forever', async () => {
    const opts = makeOptions({ songCount: 3 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const settings: ProviderSettings = { provider: 'anthropic', temperature: 0.7, proxyEndpoint: '/api/generate' };

    let callCount = 0;
    // Every candidate deliberately fails the quality bar (imitation phrase + missing lyric tags).
    const fetchMock = vi.fn(async () => {
      callCount += 1;
      return stubFetchResponse([
        stubSong(1, {
          lyrics: 'no section tags at all, just plain text',
          stylePrompt: 'in the style of a famous artist, no money chord, no duration control'
        })
      ]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { blueprint: next, warning } = await regenerateTrack(blueprint, 1, opts, testGenres, testMoods, testSeason, settings, []);

    expect(callCount).toBe(3);
    expect(warning).toBeTruthy();
    expect(next.songs.find(song => song.trackNo === 1)).toBeDefined();
    vi.unstubAllGlobals();
  });
});
