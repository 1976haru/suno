import { describe, expect, it } from 'vitest';
import { hashStableSongFields, lockPassedTracks, findPassedTrackMutations, rewriteResponseRespectsPassedTracks } from '../src/core/rewriteVerification';
import type { SongIdea } from '../src/types';

/**
 * codex 지시문 05 (TASK D, required test file) — "합격곡 잠금": real coverage
 * of hashStableSongFields and the reject-if-a-passed-track-changed check.
 */

function makeSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1, title: 'Original Title', seasonMoment: '', listenerSituation: 'a quiet evening',
    emotionArc: 'warm', hookPhrase: 'hold on tight', stylePrompt: 'warm acoustic pop, 92 BPM',
    lyrics: '[verse 1]\nfirst line\nsecond line', youtube: { title: '', description: '', tags: [] },
    warnings: [], qualityScore: 80, vocalType: 'female', bpm: 92, genreId: 'test-genre',
    ...overrides
  } as SongIdea;
}

describe('[codex 지시문 05 TASK D] hashStableSongFields — real, deterministic content hash', () => {
  it('is stable across two calls on an unchanged song', () => {
    const song = makeSong();
    expect(hashStableSongFields(song)).toBe(hashStableSongFields(song));
  });

  it('is identical for two structurally-identical songs (not object-identity based)', () => {
    expect(hashStableSongFields(makeSong())).toBe(hashStableSongFields(makeSong()));
  });

  it('changes when lyrics change', () => {
    const before = makeSong();
    const after = makeSong({ lyrics: '[verse 1]\na completely different line' });
    expect(hashStableSongFields(before)).not.toBe(hashStableSongFields(after));
  });

  it('changes when title changes', () => {
    expect(hashStableSongFields(makeSong())).not.toBe(hashStableSongFields(makeSong({ title: 'A New Title' })));
  });

  it('does NOT change when only app-computed scores/warnings change (those are recomputed every finalize pass, not provider content)', () => {
    const before = makeSong({ warnings: [] });
    const after = makeSong({ warnings: ['some new advisory'], scores: { structureScore: 90, safetyScore: 100, conceptFitScore: 100, diversityScore: 80, englishScore: 100, uniquenessScore: 100 } });
    expect(hashStableSongFields(before)).toBe(hashStableSongFields(after));
  });
});

describe('[codex 지시문 05 TASK D] lockPassedTracks / findPassedTrackMutations / rewriteResponseRespectsPassedTracks', () => {
  const songs = [makeSong({ trackNo: 1 }), makeSong({ trackNo: 2, title: 'Track Two' }), makeSong({ trackNo: 3, title: 'Track Three' })];

  it('a real rewrite response that leaves passed tracks byte-identical is accepted', () => {
    const locks = lockPassedTracks(songs, [1, 3]);
    const response = [songs[0], { ...songs[1], lyrics: '[verse 1]\nrewritten' }, songs[2]];
    expect(findPassedTrackMutations(response, locks)).toEqual([]);
    expect(rewriteResponseRespectsPassedTracks(response, locks)).toBe(true);
  });

  it('a response that silently alters a passed (locked) track is rejected', () => {
    const locks = lockPassedTracks(songs, [1, 3]);
    const response = [{ ...songs[0], title: 'Sneakily Changed' }, songs[1], songs[2]];
    const mutations = findPassedTrackMutations(response, locks);
    expect(mutations).toHaveLength(1);
    expect(mutations[0].trackNo).toBe(1);
    expect(rewriteResponseRespectsPassedTracks(response, locks)).toBe(false);
  });

  it('a response that drops a passed track entirely is also rejected (not silently ignored)', () => {
    const locks = lockPassedTracks(songs, [1, 3]);
    const response = [songs[1], songs[2]]; // T1 missing entirely
    const mutations = findPassedTrackMutations(response, locks);
    expect(mutations.some(m => m.trackNo === 1 && m.actualHash === '(missing)')).toBe(true);
  });
});
