import { describe, expect, it } from 'vitest';
import { preallocateSongSlots, slotsForRange } from '../src/core/batchPreallocation';
import { buildBatchRequestSpecs, type PreallocatedBatchIdentity } from '../src/providers/batchAnthropic';
import { stitchBatchResults, validateStitched, type BatchRequestResult } from '../src/core/batchStitcher';
import { describeSnapshotMismatch, type BatchJobSnapshot } from '../src/core/batchJobs';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { PlaylistBlueprint, ProviderSettings, SongIdea } from '../src/types';

function makeBlueprint(songs: PlaylistBlueprint['songs']): PlaylistBlueprint {
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

function makeSong(trackNo: number, overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo,
    title: `Song ${trackNo}`,
    seasonMoment: 'x',
    listenerSituation: 'x',
    emotionArc: 'x',
    hookPhrase: `Hook ${trackNo}`,
    stylePrompt: 'style',
    lyrics: '[chorus]\nHook',
    thumbnailText: 'x',
    youtube: { title: 'x', description: 'x', tags: ['x'], thumbnailText: 'x' },
    qualityScore: 0,
    warnings: [],
    ...overrides
  };
}

describe('[B2] preallocateSongSlots', () => {
  it('produces exactly songCount slots, all unique titles and hooks', () => {
    const opts = makeOptions({ songCount: 30 });
    const slots = preallocateSongSlots(opts, testGenres);
    expect(slots).toHaveLength(30);
    expect(new Set(slots.map(s => s.trackNo)).size).toBe(30);
    expect(new Set(slots.map(s => s.title.toLowerCase())).size).toBe(30);
    expect(new Set(slots.map(s => s.hookPhrase.toLowerCase())).size).toBe(30);
  });

  it('never reuses a title/hook already listed in the cross-pack avoid set', () => {
    const opts = makeOptions({ songCount: 10 });
    const first = preallocateSongSlots(opts, testGenres);
    const avoid = { usedTitles: first.map(s => s.title), usedHooks: first.map(s => s.hookPhrase) };
    const second = preallocateSongSlots({ ...opts, projectTitle: 'Different Pack' }, testGenres, avoid);
    for (const slot of second) {
      expect(avoid.usedTitles.map(t => t.toLowerCase())).not.toContain(slot.title.toLowerCase());
      expect(avoid.usedHooks.map(h => h.toLowerCase())).not.toContain(slot.hookPhrase.toLowerCase());
    }
  });

  it('slotsForRange returns only the requested trackNos', () => {
    const opts = makeOptions({ songCount: 12 });
    const slots = preallocateSongSlots(opts, testGenres);
    const range = slotsForRange(slots, [7, 8, 9]);
    expect(range.map(s => s.trackNo)).toEqual([7, 8, 9]);
  });
});

describe('[B2] buildBatchRequestSpecs with preallocated identity', () => {
  const settings: ProviderSettings = { provider: 'anthropic', model: 'claude-sonnet-4-5', temperature: 0.8 };

  it('every parallel sub-batch is pinned to its own slice of preassigned titles/hooks — no two batches can invent an overlapping one', () => {
    const opts = makeOptions({ songCount: 18 });
    const slots = preallocateSongSlots(opts, testGenres);
    const preallocated: PreallocatedBatchIdentity = { slots, lockedIdentity: null };
    const specs = buildBatchRequestSpecs(opts, testGenres, testMoods, testSeason, settings, undefined, 6, preallocated);

    expect(specs).toHaveLength(3);
    const allAssignedTitles: string[] = [];
    for (const spec of specs) {
      const user = spec.user as { preassignedSongs: { trackNo: number; title: string; hookPhrase: string }[] };
      expect(user.preassignedSongs.length).toBe(spec.batchSongCount);
      allAssignedTitles.push(...user.preassignedSongs.map(s => s.title));
      expect(spec.volatileSystemText).toContain('preassignedSongs');
    }
    // Structurally impossible to collide: every title across every batch came from one globally-unique local pool.
    expect(new Set(allAssignedTitles.map(t => t.toLowerCase())).size).toBe(allAssignedTitles.length);
  });

  it('threads the same lockedIdentity into every sub-batch user payload', () => {
    const opts = makeOptions({ songCount: 12 });
    const slots = preallocateSongSlots(opts, testGenres);
    const lockedIdentity = {
      oneLineConcept: 'concept', sonicSignature: 'sig', vocalSignature: 'vocal',
      lyricRules: ['a'], harmonyRules: ['b'], visualRules: ['c']
    };
    const specs = buildBatchRequestSpecs(opts, testGenres, testMoods, testSeason, settings, undefined, 6, { slots, lockedIdentity });
    for (const spec of specs) {
      expect((spec.user as { lockedIdentity: unknown }).lockedIdentity).toEqual(lockedIdentity);
    }
  });

  it('omitting preallocated keeps the pre-B2 behavior (no preassignedSongs, empty lockedIdentity) — backward compatible', () => {
    const opts = makeOptions({ songCount: 6 });
    const specs = buildBatchRequestSpecs(opts, testGenres, testMoods, testSeason, settings);
    expect((specs[0].user as { preassignedSongs: unknown[] }).preassignedSongs).toEqual([]);
    expect((specs[0].user as { lockedIdentity: unknown }).lockedIdentity).toBeNull();
    expect(specs[0].volatileSystemText).not.toContain('preassignedSongs');
  });
});

