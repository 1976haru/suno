import { describe, expect, it } from 'vitest';
import { recommendConceptLocal } from '../src/core/conceptAgent';
import { findArtistReferenceLeaks } from '../src/core/artistReferenceDecomposer';
import { normalizeGenreSelection } from '../src/core/genreSelection';
import { replaceAxisAllocation } from '../src/core/diversityAllocation';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from './fixtures';
import { vocalPresets } from '../src/data/vocalPresets';
import type { GenerationOptions } from '../src/types';

/**
 * TASK v3.58 — end-to-end reproduction of the brief's own scenario ("비틀즈
 * 스타일로, 아침에 커피와 함께 듣고 싶은 올드팝"): recommend a concept, apply it
 * the same way Step2Concept.tsx's handleApplyConceptRecommendation does
 * (genreIds + a manual 'genre' diversityAllocation + artistReferenceStyleAtoms),
 * then actually generate 18 songs and check the real output — not just that
 * the recommendation object looks right in isolation.
 */
function applyRecommendationToOptions(base: GenerationOptions, rec: ReturnType<typeof recommendConceptLocal>['recommendations'][number], inputText: string): GenerationOptions {
  const vocalPreset = vocalPresets.find(preset => preset.id === rec.vocalPresetId);
  const artistReferenceStyleAtoms = rec.decomposedReferences?.flatMap(ref => [
    ref.eraTag,
    ...ref.instrumentation,
    ...ref.harmonyTraits,
    ...ref.rhythmTraits,
    ...ref.productionTraits,
    ...ref.vocalTraits
  ]) ?? [];
  return {
    ...base,
    genreIds: normalizeGenreSelection(rec.genreAllocation.map(slot => slot.genreId)),
    diversityAllocations: replaceAxisAllocation(base.diversityAllocations, {
      axis: 'genre',
      mode: 'manual',
      counts: Object.fromEntries(rec.genreAllocation.map(slot => [slot.genreId, slot.songCount]))
    }),
    moodIds: rec.moodIds,
    seasonId: rec.seasonId,
    vocalTone: vocalPreset?.prompt || base.vocalTone,
    customConcept: inputText,
    artistReferenceStyleAtoms: artistReferenceStyleAtoms.length ? artistReferenceStyleAtoms : base.artistReferenceStyleAtoms
  };
}

describe('[v3.58] concept-to-generation integration ("비틀즈 스타일로, 아침에 커피와 함께")', () => {
  const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
  const season = seasonPacks[0];
  const input = '비틀즈 스타일로, 아침에 커피와 함께 듣고 싶은 올드팝';

  const baseOpts: GenerationOptions = {
    channel,
    projectTitle: 'Integration Test',
    songCount: 18,
    lyricLanguage: 'english',
    market: channel.market,
    audience: channel.audience,
    genreIds: channel.preferredGenres,
    moodIds: channel.preferredMoods,
    seasonId: season.id,
    vocalTone: channel.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customMoneyChord: '',
    customConcept: '',
    avoidWords: ''
  };

  const conceptResult = recommendConceptLocal(input, channel.archetype, undefined, 0, 18);
  const rec = conceptResult.recommendations[0];
  const opts = applyRecommendationToOptions(baseOpts, rec, input);
  const genres = genrePacks.filter(g => opts.genreIds.includes(g.id));
  const moods = moodPacks.filter(m => opts.moodIds.includes(m.id));
  const blueprint = generateLocalBlueprint(opts, genres, moods, season);

  it('produces a genre pool of at least 3 distinct genres', () => {
    expect(new Set(opts.genreIds).size).toBeGreaterThanOrEqual(3);
  });

  it('actually assigns multiple distinct genreIds across the generated 18 songs, none exceeding the cap', () => {
    const counts = new Map<string, number>();
    for (const song of blueprint.songs) {
      if (song.genreId) counts.set(song.genreId, (counts.get(song.genreId) || 0) + 1);
    }
    expect(counts.size).toBeGreaterThanOrEqual(3);
    const cap = Math.floor(18 * 0.28);
    for (const [genreId, count] of counts) {
      expect(count, genreId).toBeLessThanOrEqual(cap);
    }
  });

  it('never leaks the detected artist name into any style prompt', () => {
    for (const song of blueprint.songs) {
      expect(findArtistReferenceLeaks(song.stylePrompt), `track ${song.trackNo}`).toEqual([]);
    }
  });

  it('generates in well under 10 seconds for 18 songs', () => {
    const start = performance.now();
    generateLocalBlueprint(opts, genres, moods, season);
    expect(performance.now() - start).toBeLessThan(10_000);
  });

  it('weaves at least one artist-derived musical descriptor into the pack somewhere (proves the wiring, not just the recommendation object)', () => {
    const pool = rec.decomposedReferences?.flatMap(ref => [...ref.instrumentation, ...ref.harmonyTraits, ...ref.rhythmTraits, ...ref.productionTraits, ...ref.vocalTraits]) ?? [];
    expect(pool.length).toBeGreaterThan(0);
    const anyMatch = blueprint.songs.some(song => pool.some(descriptor => song.stylePrompt.includes(descriptor)));
    expect(anyMatch).toBe(true);
  });
});
