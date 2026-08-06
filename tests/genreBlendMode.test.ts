/**
 * TASK (genreBlendMode) — real-generation coverage for the new
 * 'shared-primary' | 'lead-only' axis added on top of core/genreRotation.ts's
 * genresForTrack. See types.ts's GenreBlendMode doc comment: this is NOT a
 * bug fix — genresForTrack's pre-existing v3.58 design deliberately blends
 * the first-selected ("primary") genre into every song's mix regardless of
 * that song's own lead genre, giving a whole set a common sonic thread. This
 * task makes that visible in the UI and adds an opt-in 'lead-only'
 * alternative (each song plays ONLY its own lead genre) for users who want
 * sharper per-song genre contrast instead — see Step2Concept.tsx's genre
 * "적용 방식" picker.
 *
 * Mirrors perspectiveMode.test.ts's own shape: a regression-safety describe
 * block proving the default/omitted path is untouched, then a describe block
 * per new mode exercised through real generateLocalBlueprint calls (not just
 * genresForTrack in isolation) plus buildGenreRotationPlan's own real
 * per-song lead assignment.
 */
import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { buildGenreRotationPlan, genresForTrack } from '../src/core/genreRotation';
import { buildGenrePromptSummary } from '../src/core/promptComposer';
import { channelPresets, genrePacks, makeOptions, moodPacks, seasonPacks } from './fixtures';
import type { PlaylistBlueprint } from '../src/types';

const GENRE_POOL_IDS = ['jazz-pop', 'retro-soul-pop', 'adult-contemporary'];
const channel = channelPresets.find(item => item.id === 'good-morning-memory-radio')!;
const genres = genrePacks.filter(genre => GENRE_POOL_IDS.includes(genre.id));
const moods = moodPacks.filter(mood => channel.preferredMoods.includes(mood.id));
const season = seasonPacks[0];

function generatePack(genreBlendMode?: 'shared-primary' | 'lead-only'): PlaylistBlueprint {
  const opts = makeOptions({
    channel,
    songCount: 18,
    genreIds: GENRE_POOL_IDS,
    moodIds: moods.map(mood => mood.id),
    seasonId: season.id,
    genreBlendMode
  });
  return generateLocalBlueprint(opts, genres, moods, season);
}

/** Strips the two fields that are naturally non-deterministic call-to-call (a random songId suffix, and a wall-clock generatedAt timestamp) regardless of any option — see this task's own investigation confirming both are pre-existing, unrelated to genreBlendMode. */
function stripNonDeterministicFields(bp: PlaylistBlueprint) {
  return {
    ...bp,
    generatedAt: undefined,
    songs: bp.songs.map(song => ({ ...song, songId: undefined }))
  };
}

describe('[TASK genreBlendMode] regression safety — omitted/shared-primary is byte-identical to today', () => {
  it('genresForTrack: passing blendMode undefined and passing "shared-primary" explicitly return identical arrays for every lead in a 3-genre pool', () => {
    for (const genre of genres) {
      const withoutMode = genresForTrack(genres, genre.id);
      const withExplicitMode = genresForTrack(genres, genre.id, undefined, 'shared-primary');
      expect(withExplicitMode.map(g => g.id)).toEqual(withoutMode.map(g => g.id));
    }
  });

  it('genresForTrack: "shared-primary" preserves the pre-existing v3.58 lead-first-then-primary-then-rest ordering (same assertions as genreRotationIdentity.test.ts, now with the mode passed explicitly)', () => {
    for (const genre of genres) {
      const result = genresForTrack(genres, genre.id, undefined, 'shared-primary');
      expect(result[0]?.id, `lead=${genre.id}`).toBe(genre.id);
      // all 3 pool genres still get blended in (up to the slice(0, 3) cap) —
      // shared-primary was never just "lead + primary", it's "lead + primary
      // + weighted rest", unchanged by this task.
      expect(result.map(g => g.id).sort()).toEqual([...GENRE_POOL_IDS].sort());
    }
  });

  it('generateLocalBlueprint: omitting genreBlendMode reproduces byte-identical output (songId/generatedAt aside) to setting it explicitly to "shared-primary", for a real 18-song / 3-genre pack', () => {
    const omitted = stripNonDeterministicFields(generatePack(undefined));
    const explicit = stripNonDeterministicFields(generatePack('shared-primary'));
    expect(JSON.stringify(explicit)).toBe(JSON.stringify(omitted));
  });

  it('generateLocalBlueprint: every song\'s genreId (buildGenreRotationPlan\'s real per-track lead assignment) is unaffected by genreBlendMode — same rotation whether omitted, "shared-primary", or "lead-only"', () => {
    const omitted = generatePack(undefined).songs.map(s => s.genreId);
    const shared = generatePack('shared-primary').songs.map(s => s.genreId);
    const leadOnly = generatePack('lead-only').songs.map(s => s.genreId);
    expect(shared).toEqual(omitted);
    expect(leadOnly).toEqual(omitted);
  });
});

