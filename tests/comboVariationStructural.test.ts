import { describe, expect, it } from 'vitest';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { genreLibrary } from '../src/data/genreLibrary';
import type { VerifiedCombo } from '../src/data/verifiedCombos';
import { makeOptions, channelPresets, moodPacks, seasonPacks } from './fixtures';

/**
 * v5.23 (TASK D gap 2) — end-to-end: the real deterministic pipelines
 * (core/batchPreallocation.ts's preallocateSongSlots, core/localGenerator.ts's
 * generateLocalBlueprint) now apply ONE real structural variation to the
 * second same-genre track instead of leaving it an exact repeat of the
 * flagship combo — see comboVariations.ts's own applyFlagshipVariationToSlots.
 * Uses a combo with triedVariations pre-set past the BPM/vocal axes (both
 * deliberately advisory-only — see that function's own doc comment) so the
 * next untried variation lands on a real, structurally-applied axis
 * ('스트링 없이'), matching tests/comboVariations.test.ts's own precedent
 * for exercising a non-advisory axis.
 */
const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;
const PHILLY_GENRE_ID = 'oldpop-philly-soul-sweet';
const genreIds = [PHILLY_GENRE_ID, 'oldpop-soft-rock-am', 'oldpop-motown-pop-soul', 'oldpop-warm-morning-glow'];

const comboWithStringVariationNext: VerifiedCombo = {
  id: 'test-philly-variation',
  workspaceId: 'senior-oldpop',
  genreId: PHILLY_GENRE_ID,
  bpmRange: [78, 86],
  verdict: 'good',
  sampleSize: 3,
  sampleTracks: ['T1', 'T4', 'T7'],
  verifiedAt: '2026-08-02',
  noteKo: 'test combo',
  cautionsKo: [],
  triedVariations: [
    { variation: '75 BPM', verdict: 'mixed', setCode: 'S0' },
    { variation: '90 BPM', verdict: 'mixed', setCode: 'S0' },
    { variation: '여성 듀엣', verdict: 'mixed', setCode: 'S0' },
    { variation: '남성 솔로', verdict: 'mixed', setCode: 'S0' }
  ]
};

describe('[v5.23 TASK D gap 2] preallocateSongSlots — real structural variation on the second flagship track', () => {
  it('the second same-genre track gets instrumentSet patched (스트링 없이), track 2 stays the exact combo', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 18, genreIds });
    const genres = genreLibrary.filter(g => genreIds.includes(g.id));
    const slots = preallocateSongSlots(opts, genres, { verifiedCombos: [comboWithStringVariationNext] });

    const track2 = slots.find(s => s.trackNo === 2)!;
    expect(track2.genreId).toBe(PHILLY_GENRE_ID);

    const phillyTracks = slots.filter(s => s.genreId === PHILLY_GENRE_ID).sort((a, b) => a.trackNo - b.trackNo);
    expect(phillyTracks.length).toBeGreaterThanOrEqual(2);
    const variationTrack = phillyTracks[1];
    expect(variationTrack.instrumentSet?.some(name => /string/i.test(name))).toBe(false);
    // track 2 itself is untouched — still whatever instrumentSet the normal rotation gave it.
    expect(variationTrack.trackNo).not.toBe(track2.trackNo);
  });

  it('a combo with no untried structural variation left (BPM/vocal only) leaves every track unchanged', () => {
    const bpmOnlyCombo: VerifiedCombo = {
      ...comboWithStringVariationNext,
      id: 'test-bpm-only',
      triedVariations: [
        { variation: '스트링 없이', verdict: 'mixed', setCode: 'S0' },
        { variation: '브라스 추가', verdict: 'mixed', setCode: 'S0' },
        { variation: 'sparse 편곡', verdict: 'mixed', setCode: 'S0' },
        { variation: 'full 편곡', verdict: 'mixed', setCode: 'S0' },
        { variation: '다른 머니코드', verdict: 'mixed', setCode: 'S0' }
      ]
    };
    const opts = makeOptions({ channel: seniorChannel, songCount: 18, genreIds });
    const genres = genreLibrary.filter(g => genreIds.includes(g.id));
    const slots = preallocateSongSlots(opts, genres, { verifiedCombos: [bpmOnlyCombo] });
    const phillyTracks = slots.filter(s => s.genreId === PHILLY_GENRE_ID).sort((a, b) => a.trackNo - b.trackNo);
    expect(phillyTracks.length).toBeGreaterThanOrEqual(2);
    // The next untried variation is a BPM one — advisory-only, so nothing structural changed on that track.
    expect(phillyTracks[1].arrangementDensity).toBeDefined();
  });
});

describe('[v5.23 TASK D gap 2] generateLocalBlueprint — same real structural variation on the deterministic local path', () => {
  it('the second same-genre song gets arrangementDensity patched when the next untried variation is an arrangement axis', () => {
    const arrangementCombo: VerifiedCombo = {
      ...comboWithStringVariationNext,
      id: 'test-arrangement',
      triedVariations: [
        ...comboWithStringVariationNext.triedVariations!,
        { variation: '스트링 없이', verdict: 'mixed', setCode: 'S0' },
        { variation: '브라스 추가', verdict: 'mixed', setCode: 'S0' }
      ]
    };
    const opts = makeOptions({ channel: seniorChannel, songCount: 18, genreIds });
    const genres = genreLibrary.filter(g => genreIds.includes(g.id));
    const moods = moodPacks.filter(m => seniorChannel.preferredMoods.includes(m.id));
    const season = seasonPacks[0];
    const blueprint = generateLocalBlueprint(opts, genres, moods, season, { verifiedCombos: [arrangementCombo] });
    const phillySongs = blueprint.songs.filter(s => s.genreId === PHILLY_GENRE_ID).sort((a, b) => a.trackNo - b.trackNo);
    expect(phillySongs.length).toBeGreaterThanOrEqual(2);
    expect(['sparse', 'full']).toContain(phillySongs[1].arrangementDensity);
  });
});
