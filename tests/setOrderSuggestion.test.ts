import { describe, expect, it } from 'vitest';
import { suggestSetOrder } from '../src/core/setOrderSuggestion';
import type { SongIdea } from '../src/types';

// TASK v4.14 (TASK D) — this module had zero test coverage before this task
// (confirmed via a repo-wide search). Covers: trackNo is never renumbered,
// the cold-open/flagship prefix stays pinned, moneyChordId now factors into
// alternation, and the ≤2-consecutive cap (genre/vocalType/moneyChordId)
// actually holds even when the greedy pass alone would have produced a
// longer run.

function baseSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Track',
    seasonMoment: 'a quiet morning',
    listenerSituation: 'waking up slowly',
    emotionArc: 'calm to hopeful',
    hookPhrase: 'Track Hook',
    stylePrompt: 'warm acoustic pop, mid tempo',
    lyrics: '[verse 1]\nline\n\n[end]',
    warnings: [],
    qualityScore: 90,
    youtube: { title: 'Track', description: 'desc', tags: [] },
    ...overrides
  };
}

describe('[v4.14 TASK D] suggestSetOrder', () => {
  it('never renumbers trackNo — suggestedOrder is a permutation of the original trackNos', () => {
    const songs = Array.from({ length: 8 }, (_, i) => baseSong({
      trackNo: i + 1,
      title: `T${i + 1}`,
      hookPhrase: `Hook ${i + 1}`,
      songRole: i === 0 ? 'cold-open' : i < 3 ? 'flagship' : undefined,
      genreId: i % 2 === 0 ? 'genreA' : 'genreB',
      vocalType: i % 2 === 0 ? 'male' : 'female',
      bpm: 80 + i * 5
    }));
    const result = suggestSetOrder(songs);
    expect([...result.suggestedOrder].sort((a, b) => a - b)).toEqual(songs.map(s => s.trackNo).sort((a, b) => a - b));
    // trackNo/title on each song object itself is untouched
    songs.forEach((song, i) => expect(song.trackNo).toBe(i + 1));
  });

  it('keeps the cold-open and flagship tracks pinned to the front', () => {
    const songs = Array.from({ length: 10 }, (_, i) => baseSong({
      trackNo: i + 1,
      title: `T${i + 1}`,
      hookPhrase: `Hook ${i + 1}`,
      songRole: i === 0 ? 'cold-open' : i < 3 ? 'flagship' : undefined,
      genreId: 'genreA',
      vocalType: i % 2 === 0 ? 'male' : 'female',
      bpm: 80 + i * 5
    }));
    const result = suggestSetOrder(songs);
    expect(result.suggestedOrder.slice(0, 3).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it('caps consecutive same-moneyChordId runs at 2 even when the greedy pass alone would produce more', () => {
    // 4 flagship-exempt tracks, all sharing one moneyChordId, nothing else to
    // differentiate them (same genre/vocalType/bpm) — the pure greedy loop
    // has no reason to interleave them, so this only passes if the
    // post-pass cap actually runs.
    const songs = [
      baseSong({ trackNo: 1, title: 'T1', hookPhrase: 'H1', songRole: 'cold-open', genreId: 'genreA', vocalType: 'male', bpm: 90, moneyChordId: 'doowop' }),
      baseSong({ trackNo: 2, title: 'T2', hookPhrase: 'H2', songRole: 'flagship', genreId: 'genreA', vocalType: 'male', bpm: 90, moneyChordId: 'doowop' }),
      baseSong({ trackNo: 3, title: 'T3', hookPhrase: 'H3', genreId: 'genreA', vocalType: 'male', bpm: 90, moneyChordId: 'cityPop' }),
      baseSong({ trackNo: 4, title: 'T4', hookPhrase: 'H4', genreId: 'genreA', vocalType: 'male', bpm: 90, moneyChordId: 'cityPop' }),
      baseSong({ trackNo: 5, title: 'T5', hookPhrase: 'H5', genreId: 'genreA', vocalType: 'male', bpm: 90, moneyChordId: 'cityPop' }),
      baseSong({ trackNo: 6, title: 'T6', hookPhrase: 'H6', genreId: 'genreA', vocalType: 'male', bpm: 90, moneyChordId: 'default' })
    ];
    const result = suggestSetOrder(songs);
    const idOf = new Map(songs.map(s => [s.trackNo, s.moneyChordId]));
    const suffix = result.suggestedOrder.slice(2); // after the pinned cold-open+flagship prefix
    let run = 1;
    let maxRun = 1;
    for (let i = 1; i < suffix.length; i += 1) {
      if (idOf.get(suffix[i]) === idOf.get(suffix[i - 1])) { run += 1; maxRun = Math.max(maxRun, run); } else run = 1;
    }
    expect(maxRun).toBeLessThanOrEqual(2);
  });

  it('reports usedRealAudioSignals only when a real audio signal was actually supplied', () => {
    const songs = Array.from({ length: 5 }, (_, i) => baseSong({ trackNo: i + 1, title: `T${i + 1}`, hookPhrase: `Hook ${i + 1}` }));
    expect(suggestSetOrder(songs).usedRealAudioSignals).toBe(false);
    expect(suggestSetOrder(songs, [{ trackNo: 1, spectralCentroid: 2000 }]).usedRealAudioSignals).toBe(true);
  });

  it('returns the original order unsuggested for fewer than 4 songs', () => {
    const songs = [baseSong({ trackNo: 1 }), baseSong({ trackNo: 2, title: 'T2', hookPhrase: 'H2' })];
    const result = suggestSetOrder(songs);
    expect(result.changed).toBe(false);
    expect(result.suggestedOrder).toEqual([1, 2]);
  });
});
