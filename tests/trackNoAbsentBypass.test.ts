/**
 * v5.17 (TASK E) — end-to-end coverage, through the REAL import entry point
 * (core/bridgeImport.ts's importSongsJson) and the pre-persistence
 * classifier (core/importInspection.ts's inspectImportReport), for the exact
 * bug tests/importValidation.test.ts's own unit tests cover at the
 * validateProviderTrackSet level: an absent trackNo used to be excluded from
 * duplicate/missing detection entirely, while the real normalizer
 * (bridgeImport.ts's claimedTrackNoFor) resolved it to this entry's own
 * array position and claimed a slot with it — so the checker and the
 * normalizer disagreed about what an absent trackNo actually claims.
 *
 * Scenario H — an absent trackNo whose fallback position collides with
 * another entry's explicit trackNo must hard-block the whole import (it
 * used to sail through as "no duplicates").
 * Scenario I — a genuinely all-absent, positionally-sequential response
 * (the "every song omits trackNo, always did" legacy shape) must import
 * cleanly with nothing reported missing (it used to report every track
 * missing).
 * Scenario J — a response where only some tracks omit trackNo, and none of
 * the fallback positions collide, must also import cleanly.
 */
import { describe, expect, it } from 'vitest';
import { importSongsJson, extractRawImportedSongs } from '../src/core/bridgeImport';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { inspectImportReport } from '../src/core/importInspection';
import { channelPresets, genrePacks, moodPacks, makeOptions, testSeason } from './fixtures';
import type { GenerationOptions } from '../src/types';

const SONG_COUNT = 4;

function optsFor(overrides: Partial<GenerationOptions> = {}): GenerationOptions {
  const channel = channelPresets[0];
  return makeOptions({
    channel,
    songCount: SONG_COUNT,
    lyricLanguage: 'english',
    genreIds: channel.preferredGenres,
    moodIds: channel.preferredMoods,
    vocalTone: channel.defaultVocal,
    ...overrides
  });
}

function runImport(songCount: number, songs: Record<string, unknown>[]) {
  const opts = optsFor({ songCount });
  const genres = genrePacks.filter(g => opts.genreIds.includes(g.id));
  const moods = moodPacks.filter(m => opts.moodIds.includes(m.id));
  const slots = preallocateSongSlots(opts, genres);
  const rawText = JSON.stringify({ songs });
  const report = importSongsJson(rawText, opts, genres, moods, testSeason, slots);
  const rawSongs = extractRawImportedSongs(rawText);
  const inspection = inspectImportReport(report, rawSongs, opts.lyricLanguage);
  return { opts, report, rawSongs, inspection };
}

function song(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'Track',
    hookPhrase: 'Hook line',
    stylePrompt: 'warm acoustic guitar, gentle piano, mid tempo',
    lyrics: '[female vocal]\nHook line\nsome more words here to pass length checks',
    ...overrides
  };
}

describe('[v5.17 TASK E] scenario H — an absent trackNo colliding with another entry\'s explicit trackNo hard-blocks the whole import', () => {
  it('rejects the response instead of silently letting the second entry win the slot', () => {
    const songs = [
      song({ trackNo: null, title: 'Implicit T1' }),
      song({ trackNo: 1, title: 'Explicit T1' }),
      song({ trackNo: 2, title: 'T2' }),
      song({ trackNo: 3, title: 'T3' })
    ];
    const { report, inspection } = runImport(4, songs);
    expect(report.blueprint).toBeNull();
    expect(report.skippedReasons.join(' ')).toContain('trackNo 구조 오류');
    expect(inspection.status).toBe('blocked');
  });
});

describe('[v5.17 TASK E] scenario I — a genuinely all-absent, positionally-sequential response imports cleanly, no false "all missing"', () => {
  it('every track present, nothing reported missing', () => {
    const songs = Array.from({ length: SONG_COUNT }, (_, i) => song({ title: `Track ${i + 1}` }));
    // Sanity: every entry genuinely omits trackNo, the exact legacy shape this scenario is about.
    expect(songs.every(s => !('trackNo' in s))).toBe(true);

    const { report, inspection } = runImport(SONG_COUNT, songs);
    expect(report.blueprint).not.toBeNull();
    expect(report.importedCount).toBe(SONG_COUNT);
    expect(inspection.missingTrackNos).toEqual([]);
    expect(inspection.status).toBe('valid');
    expect(report.blueprint!.songs.map(s => s.trackNo).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });
});

describe('[v5.17 TASK E] scenario J — some tracks omit trackNo, no collisions, imports cleanly', () => {
  it('the omitted entries resolve to their own (non-colliding) array position', () => {
    const songs = [
      song({ trackNo: 1, title: 'T1' }),
      song({ title: 'T2 (implicit)' }), // omitted -> falls back to index 1 -> trackNo 2, matching its real position
      song({ trackNo: 3, title: 'T3' }),
      song({ title: 'T4 (implicit)' }) // omitted -> falls back to index 3 -> trackNo 4
    ];
    const { report, inspection } = runImport(SONG_COUNT, songs);
    expect(report.blueprint).not.toBeNull();
    expect(inspection.missingTrackNos).toEqual([]);
    expect(inspection.status).toBe('valid');
    expect(report.blueprint!.songs.map(s => s.trackNo).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });
});