describe('[B3] stitchBatchResults — trackNo-keyed merge', () => {
  const opts = makeOptions();

  it('a retried batch overwrites the original result for the same trackNo instead of duplicating it', () => {
    const original: BatchRequestResult[] = [
      { customId: 'b0', blueprint: makeBlueprint([makeSong(1), makeSong(2)]), usage: null, error: null }
    ];
    const retried: BatchRequestResult[] = [
      { customId: 'b0', blueprint: makeBlueprint([makeSong(2, { title: 'Retried Song 2' })]), usage: null, error: null }
    ];
    const stitched = stitchBatchResults(opts, [...original, ...retried]);
    expect(stitched.blueprint?.songs.map(s => s.trackNo)).toEqual([1, 2]);
    expect(stitched.blueprint?.songs.find(s => s.trackNo === 2)?.title).toBe('Retried Song 2');
  });

  it('defensively reconciles title/hookPhrase/emotionArc back to the preassigned slot, even if the model returned something else', () => {
    const results: BatchRequestResult[] = [
      { customId: 'b0', blueprint: makeBlueprint([makeSong(1, { title: 'Model Invented Title', hookPhrase: 'Model Hook' })]), usage: null, error: null }
    ];
    const preassignedSlots = [{ trackNo: 1, title: 'Locked Title', hookPhrase: 'Locked Hook', songRole: 'opener', tempo: 96, emotionArc: 'locked arc' }];
    const stitched = stitchBatchResults(opts, results, preassignedSlots);
    expect(stitched.blueprint?.songs[0].title).toBe('Locked Title');
    expect(stitched.blueprint?.songs[0].hookPhrase).toBe('Locked Hook');
    expect(stitched.blueprint?.songs[0].emotionArc).toBe('locked arc');
  });
});

describe('[B3] validateStitched', () => {
  it('passes for a complete, gap-free, duplicate-free pack', () => {
    const songs = [makeSong(1), makeSong(2), makeSong(3)];
    const result = validateStitched(songs, 3);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('reports exactly which trackNos are missing', () => {
    const songs = [makeSong(1), makeSong(3)];
    const result = validateStitched(songs, 3);
    expect(result.ok).toBe(false);
    expect(result.missingTrackNos).toEqual([2]);
  });

  it('reports duplicate trackNos', () => {
    const songs = [makeSong(1), makeSong(1), makeSong(2)];
    const result = validateStitched(songs, 2);
    expect(result.duplicateTrackNos).toEqual([1]);
  });

  it('reports trackNos outside the expected 1..expectedCount range', () => {
    const songs = [makeSong(1), makeSong(99)];
    const result = validateStitched(songs, 1);
    expect(result.outOfRangeTrackNos).toContain(99);
  });

  it('reports songs missing required fields (lyrics/stylePrompt/hookPhrase/youtube.title)', () => {
    const songs = [makeSong(1, { lyrics: '' })];
    const result = validateStitched(songs, 1);
    expect(result.incompleteTrackNos).toEqual([1]);
  });

  it('reports duplicate title or hook across different trackNos', () => {
    const songs = [makeSong(1, { title: 'Same Title' }), makeSong(2, { title: 'Same Title' })];
    const result = validateStitched(songs, 2);
    expect(result.duplicateTitleOrHookTrackNos).toEqual([1, 2]);
  });
});

describe('[B1] describeSnapshotMismatch', () => {
  const baseOpts = makeOptions({ seasonId: 'christmas', lyricLanguage: 'english' });
  const snapshot: BatchJobSnapshot = {
    options: baseOpts,
    channel: baseOpts.channel,
    genreIds: baseOpts.genreIds,
    moodIds: baseOpts.moodIds,
    seasonId: 'christmas',
    providerType: 'anthropic',
    model: 'claude-sonnet-4-5',
    temperature: 0.8,
    preassignedSlots: [],
    lockedIdentity: null
  };

  it('returns null when the current screen matches what the batch started with', () => {
    expect(describeSnapshotMismatch(snapshot, baseOpts)).toBeNull();
  });

  it('flags a season change between submission and now', () => {
    const current = makeOptions({ seasonId: 'early-autumn', lyricLanguage: 'english' });
    const message = describeSnapshotMismatch(snapshot, current);
    expect(message).toContain('시즌');
    expect(message).toContain('christmas');
    expect(message).toContain('early-autumn');
  });

  it('flags a lyric language change', () => {
    const current = makeOptions({ seasonId: 'christmas', lyricLanguage: 'korean' });
    const message = describeSnapshotMismatch(snapshot, current);
    expect(message).toContain('가사 언어');
  });
});