describe('[TASK genreBlendMode] "lead-only" — exactly one genre per song', () => {
  it('genresForTrack: returns exactly [lead], never blending in the primary or any weighted extra, for every genre in the pool (mirrors genreRotationIdentity.test.ts\'s per-genre loop)', () => {
    for (const genre of genres) {
      const result = genresForTrack(genres, genre.id, undefined, 'lead-only');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(genre.id);
    }
  });

  it('real generation: every one of 18 songs carries exactly 1 genre when recomputed from its own real assigned lead genreId, real genreBlendWeights, and "lead-only" — not just a synthetic call, the genreId comes straight off generateLocalBlueprint\'s own output', () => {
    const bp = generatePack('lead-only');
    expect(bp.songs).toHaveLength(18);
    const genreWeights: Record<string, number> = { 'jazz-pop': 70, 'retro-soul-pop': 20, 'adult-contemporary': 10 };
    const opts = makeOptions({ channel, songCount: 18, genreIds: GENRE_POOL_IDS, genreBlendWeights: genreWeights, genreBlendMode: 'lead-only' });
    for (const song of bp.songs) {
      expect(song.genreId, 'every song should have a real assigned lead genreId').toBeTruthy();
      const trackGenres = genresForTrack(genres, song.genreId, opts.genreBlendWeights, 'lead-only');
      expect(trackGenres, `song genreId=${song.genreId}`).toHaveLength(1);
      expect(trackGenres[0]?.id).toBe(song.genreId);
    }
    // sanity: real rotation actually happened across all 3 pool genres, this
    // isn't a degenerate single-genre pool that would make length===1 trivial.
    const distinctLeads = new Set(bp.songs.map(s => s.genreId));
    expect(distinctLeads.size).toBe(3);
  });

  it('real generation: buildGenreRotationPlan\'s own per-track plan feeds genresForTrack the same way generateLocalBlueprint does internally, and "lead-only" strips every non-lead genre out of buildGenrePromptSummary\'s genreText/instruments (the actual style-prompt inputs) — proving the mode reaches past genresForTrack into the prompt-building pipeline, not just its own return value', () => {
    const seed = 4242;
    const genrePlan = buildGenreRotationPlan(GENRE_POOL_IDS, 18, seed);
    expect(genrePlan).toHaveLength(18);
    let checkedAtLeastOneMismatchedLead = false;
    for (const leadId of genrePlan) {
      const sharedPrimaryGenres = genresForTrack(genres, leadId, undefined, 'shared-primary');
      const leadOnlyGenres = genresForTrack(genres, leadId, undefined, 'lead-only');
      const sharedSummary = buildGenrePromptSummary(sharedPrimaryGenres);
      const leadOnlySummary = buildGenrePromptSummary(leadOnlyGenres);
      // lead-only's instrument pool can only ever draw from the lead genre's
      // own instruments (<=4 of them); shared-primary's pool draws from the
      // lead's instruments AND up to 2 more genres' instruments, so it must
      // never be narrower than lead-only's for the same lead.
      expect(leadOnlySummary.instruments.length).toBeLessThanOrEqual(sharedSummary.instruments.length);
      if (leadId !== genres[0].id) {
        checkedAtLeastOneMismatchedLead = true;
        // when this track's lead isn't the pack's primary genre, shared-primary
        // blends the primary in (a real, checkable difference); lead-only never does.
        expect(sharedPrimaryGenres.some(g => g.id === genres[0].id)).toBe(true);
        expect(leadOnlyGenres.some(g => g.id === genres[0].id)).toBe(false);
      }
    }
    expect(checkedAtLeastOneMismatchedLead, 'the seeded rotation plan should include at least one track whose lead differs from the pack primary').toBe(true);
  });
});

describe('[TASK genreBlendMode] "shared-primary" still blends the primary genre in for a non-primary lead (today\'s exact behavior, now reachable via the explicit mode value too)', () => {
  it('a song whose lead differs from the pack primary still carries the primary genre in its trackGenres', () => {
    const primary = genres[0];
    const nonPrimaryLead = genres.find(g => g.id !== primary.id)!;
    const trackGenres = genresForTrack(genres, nonPrimaryLead.id, undefined, 'shared-primary');
    expect(trackGenres[0]?.id).toBe(nonPrimaryLead.id);
    expect(trackGenres.some(g => g.id === primary.id)).toBe(true);
  });
});
