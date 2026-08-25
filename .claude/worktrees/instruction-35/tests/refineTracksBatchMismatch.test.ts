import { describe, expect, it, vi } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { refineTracks } from '../src/providers';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { ProviderSettings, SongIdea } from '../src/types';

/**
 * codex 지시문 01 (TASK A) — real gap this closes: refineTracks' own batch
 * path (>= REFINE_BATCH_THRESHOLD tracks in one request) used to remap
 * `result.songs[i]` to `chunk[i]` purely by array position, with no check
 * that the response actually returned the same number of songs as
 * requested. A response short a song, carrying an extra one, or reordered
 * would silently misassign lyrics to the WRONG trackNo. These tests stub
 * fetch to return a MISMATCHED count and confirm the fix: the mismatched
 * chunk is dropped (not partially/incorrectly applied) and reported as a
 * warning, mirroring tests/hybridRefine.test.ts's own real-fetch-stub
 * convention (this codebase avoids module mocking — see that file's own
 * precedent).
 */
function stubBatchResponse(songs: SongIdea[]) {
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

function fakeSong(trackNo: number): SongIdea {
  return {
    trackNo,
    title: `Refined ${trackNo}`,
    seasonMoment: 'x',
    listenerSituation: 'x',
    emotionArc: 'x',
    hookPhrase: `Refined hook ${trackNo}`,
    stylePrompt: 'warm pop, hook "test" repeats chorus 4x, I-V-vi-IV progression, stop-time accent on the chorus, 96 BPM',
    lyrics: `[verse 1]\nline one for track ${trackNo}\nline two for track ${trackNo}\n[chorus]\nhold on till the morning light\nwe'll be alright, we'll be alright\n[end]`,
    thumbnailText: 'x',
    youtube: { title: 'yt', description: 'desc', tags: ['tag'], thumbnailText: 'th' },
    qualityScore: 0,
    warnings: []
  } as SongIdea;
}

describe('[codex 지시문 01 TASK A] refineTracks — batch response song-count mismatch', () => {
  it('drops a chunk whose response has FEWER songs than requested, warns, and leaves those tracks unchanged', async () => {
    const opts = makeOptions({ songCount: 8 });
    const draft = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const settings: ProviderSettings = { provider: 'anthropic', temperature: 0.7, proxyEndpoint: '/api/generate' };
    const targetTrackNos = [1, 2, 3, 4]; // >= REFINE_BATCH_THRESHOLD (4) -> batch path, one chunk

    vi.stubGlobal('fetch', vi.fn(async () => stubBatchResponse([fakeSong(1), fakeSong(2), fakeSong(3)]))); // only 3, requested 4

    const result = await refineTracks(draft, targetTrackNos, opts, testGenres, testMoods, testSeason, settings);

    expect(result.warnings.some(w => w.includes('응답 곡 수') && w.includes('3') && w.includes('4'))).toBe(true);
    // Every targeted track kept its ORIGINAL (pre-refine) content — never partially/incorrectly remapped.
    for (const trackNo of targetTrackNos) {
      const before = draft.songs.find(s => s.trackNo === trackNo)!;
      const after = result.blueprint.songs.find(s => s.trackNo === trackNo)!;
      expect(after.title).toBe(before.title);
      expect(after.lyrics).toBe(before.lyrics);
    }
  });

  it('drops a chunk whose response has MORE songs than requested, warns, and leaves those tracks unchanged', async () => {
    const opts = makeOptions({ songCount: 8 });
    const draft = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const settings: ProviderSettings = { provider: 'anthropic', temperature: 0.7, proxyEndpoint: '/api/generate' };
    const targetTrackNos = [1, 2, 3, 4];

    vi.stubGlobal('fetch', vi.fn(async () => stubBatchResponse([fakeSong(1), fakeSong(2), fakeSong(3), fakeSong(4), fakeSong(5)]))); // 5, requested 4

    const result = await refineTracks(draft, targetTrackNos, opts, testGenres, testMoods, testSeason, settings);

    expect(result.warnings.some(w => w.includes('응답 곡 수') && w.includes('5') && w.includes('4'))).toBe(true);
    for (const trackNo of targetTrackNos) {
      const before = draft.songs.find(s => s.trackNo === trackNo)!;
      const after = result.blueprint.songs.find(s => s.trackNo === trackNo)!;
      expect(after.lyrics).toBe(before.lyrics);
    }
  });

  it('a MATCHING response count still applies normally (no false-positive rejection)', async () => {
    const opts = makeOptions({ songCount: 8 });
    const draft = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const settings: ProviderSettings = { provider: 'anthropic', temperature: 0.7, proxyEndpoint: '/api/generate' };
    const targetTrackNos = [1, 2, 3, 4];

    vi.stubGlobal('fetch', vi.fn(async () => stubBatchResponse([fakeSong(1), fakeSong(2), fakeSong(3), fakeSong(4)])));

    const result = await refineTracks(draft, targetTrackNos, opts, testGenres, testMoods, testSeason, settings);

    expect(result.warnings).toEqual([]);
    for (const trackNo of targetTrackNos) {
      const after = result.blueprint.songs.find(s => s.trackNo === trackNo)!;
      expect(after.title).toBe(`Refined ${trackNo}`);
    }
  });
});
