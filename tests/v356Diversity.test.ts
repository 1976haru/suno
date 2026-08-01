import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { lintInPackStyleSimilarity } from '../src/core/diversityLinter';
import { channelPresets, genrePacks, makeOptions, moodPacks, seasonPacks } from './fixtures';
import { vocalPresets } from '../src/data/vocalPresets';
import type { GenrePack } from '../src/types';

// TASK v3.72 (TASK A) — vocalTone: channel.defaultVocal used to mean
// "usesVocalQuota() stays off, fall back to variedVocalText's own 18-entry
// per-track rotation" (real measurement: still >=12 distinct openings, see
// below). It now means "untouched, engage the auto register/delivery/
// timbre/proximity quota" instead — whose register axis is capped at 2
// occurrences per value (v3.72's own explicit requirement) across a 6-track
// gender split, which can't reach the same raw distinct-opening count
// variedVocalText's dedicated 18-slot pool did. This test is about
// genreSignature/instrument opening diversity (see this file's own
// docstring), not vocal diversity (already covered by tests/vocalPlan.test.ts),
// so an explicit non-default vocalTone keeps its original intent testable.
const EXPLICIT_VOCAL_TONE = vocalPresets.find(p => p.id === 'low-calm-male')!.prompt;

/**
 * TASK v3.56 Part 2/3/4 verification — the reported diagnosis was 1/18
 * distinct stylePrompt openings and 0.652 average pairwise style similarity
 * across an 18-song set. These tests lock in the fix (variedVocalText's
 * 18-entry rotation, rotatingGenreSignatureText, promptPriorityForTrack's
 * vocal-weighted rotation) and the 6 new/upgraded genres' mutual exclusivity
 * so a future change can't silently regress either.
 */
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
      .filter(clause => !/repeats chorus|repeated chorus hook|same channel vocal signature/.test(clause))
      .filter(clause => !/\b(vocal|voice|tenor|alto|soprano|choir|singer)\b/.test(clause))
      .filter(clause => !/progression|3:10-3:35|short intro|radio edit|complete song/.test(clause))
      .filter(clause => !/^concept (cue|emphasis):/.test(clause))
      .filter(Boolean)
  );
}

function generatePack(channelId: string, songCount = 18) {
  const channel = channelPresets.find(item => item.id === channelId)!;
  const season = seasonPacks[0];
  const genres = genrePacks.filter(genre => channel.preferredGenres.includes(genre.id));
  const moods = moodPacks.filter(mood => channel.preferredMoods.includes(mood.id));
  const opts = makeOptions({
    channel,
    songCount,
    lyricLanguage: channel.primaryLanguage,
    genreIds: channel.preferredGenres,
    moodIds: channel.preferredMoods,
    seasonId: season.id,
    vocalTone: EXPLICIT_VOCAL_TONE
  });
  return generateLocalBlueprint(opts, genres, moods, season);
}

function promptForGenre(channelId: string, genreId: string) {
  const channel = channelPresets.find(item => item.id === channelId)!;
  const genre = genrePacks.find(item => item.id === genreId)!;
  const season = seasonPacks[0];
  const moods = moodPacks.filter(mood => channel.preferredMoods.includes(mood.id));
  const opts = makeOptions({
    channel,
    songCount: 1,
    lyricLanguage: channel.primaryLanguage,
    genreIds: [genre.id],
    moodIds: moods.map(mood => mood.id),
    seasonId: season.id,
    vocalTone: channel.defaultVocal
  });
  return generateLocalBlueprint(opts, [genre], moods, season).songs[0].stylePrompt;
}

const PACK_CHANNEL_IDS = ['good-morning-memory-radio', 'morning-showa-cafe', 'chill-hours', 'city-night-drive'];

describe('[v3.56 Part 2] 18-song stylePrompt diversity', () => {
  it.each(PACK_CHANNEL_IDS)('%s: at least 12/18 distinct stylePrompt openings', channelId => {
    const blueprint = generatePack(channelId);
    const openings = blueprint.songs.map(song => song.stylePrompt.split(',')[0].trim());
    expect(new Set(openings).size, channelId).toBeGreaterThanOrEqual(12);
  });

  it.each(PACK_CHANNEL_IDS)('%s: average pairwise style similarity below 0.4', channelId => {
    const blueprint = generatePack(channelId);
    const report = lintInPackStyleSimilarity(blueprint.songs.map(song => ({ trackNo: song.trackNo, stylePrompt: song.stylePrompt })));
    expect(report.averageSimilarity, channelId).toBeLessThan(0.4);
  });

  it.each(PACK_CHANNEL_IDS)('%s: no vocal-description opening repeats 3+ times in one set', channelId => {
    const blueprint = generatePack(channelId);
    const report = lintInPackStyleSimilarity(blueprint.songs.map(song => ({ trackNo: song.trackNo, stylePrompt: song.stylePrompt })));
    expect(report.repeatedVocalStarts, channelId).toEqual([]);
  });
});

describe('[v3.56 Part 3] new/upgraded genre exclusivity', () => {
  it('keeps jazz-pop vs adult-contemporary style similarity below 0.35', () => {
    const similarity = jaccard(
      musicClauseSet(promptForGenre('good-morning-memory-radio', 'adult-contemporary')),
      musicClauseSet(promptForGenre('good-morning-memory-radio', 'jazz-pop'))
    );
    expect(similarity).toBeLessThan(0.35);
  });

  it('keeps chanson vs contemporary-rnb style similarity below 0.30', () => {
    const similarity = jaccard(
      musicClauseSet(promptForGenre('good-morning-memory-radio', 'chanson')),
      musicClauseSet(promptForGenre('chill-hours', 'contemporary-rnb'))
    );
    expect(similarity).toBeLessThan(0.3);
  });

  const NEW_GENRE_IDS = ['chanson', 'smooth-jazz-lounge', 'bossa-cafe', 'contemporary-rnb', 'city-pop-night', 'lofi-soul'];

  function keywordsFor(genre: GenrePack): Set<string> {
    const text = [genre.signatureSound, genre.shortSignatureSound, genre.minimalSignatureSound].filter(Boolean).join(', ').toLowerCase();
    return new Set(text.split(/[,\s]+/).filter(word => word.length > 3));
  }

  it.each(NEW_GENRE_IDS)('%s carries at least 3 signatureSound keywords no other genre uses', genreId => {
    const genre = genrePacks.find(item => item.id === genreId)!;
    const myWords = keywordsFor(genre);
    const otherWords = new Set<string>();
    for (const other of genrePacks) {
      if (other.id === genreId) continue;
      for (const word of keywordsFor(other)) otherWords.add(word);
    }
    const unique = [...myWords].filter(word => !otherWords.has(word));
    expect(unique.length, genreId).toBeGreaterThanOrEqual(3);
  });

  it('assigns the 3 senior/cafe additions and 3 2030-channel additions to the correct archetypes', () => {
    const seniorCafeIds = ['chanson', 'smooth-jazz-lounge', 'bossa-cafe'];
    const modernIds = ['contemporary-rnb', 'city-pop-night', 'lofi-soul'];
    for (const id of seniorCafeIds) {
      const genre = genrePacks.find(item => item.id === id)!;
      expect(genre.archetypes, id).toContain('senior-morning');
    }
    for (const id of modernIds) {
      const genre = genrePacks.find(item => item.id === id)!;
      expect(genre.archetypes?.some(archetype => archetype === 'modern-chill' || archetype === 'city-night'), id).toBe(true);
    }
  });
});
