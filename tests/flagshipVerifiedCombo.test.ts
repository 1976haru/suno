import { describe, expect, it } from 'vitest';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { genreLibrary, getGenreById } from '../src/data/genreLibrary';
import { SEED_VERIFIED_COMBOS } from '../src/data/verifiedCombos';
import { makeOptions, channelPresets } from './fixtures';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;
const PHILLY_GENRE_ID = 'oldpop-philly-soul-sweet';

/**
 * v3.82 (TASK A) — end-to-end: a channel whose available genre pool
 * includes the verified-good philly-soul-81 combo assigns it to track 2
 * (the flagship slot), with a BPM inside the combo's own bpmRange and the
 * flagship-specific maxInstrumentalSections cap of 1 (see this task's own
 * §3 대표곡 규격 확정).
 */
describe('[v3.82 TASK A] preallocateSongSlots — flagship combo override end-to-end', () => {
  it('track 2 gets the verified-good genre+bpm combo when its genre is available', () => {
    const opts = makeOptions({
      channel: seniorChannel,
      songCount: 18,
      genreIds: [PHILLY_GENRE_ID, 'oldpop-soft-rock-am', 'oldpop-motown-pop-soul', 'oldpop-warm-morning-glow']
    });
    const genres = genreLibrary.filter(g => opts.genreIds!.includes(g.id));
    const slots = preallocateSongSlots(opts, genres, { verifiedCombos: SEED_VERIFIED_COMBOS });

    const track2 = slots.find(s => s.trackNo === 2)!;
    expect(track2.genreId).toBe(PHILLY_GENRE_ID);
    expect(track2.tempo).toBeGreaterThanOrEqual(78);
    expect(track2.tempo).toBeLessThanOrEqual(86);
    expect(track2.maxInstrumentalSections).toBe(1);
  });

  it('does nothing when the verified genre is not in this channel\'s pool (never invents an unavailable genre)', () => {
    const opts = makeOptions({
      channel: seniorChannel,
      songCount: 18,
      genreIds: ['oldpop-soft-rock-am', 'oldpop-motown-pop-soul', 'oldpop-warm-morning-glow']
    });
    const genres = genreLibrary.filter(g => opts.genreIds!.includes(g.id));
    const slots = preallocateSongSlots(opts, genres, { verifiedCombos: SEED_VERIFIED_COMBOS });
    const track2 = slots.find(s => s.trackNo === 2)!;
    expect(track2.genreId).not.toBe(PHILLY_GENRE_ID);
  });

  it('does nothing when no verifiedCombos are supplied at all (safe no-op)', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 18, genreIds: [PHILLY_GENRE_ID, 'oldpop-soft-rock-am', 'oldpop-motown-pop-soul'] });
    const genres = genreLibrary.filter(g => opts.genreIds!.includes(g.id));
    expect(() => preallocateSongSlots(opts, genres, {})).not.toThrow();
  });

  it('every slot carries a BPM-appropriate sectionCountRange/wordCountRange/estimatedLengthSec (TASK B)', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 18, genreIds: [PHILLY_GENRE_ID, 'oldpop-soft-rock-am', 'oldpop-motown-pop-soul', 'oldpop-warm-morning-glow'] });
    const genres = genreLibrary.filter(g => opts.genreIds!.includes(g.id));
    const slots = preallocateSongSlots(opts, genres, { verifiedCombos: SEED_VERIFIED_COMBOS });
    for (const slot of slots) {
      expect(slot.sectionCountRange).toBeDefined();
      expect(slot.wordCountRange).toBeDefined();
      expect(slot.maxInstrumentalSections).toBeGreaterThanOrEqual(1);
      expect(slot.estimatedLengthSec).toBeGreaterThan(0);
    }
    // flagship tracks (2-3) are always capped at 1 regardless of tier
    const track2 = slots.find(s => s.trackNo === 2)!;
    const track3 = slots.find(s => s.trackNo === 3)!;
    expect(track2.maxInstrumentalSections).toBe(1);
    expect(track3.maxInstrumentalSections).toBe(1);
  });
});

describe('[v3.82 TASK A] generateLocalBlueprint — flagship combo override applies to the real local generation path too', () => {
  it('track 2\'s genreId/bpm land on the verified combo when its genre is available', () => {
    const opts = makeOptions({
      channel: seniorChannel,
      songCount: 18,
      genreIds: [PHILLY_GENRE_ID, 'oldpop-soft-rock-am', 'oldpop-motown-pop-soul', 'oldpop-warm-morning-glow']
    });
    const genres = genreLibrary.filter(g => opts.genreIds!.includes(g.id));
    const moods = [{ id: 'nostalgic', label: 'Nostalgic', descriptors: [] } as never];
    const season = { id: 'spring-open', label: 'Spring', period: '', keywords: [], visualDirection: '' } as never;
    const blueprint = generateLocalBlueprint(opts, genres, moods, season, { verifiedCombos: SEED_VERIFIED_COMBOS });
    const track2 = blueprint.songs.find(s => s.trackNo === 2)!;
    expect(track2.genreId).toBe(PHILLY_GENRE_ID);
    expect(track2.bpm).toBeGreaterThanOrEqual(78);
    expect(track2.bpm).toBeLessThanOrEqual(86);
  });
});

describe('[v3.82 TASK A] getGenreById sanity — the seed combo references a real genre', () => {
  it('oldpop-philly-soul-sweet exists in the genre library', () => {
    expect(getGenreById(PHILLY_GENRE_ID)).toBeDefined();
  });
});
