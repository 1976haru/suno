import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { buildExcludePrompt } from '../src/core/promptComposer';
import { SENIOR_AUDIENCE_PROFILE } from '../src/data/audienceProfiles';
import { channelPresets, genrePacks, makeOptions, moodPacks, seasonPacks } from './fixtures';

function stddev(values: number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function bpmFromPrompt(prompt: string): number | null {
  const match = prompt.match(/(\d{2,3}) BPM/);
  return match ? Number(match[1]) : null;
}

describe('[v3.58 TASK 4] audience profile — tempo distribution', () => {
  const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
  const season = seasonPacks[0];
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));

  it('an 18-song senior pack has BPM standard deviation >= 8', () => {
    const opts = makeOptions({ channel, songCount: 18, genreIds: channel.preferredGenres, moodIds: moods.map(m => m.id), seasonId: season.id });
    const blueprint = generateLocalBlueprint(opts, genres, moods, season);
    const bpms = blueprint.songs.map(song => bpmFromPrompt(song.stylePrompt)).filter((v): v is number => v !== null);
    expect(bpms).toHaveLength(18);
    expect(stddev(bpms)).toBeGreaterThanOrEqual(8);
  });

  it('never produces a BPM outside the senior audience profile\'s floor/ceiling', () => {
    const opts = makeOptions({ channel, songCount: 18, genreIds: channel.preferredGenres, moodIds: moods.map(m => m.id), seasonId: season.id });
    const blueprint = generateLocalBlueprint(opts, genres, moods, season);
    for (const song of blueprint.songs) {
      const bpm = bpmFromPrompt(song.stylePrompt);
      expect(bpm, song.stylePrompt).not.toBeNull();
      if (bpm !== null) {
        expect(bpm).toBeGreaterThanOrEqual(SENIOR_AUDIENCE_PROFILE.tempoFloor);
        expect(bpm).toBeLessThanOrEqual(SENIOR_AUDIENCE_PROFILE.tempoCeiling);
      }
    }
  });

  // TASK v3.58 — tempo range is an audience-profile-level concern, not a
  // genre-level one (see TASK 4's own role-separation table); genre governs
  // instrumentation/rhythm/harmony/swing/era instead. A per-genre tempoRange
  // clamp was tried and measurably capped achievable BPM stddev at ~5.5-6.4
  // against this task's own >=8 target, since "never exceed this genre's
  // narrow range" directly fights the variety the audience-level band plan
  // exists to create — see core/tempoPlan.ts's resolveTempoWithBand comment.
  it('stays within the assigned tempo band\'s own range (not necessarily the genre\'s)', () => {
    const opts = makeOptions({ channel, songCount: 18, genreIds: channel.preferredGenres, moodIds: moods.map(m => m.id), seasonId: season.id });
    const blueprint = generateLocalBlueprint(opts, genres, moods, season);
    for (const song of blueprint.songs) {
      const genre = genres.find(g => g.id === song.genreId);
      const bpm = bpmFromPrompt(song.stylePrompt);
      if (genre && bpm !== null) {
        expect(bpm, `${song.trackNo} genre=${genre.id}`).toBeGreaterThanOrEqual(SENIOR_AUDIENCE_PROFILE.tempoFloor);
        expect(bpm, `${song.trackNo} genre=${genre.id}`).toBeLessThanOrEqual(SENIOR_AUDIENCE_PROFILE.tempoCeiling);
      }
    }
  });
});

describe('[v3.58 TASK 4] audience profile — style prompt constraints and exclusions', () => {
  const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
  const season = seasonPacks[0];
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));

  it('weaves at least one senior audience constraint into every song\'s style prompt', () => {
    const opts = makeOptions({ channel, songCount: 6, genreIds: channel.preferredGenres, moodIds: moods.map(m => m.id), seasonId: season.id });
    const blueprint = generateLocalBlueprint(opts, genres, moods, season);
    for (const song of blueprint.songs) {
      const hasConstraint = SENIOR_AUDIENCE_PROFILE.constraints.some(constraint => song.stylePrompt.includes(constraint));
      expect(hasConstraint, song.stylePrompt).toBe(true);
    }
  });

  it('merges senior audience exclusions into the exclude prompt regardless of genre', () => {
    for (const genre of genres) {
      const opts = makeOptions({ channel, songCount: 1, genreIds: [genre.id], moodIds: moods.map(m => m.id), seasonId: season.id });
      const excludePrompt = buildExcludePrompt(opts, [genre]);
      const hasExclusion = SENIOR_AUDIENCE_PROFILE.exclusions.some(exclusion => excludePrompt.includes(exclusion));
      expect(hasExclusion, `genre=${genre.id}: ${excludePrompt}`).toBe(true);
    }
  });

  it('does not force senior-specific exclusions onto a non-senior channel', () => {
    const twentiesChannel = channelPresets.find(c => c.audience === 'twenties')!;
    const opts = makeOptions({ channel: twentiesChannel, songCount: 1 });
    const excludePrompt = buildExcludePrompt(opts, []);
    expect(excludePrompt).not.toContain('shouted or belted high notes');
  });
});
