import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { genresForTrack } from '../src/core/genreRotation';
import { GENRE_FORBIDDEN_DESCRIPTORS } from '../src/data/genreForbiddenDescriptors';
import { channelPresets, genrePacks, makeOptions, moodPacks, seasonPacks } from './fixtures';

/**
 * TASK v3.58 — regression suite for the genreRotation.ts ordering bug:
 * genresForTrack used to always keep genres[0] (the channel's primary
 * genre) in position 0, no matter which genre a track was actually
 * assigned. Since the style-prompt builder reads genreSignature/
 * genreNarrative from position 0, every song in an 18-song pack rendered
 * with the SAME genre's musical identity regardless of its genreId label —
 * a jazz-pop-labeled song got adult-contemporary's "no swing" instruction.
 * Tests 2 and 3 below are written to FAIL against the pre-fix code (see the
 * v3.58 report for the actual pre-fix run) and only pass once genresForTrack
 * puts the lead genre first.
 */

const GENRE_POOL_IDS = ['retro-soul-pop', 'jazz-pop', 'adult-contemporary', 'acoustic-pop'];

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let intersection = 0;
  for (const clause of a) if (b.has(clause)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function musicClauseSet(prompt: string): Set<string> {
  return new Set(
    prompt
      .split(',')
      .map(clause => clause.trim().toLowerCase())
      .filter(clause => !/^\d{2,3} bpm$/.test(clause))
      .filter(clause => !/repeats chorus|repeated chorus hook|hook repeats \d+x|same channel vocal signature/.test(clause))
      .filter(clause => !/\b(vocal|voice|tenor|alto|soprano|choir|singer)\b/.test(clause))
      .filter(clause => !/progression|3:10-3:35|short intro|radio edit|complete song/.test(clause))
      .filter(clause => !/^concept (cue|emphasis):/.test(clause))
      .filter(Boolean)
  );
}

function avgPairwise(prompts: string[]): number {
  if (prompts.length < 2) return 1;
  let total = 0;
  let count = 0;
  for (let i = 0; i < prompts.length; i++) {
    for (let j = i + 1; j < prompts.length; j++) {
      total += jaccard(musicClauseSet(prompts[i]), musicClauseSet(prompts[j]));
      count += 1;
    }
  }
  return total / count;
}

function avgCross(a: string[], b: string[]): number {
  let total = 0;
  let count = 0;
  for (const pa of a) {
    for (const pb of b) {
      total += jaccard(musicClauseSet(pa), musicClauseSet(pb));
      count += 1;
    }
  }
  return total / count;
}

function generateFourGenrePack() {
  const channel = channelPresets.find(item => item.id === 'good-morning-memory-radio')!;
  const genres = genrePacks.filter(genre => GENRE_POOL_IDS.includes(genre.id));
  const moods = moodPacks.filter(mood => channel.preferredMoods.includes(mood.id));
  const season = seasonPacks[0];
  const opts = makeOptions({
    channel,
    songCount: 18,
    genreIds: GENRE_POOL_IDS,
    moodIds: moods.map(mood => mood.id),
    seasonId: season.id
  });
  return generateLocalBlueprint(opts, genres, moods, season);
}

function groupByGenreId(songs: { genreId?: string; stylePrompt: string }[]): Map<string, string[]> {
  const byGenre = new Map<string, string[]>();
  for (const song of songs) {
    const id = song.genreId || 'unknown';
    byGenre.set(id, [...(byGenre.get(id) || []), song.stylePrompt]);
  }
  return byGenre;
}

describe('[v3.58 TASK 1] genresForTrack lead-genre ordering', () => {
  it('always puts the lead genre in position 0, for every genre in the pool', () => {
    const pool = genrePacks.filter(genre => GENRE_POOL_IDS.includes(genre.id));
    for (const genre of pool) {
      const result = genresForTrack(pool, genre.id);
      expect(result[0]?.id, `lead=${genre.id}`).toBe(genre.id);
    }
  });

  it('falls back to the primary genre in position 0 only when no lead is given', () => {
    const pool = genrePacks.filter(genre => GENRE_POOL_IDS.includes(genre.id));
    const result = genresForTrack(pool, undefined);
    expect(result[0]?.id).toBe(pool[0].id);
  });
});

describe('[v3.58 TASK 1] cross-genre style-prompt separation', () => {
  it('mean between-genre similarity is at least 0.15 below mean within-genre similarity', () => {
    const blueprint = generateFourGenrePack();
    const byGenre = groupByGenreId(blueprint.songs);
    expect(byGenre.size, 'expected all 4 genres to actually be assigned to at least one track').toBe(4);

    const withinSims = [...byGenre.values()].map(avgPairwise);
    const meanWithin = withinSims.reduce((sum, value) => sum + value, 0) / withinSims.length;

    const ids = [...byGenre.keys()];
    const betweenSims: number[] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        betweenSims.push(avgCross(byGenre.get(ids[i])!, byGenre.get(ids[j])!));
      }
    }
    const meanBetween = betweenSims.reduce((sum, value) => sum + value, 0) / betweenSims.length;

    expect(meanBetween, `meanWithin=${meanWithin.toFixed(3)} meanBetween=${meanBetween.toFixed(3)}`).toBeLessThanOrEqual(meanWithin - 0.15);
  });
});

describe('[v3.58 TASK 1] genre-exclusive style descriptors', () => {
  it('never mixes a mutually-exclusive descriptor into a genre it contradicts', () => {
    const blueprint = generateFourGenrePack();
    const byGenre = groupByGenreId(blueprint.songs);
    const violations: string[] = [];

    for (const rule of GENRE_FORBIDDEN_DESCRIPTORS) {
      for (const genreId of rule.genreIds) {
        const prompts = byGenre.get(genreId) || [];
        prompts.forEach((prompt, index) => {
          const lower = prompt.toLowerCase();
          for (const phrase of rule.forbiddenPhrases) {
            if (lower.includes(phrase)) {
              violations.push(`${genreId} track#${index}: contains forbidden phrase "${phrase}"`);
            }
          }
        });
      }
    }

    expect(violations).toEqual([]);
  });
});
