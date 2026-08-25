import { describe, expect, it } from 'vitest';
import { buildClaudeCodeInstruction } from '../src/core/bridgeInstruction';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { genreLibrary } from '../src/data/genreLibrary';
import { SEED_VERIFIED_COMBOS } from '../src/data/verifiedCombos';
import { makeOptions, channelPresets, seasonPacks } from './fixtures';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;
const PHILLY_GENRE_ID = 'oldpop-philly-soul-sweet';
const philly = SEED_VERIFIED_COMBOS.find(combo => combo.id === 'senior-philly-81')!;

/**
 * v5.23 (TASK D) — end-to-end: the real flagshipCombo tests/flagshipVerifiedCombo.test.ts
 * already confirms lands on track 2 gets its own variation-track instruction
 * in the real bridge text once a second track shares its genre id (the
 * MIN_SONGS=2 floor applyVerifiedComboToGenrePlan enforces guarantees one
 * exists whenever the genre is actually available in the pool).
 */
function buildInstructionWithCombo(genreIds: string[], combo: typeof philly | undefined) {
  const opts = makeOptions({ channel: seniorChannel, songCount: 18, genreIds });
  const genres = genreLibrary.filter(g => genreIds.includes(g.id));
  const slots = preallocateSongSlots(opts, genres, { verifiedCombos: combo ? [combo] : [] });
  return buildClaudeCodeInstruction(opts, genres, [], seasonPacks[0], { usedTitles: [], usedHooks: [] }, slots, false, {}, undefined, undefined, combo);
}

describe('[v5.23 TASK D] flagship variation reaches the real bridge instruction', () => {
  it('produces a variation-track instruction when the combo genre is available in the pool', () => {
    const instruction = buildInstructionWithCombo(
      [PHILLY_GENRE_ID, 'oldpop-soft-rock-am', 'oldpop-motown-pop-soul', 'oldpop-warm-morning-glow'],
      philly
    );
    expect(instruction).toContain('[대표곡 변주');
    expect(instruction).toContain(philly.noteKo);
  });

  it('produces zero variation text when no flagshipCombo is passed (every pre-v5.23 caller)', () => {
    const instruction = buildInstructionWithCombo(
      [PHILLY_GENRE_ID, 'oldpop-soft-rock-am', 'oldpop-motown-pop-soul', 'oldpop-warm-morning-glow'],
      undefined
    );
    expect(instruction).not.toContain('[대표곡 변주');
  });

  it('produces zero variation text when the combo genre is not in this pool (resolveFlagshipCombo itself never applied it)', () => {
    const instruction = buildInstructionWithCombo(
      ['oldpop-soft-rock-am', 'oldpop-motown-pop-soul', 'oldpop-warm-morning-glow'],
      philly
    );
    expect(instruction).not.toContain('[대표곡 변주');
  });
});
