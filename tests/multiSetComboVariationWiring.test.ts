import { describe, expect, it } from 'vitest';
import { buildMultiSetClaudeCodeInstructions, buildMultiSetClaudeCodeMasterInstruction } from '../src/core/bridgeInstruction';
import { genreLibrary } from '../src/data/genreLibrary';
import { SEED_VERIFIED_COMBOS } from '../src/data/verifiedCombos';
import { workspaceForArchetype } from '../src/data/workspaces';
import { makeOptions, channelPresets, moodPacks, seasonPacks } from './fixtures';

/**
 * v5.23 (TASK C/D multi-set gap) — real gap this closes: buildClaudeCodeInstruction's
 * own explorationPlan/flagshipCombo params (TASK C/D) only ever reached the
 * single-set instruction; buildMultiSetClaudeCodeInstructions/
 * buildMultiSetClaudeCodeMasterInstruction never passed them through at
 * all, so a multi-set bridge run (Step3Generate.tsx's own multiSet.mode)
 * never showed exploration or combo-variation text for any set. Verified
 * with the same real senior-oldpop philly-soul-81 combo
 * tests/flagshipVariationInstruction.test.ts already uses for the
 * single-set path.
 */
const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;
const PHILLY_GENRE_ID = 'oldpop-philly-soul-sweet';
const philly = SEED_VERIFIED_COMBOS.find(combo => combo.id === 'senior-philly-81')!;
const genreIds = [PHILLY_GENRE_ID, 'oldpop-soft-rock-am', 'oldpop-motown-pop-soul', 'oldpop-warm-morning-glow'];
const genres = genreLibrary.filter(g => genreIds.includes(g.id));
const moods = moodPacks.filter(m => seniorChannel.preferredMoods.includes(m.id));
const season = seasonPacks[0];

function baseOpts(overrides: Partial<ReturnType<typeof makeOptions>> = {}) {
  return makeOptions({ channel: seniorChannel, songCount: 18, genreIds, ...overrides });
}

describe('[v5.23 multi-set gap] buildMultiSetClaudeCodeInstructions carries flagshipCombo + explorationPlan per set', () => {
  it('a set whose own rotated genre pool includes the combo genre gets the variation-track instruction', () => {
    // buildSetOptions rotates each set's own genre subset (real diversity-across-a-run
    // behavior, not a bug) — so, mirroring tests/flagshipVerifiedCombo.test.ts's own
    // "only applies when the genre is actually available" precedent, this asserts
    // per-set consistency (genre present <=> variation text present) rather than
    // assuming every set in the run carries the combo's genre.
    const results = buildMultiSetClaudeCodeInstructions(
      baseOpts(), 3, 18, genres, moods, season,
      { verifiedCombos: [philly] }, false
    );
    expect(results).toHaveLength(3);
    let sawVariationText = false;
    for (const result of results) {
      const carriesPhillyTwice = result.preassignedSongs.filter(slot => slot.genreId === PHILLY_GENRE_ID).length >= 2;
      expect(result.instruction.includes('[대표곡 변주')).toBe(carriesPhillyTwice);
      if (carriesPhillyTwice) sawVariationText = true;
    }
    // The combo IS in this test's own genreIds pool, so at least one of the 3 sets should draw it.
    expect(sawVariationText).toBe(true);
  });

  it('omitting verifiedCombos produces zero variation text (backward compatible)', () => {
    const results = buildMultiSetClaudeCodeInstructions(baseOpts(), 2, 18, genres, moods, season, undefined, false);
    for (const result of results) {
      expect(result.instruction).not.toContain('[대표곡 변주');
    }
  });

  it('startingAxisSequence advances the exploration axis rotation across sets in one run', () => {
    const results = buildMultiSetClaudeCodeInstructions(
      baseOpts(), 3, 18, genres, moods, season,
      undefined, false, 0
    );
    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result.instruction).toContain('[탐색 슬롯');
    }
    // sequence 0/1/2 map to different axes (genre/structure/vocal — see explorationSlots.ts's own EXPLORATION_AXES order) — the 3 sets' own exploration blocks should not all be identical.
    const explorationBlocks = results.map(r => r.instruction.slice(r.instruction.indexOf('[탐색 슬롯'), r.instruction.indexOf('[탐색 슬롯') + 300));
    expect(new Set(explorationBlocks).size).toBeGreaterThan(1);
  });

  it('omitting startingAxisSequence produces zero exploration text (backward compatible)', () => {
    const results = buildMultiSetClaudeCodeInstructions(baseOpts(), 2, 18, genres, moods, season, undefined, false);
    for (const result of results) {
      expect(result.instruction).not.toContain('[탐색 슬롯');
    }
  });

  it('a non-senior-oldpop channel gets zero exploration text even with startingAxisSequence set', () => {
    const kr2030Channel = channelPresets.find(c => workspaceForArchetype(c.archetype)?.id !== 'senior-oldpop')!;
    const kr2030Genres = genreLibrary.filter(g => kr2030Channel.preferredGenres.includes(g.id));
    const results = buildMultiSetClaudeCodeInstructions(
      makeOptions({ channel: kr2030Channel, songCount: 18 }), 2, 18, kr2030Genres, moods, season, undefined, false, 0
    );
    for (const result of results) {
      expect(result.instruction).not.toContain('[탐색 슬롯');
    }
  });
});

describe('[v5.23 multi-set gap] buildMultiSetClaudeCodeMasterInstruction forwards verifiedCombos/startingAxisSequence', () => {
  it('every set whose own rotated genre pool includes the combo genre gets it on track 2 (same guarantee applyVerifiedComboToGenrePlan always makes)', () => {
    // buildSetOptions rotates each set's own genre subset across a multi-set
    // run — same real, non-bug behavior tests/multiSetComboVariationWiring.test.ts's
    // first describe block already documents — so this only asserts the
    // guarantee for sets that actually drew the combo's genre.
    const master = buildMultiSetClaudeCodeMasterInstruction(
      baseOpts(), 2, 18, genres, moods, season,
      { verifiedCombos: [philly] }, false, 0
    );
    expect(master.setCount).toBe(2);
    expect(master.setInstructions).toHaveLength(2);
    let sawFlagshipCombo = false;
    for (const set of master.setInstructions) {
      if (!set.preassignedSongs.some(song => song.genreId === PHILLY_GENRE_ID)) continue;
      sawFlagshipCombo = true;
      const track2 = set.preassignedSongs.find(song => song.trackNo === 2);
      expect(track2?.genreId).toBe(PHILLY_GENRE_ID);
    }
    expect(sawFlagshipCombo).toBe(true);
  });

  it('at least one set\'s master-mode instruction text includes the exploration block when startingAxisSequence is set', () => {
    const master = buildMultiSetClaudeCodeMasterInstruction(
      baseOpts(), 2, 18, genres, moods, season,
      undefined, false, 0
    );
    expect(master.setInstructions.some(set => set.instruction.includes('[탐색 슬롯'))).toBe(true);
  });
});
