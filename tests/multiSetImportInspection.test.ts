/**
 * v5.17 (TASK B) — coverage for core/multiSetImportInspection.ts, the pure
 * decision layer that closes the real gap this task's audit found: the
 * multi-set bridge import path used to save every set the instant
 * importSongsJson returned a non-null blueprint, with none of the
 * single-set path's inspectImportReport classification (missing tracks,
 * artist-name leaks, language mismatches) ever applied. Uses the same real
 * provider-response fixtures tests/importInspection.test.ts already
 * exercises through the single-set path, so a set built from
 * duplicateTrackNo.json/missingTracks.json/normal.json behaves identically
 * whether it's imported through the single- or multi-set entry point.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importSongsJson, extractRawImportedSongs } from '../src/core/bridgeImport';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { detectCrossSetDuplicates, planMultiSetImport, type MultiSetImportSetInput } from '../src/core/multiSetImportInspection';
import { channelPresets, genrePacks, moodPacks, makeOptions, testSeason } from './fixtures';
import type { GenerationOptions } from '../src/types';

const FIXTURES_DIR = resolve(__dirname, 'fixtures', 'providerResponses');
const FIXTURE_SONG_COUNT = 5;

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf8');
}

function optsFor(overrides: Partial<GenerationOptions> = {}): GenerationOptions {
  const channel = channelPresets[0];
  return makeOptions({
    channel,
    songCount: FIXTURE_SONG_COUNT,
    lyricLanguage: 'english',
    genreIds: channel.preferredGenres,
    moodIds: channel.preferredMoods,
    vocalTone: channel.defaultVocal,
    ...overrides
  });
}

function buildSetInput(setIndex: number, fixtureName: string, optsOverrides: Partial<GenerationOptions> = {}, fileName?: string): MultiSetImportSetInput {
  const opts = optsFor(optsOverrides);
  const genres = genrePacks.filter(g => opts.genreIds.includes(g.id));
  const moods = moodPacks.filter(m => opts.moodIds.includes(m.id));
  const slots = preallocateSongSlots(opts, genres);
  const rawText = loadFixture(fixtureName);
  const report = importSongsJson(rawText, opts, genres, moods, testSeason, slots);
  const rawSongs = extractRawImportedSongs(rawText);
  return { setIndex, report, rawSongs, importOpts: opts, ...(fileName ? { fileName } : {}) };
}

describe('[v5.17 TASK B] planMultiSetImport — per-set ImportStatus, reused from inspectImportReport', () => {
  it('every set clean (normal.json x3) — all ready to persist, batch not blocked', () => {
    const inputs = [1, 2, 3].map(setIndex => buildSetInput(setIndex, 'normal.json'));
    const plan = planMultiSetImport(inputs);
    expect(plan.wholeBatchBlocked).toBe(false);
    expect(plan.readyToPersist.map(r => r.setIndex)).toEqual([1, 2, 3]);
    expect(plan.pendingConfirmation).toEqual([]);
  });

  it('one set structurally corrupt (duplicateTrackNo.json) blocks the WHOLE batch — even the clean sets are held back (spec §2-3)', () => {
    const inputs = [buildSetInput(1, 'normal.json'), buildSetInput(2, 'duplicateTrackNo.json'), buildSetInput(3, 'normal.json')];
    const plan = planMultiSetImport(inputs);
    expect(plan.wholeBatchBlocked).toBe(true);
    // Nothing persists — not set 2 (the actually broken one), and not sets 1/3 either.
    expect(plan.readyToPersist).toEqual([]);
    expect(plan.pendingConfirmation).toEqual([]);
    expect(plan.results.find(r => r.setIndex === 2)!.inspection.status).toBe('blocked');
  });

  it('one set repairable (missingTracks.json, 4 of 5) holds back ONLY that set — the clean sets still persist (spec §2-3)', () => {
    const inputs = [buildSetInput(1, 'normal.json'), buildSetInput(2, 'missingTracks.json'), buildSetInput(3, 'normal.json')];
    const plan = planMultiSetImport(inputs);
    expect(plan.wholeBatchBlocked).toBe(false);
    expect(plan.readyToPersist.map(r => r.setIndex)).toEqual([1, 3]);
    expect(plan.pendingConfirmation.map(r => r.setIndex)).toEqual([2]);
    expect(plan.pendingConfirmation[0].inspection.status).toBe('repairable');
  });

  it('an artist-name leak in one set is repairable (not a whole-batch block), matching the single-set v5.19 behavior', () => {
    const inputs = [buildSetInput(1, 'normal.json'), buildSetInput(2, 'artistNameLeak.json')];
    const plan = planMultiSetImport(inputs);
    expect(plan.wholeBatchBlocked).toBe(false);
    expect(plan.results.find(r => r.setIndex === 2)!.inspection.status).toBe('repairable');
    expect(plan.results.find(r => r.setIndex === 2)!.inspection.artistLeakTrackNos.length).toBeGreaterThan(0);
  });

  it('an invalid (out-of-range) trackNo set also blocks the whole batch, same as duplicateTrackNo', () => {
    const inputs = [buildSetInput(1, 'normal.json'), buildSetInput(2, 'invalidTrackNo.json')];
    const plan = planMultiSetImport(inputs);
    expect(plan.wholeBatchBlocked).toBe(true);
    expect(plan.readyToPersist).toEqual([]);
  });
});

describe('[v5.17 TASK B §2-4] detectCrossSetDuplicates — problems only a multi-set batch can have', () => {
  it('flags the same hook reused across two sets', () => {
    const songs = (hook: string, title: string) => [{ trackNo: 1, hookPhrase: hook, title, lyrics: '', stylePrompt: '' } as never];
    const warnings = detectCrossSetDuplicates([
      { setIndex: 1, songs: songs('Shine on tonight', 'Track A') },
      { setIndex: 2, songs: songs('Shine on tonight', 'Track B') }
    ]);
    const hookWarning = warnings.find(w => w.kind === 'hook');
    expect(hookWarning).toBeDefined();
    expect(hookWarning!.setIndexes).toEqual([1, 2]);
  });

  it('flags the same title reused across two sets', () => {
    const songs = (hook: string, title: string) => [{ trackNo: 1, hookPhrase: hook, title, lyrics: '', stylePrompt: '' } as never];
    const warnings = detectCrossSetDuplicates([
      { setIndex: 1, songs: songs('Hook A', 'Golden Morning') },
      { setIndex: 2, songs: songs('Hook B', 'Golden Morning') }
    ]);
    const titleWarning = warnings.find(w => w.kind === 'title');
    expect(titleWarning).toBeDefined();
    expect(titleWarning!.setIndexes).toEqual([1, 2]);
  });

  it('flags two sets with an identical genre distribution', () => {
    const songs = (genreId: string) => [
      { trackNo: 1, hookPhrase: 'h1', title: 't1', lyrics: '', stylePrompt: '', genreId } as never,
      { trackNo: 2, hookPhrase: 'h2', title: 't2', lyrics: '', stylePrompt: '', genreId } as never
    ];
    const warnings = detectCrossSetDuplicates([
      { setIndex: 1, songs: songs('genre-a') },
      { setIndex: 2, songs: songs('genre-a') }
    ]);
    const genreWarning = warnings.find(w => w.kind === 'genreDistribution');
    expect(genreWarning).toBeDefined();
    expect(genreWarning!.setIndexes).toEqual([1, 2]);
  });

  it('no false positives across genuinely distinct sets', () => {
    const warnings = detectCrossSetDuplicates([
      { setIndex: 1, songs: [{ trackNo: 1, hookPhrase: 'Hook one', title: 'Title one', lyrics: '', stylePrompt: '', genreId: 'genre-a' } as never] },
      { setIndex: 2, songs: [{ trackNo: 1, hookPhrase: 'Hook two', title: 'Title two', lyrics: '', stylePrompt: '', genreId: 'genre-b' } as never] }
    ]);
    expect(warnings).toEqual([]);
  });

  it('planMultiSetImport surfaces crossSetDuplicates computed from the real imported blueprints', () => {
    // Two normal.json imports under the exact same options produce identical
    // (fixture-authored) titles/hooks/genre distribution — a real repeat.
    const inputs = [buildSetInput(1, 'normal.json'), buildSetInput(2, 'normal.json')];
    const plan = planMultiSetImport(inputs);
    expect(plan.crossSetDuplicates.length).toBeGreaterThan(0);
  });
});

describe('[v5.18 P1-3] planMultiSetImport structuralWarnings — batch-level file/meta consistency', () => {
  it('flags a file whose own embedded set number disagrees with the setIndex it was assigned', () => {
    // setIndex 0 (set 1) but the filename claims to be set 3.
    const inputs = [buildSetInput(0, 'normal.json', {}, 'channel_concept_set03.json'), buildSetInput(1, 'normal.json', {}, 'channel_concept_set02.json')];
    const plan = planMultiSetImport(inputs);
    const warning = plan.structuralWarnings.find(w => w.kind === 'filenameSetMismatch');
    expect(warning).toBeDefined();
    expect(warning!.setIndexes).toEqual([0]);
  });

  it('no filenameSetMismatch when every filename agrees with its assigned setIndex', () => {
    const inputs = [buildSetInput(0, 'normal.json', {}, 'channel_concept_set01.json'), buildSetInput(1, 'normal.json', {}, 'channel_concept_set02.json')];
    const plan = planMultiSetImport(inputs);
    expect(plan.structuralWarnings.find(w => w.kind === 'filenameSetMismatch')).toBeUndefined();
  });

  it('flags a batch with fewer files than the requested set count', () => {
    const inputs = [buildSetInput(0, 'normal.json'), buildSetInput(1, 'normal.json')];
    const plan = planMultiSetImport(inputs, undefined, undefined, 3);
    const warning = plan.structuralWarnings.find(w => w.kind === 'setCountMismatch');
    expect(warning).toBeDefined();
  });

  it('no setCountMismatch when expectedSetCount matches the real batch size', () => {
    const inputs = [buildSetInput(0, 'normal.json'), buildSetInput(1, 'normal.json')];
    const plan = planMultiSetImport(inputs, undefined, undefined, 2);
    expect(plan.structuralWarnings.find(w => w.kind === 'setCountMismatch')).toBeUndefined();
  });

  it('flags a set whose real imported song count falls short of its own requested songCount', () => {
    // missingTracks.json only carries 4 of the fixture's 5 requested songs.
    const inputs = [buildSetInput(0, 'normal.json'), buildSetInput(1, 'missingTracks.json')];
    const plan = planMultiSetImport(inputs);
    const warning = plan.structuralWarnings.find(w => w.kind === 'songCountMismatch');
    expect(warning).toBeDefined();
    expect(warning!.setIndexes).toEqual([1]);
  });

  it('flags two sets resolving to the same pack identity (channel + title + song count)', () => {
    // Same options both times -> identical channelName/projectTitle/songs.length.
    const inputs = [buildSetInput(0, 'normal.json'), buildSetInput(1, 'normal.json')];
    const plan = planMultiSetImport(inputs);
    const warning = plan.structuralWarnings.find(w => w.kind === 'packIdDuplicate');
    expect(warning).toBeDefined();
    expect(warning!.setIndexes).toEqual([0, 1]);
  });

  it('flags a batch where sets were generated under different workspaces', () => {
    const kidsChannel = channelPresets.find(c => c.archetype === 'kr-kids-song')!;
    expect(kidsChannel).toBeDefined();
    const inputs = [buildSetInput(0, 'normal.json'), buildSetInput(1, 'normal.json', { channel: kidsChannel, genreIds: kidsChannel.preferredGenres, moodIds: kidsChannel.preferredMoods, vocalTone: kidsChannel.defaultVocal })];
    const plan = planMultiSetImport(inputs);
    const warning = plan.structuralWarnings.find(w => w.kind === 'workspaceIdMismatch');
    expect(warning).toBeDefined();
    expect(warning!.setIndexes).toEqual([0, 1]);
  });
});
