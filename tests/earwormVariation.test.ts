import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { EARWORM_STYLE_VARIANTS, rotatingEarwormText } from '../src/core/promptComposer';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

/**
 * TASK v3.64-B — real measurement: an 18-song pack carried the identical
 * fixed earworm phrase ("simple stepwise melody, easy to hum, singalong-
 * friendly pop hook, predictable diatonic phrase structure") in 18/18
 * stylePrompts — 21% of the whole prompt shared verbatim across every song,
 * on top of the "hook opens and closes every chorus" wording also being
 * identical everywhere. Different genre/instrumentation per song still read
 * as "the same song" because the melodic-construction technique itself
 * never varied.
 */

function stylePromptAtoms(stylePrompt: string): string[] {
  return stylePrompt.split(',').map(atom => atom.trim().toLowerCase()).filter(Boolean);
}

function atomsSharedByEverySong(stylePrompts: string[]): string[] {
  const atomSets = stylePrompts.map(prompt => new Set(stylePromptAtoms(prompt)));
  const [first, ...rest] = atomSets;
  return [...first].filter(atom => rest.every(set => set.has(atom)));
}

/**
 * Atoms that are SUPPOSED to be identical across every song in a pack, for
 * reasons unrelated to this task and explicitly out of its scope:
 *  - vocal descriptor text (a single-vocal channel legitimately uses the
 *    same vocal identity for the whole pack — the "same channel vocal
 *    signature" the app deliberately promises; a per-song vocalType QUOTA
 *    varying this is a separate, already-fixed axis, see
 *    tests/allocationInterleave.test.ts)
 *  - "3:10-3:35" duration — TASK B-4 explicitly keeps this shared
 *  - the fixed hook-repeat-count instruction (TASK v4.8: compressed to
 *    "hook repeats 4x", was "strong repeated chorus hook, repeats chorus
 *    4x") from promptComposer.ts's hookStyleDirectives, which
 *    is a structural requirement keyed off the whole pack's lyricDepth
 *    setting, not a melodic-design style choice — out of this task's scope
 *    (only EARWORM_STYLE_ATOMS/EARWORM_SYSTEM_NOTE and the hookDevice axis
 *    were in scope; compactHook was not touched)
 *  - v4.7 (TASK A) — channelSoundFloor.requiredAtoms (data/channelSoundFloor.ts):
 *    deliberately identical in every song of a covered archetype, same
 *    reasoning as the duration/hook-repeat exemptions above — a floor the
 *    concept can never remove is supposed to be pack-wide-shared, not a
 *    melodic-design variety signal this test is checking.
 */
const EXEMPT_SHARED_ATOM_PATTERN = /\b(vocal|male|female|tenor|baritone|contralto|mezzo|alto|husky|breathy|soulful|close-mic|duet|3:10-3:35|repeated chorus hook|repeats chorus|hook repeats \d+x|warm analog studio sound|acoustic instruments carry the arrangement|narrow warm stereo image)\b/i;

function nonExemptSharedAtoms(stylePrompts: string[]): string[] {
  return atomsSharedByEverySong(stylePrompts).filter(atom => !EXEMPT_SHARED_ATOM_PATTERN.test(atom));
}

describe('[v3.64-B] earworm variation', () => {
  it('an 18-song earwormMode pack uses at least 4 distinct melodic-design variants', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 18, earwormMode: true }), testGenres, testMoods, testSeason);
    const usedVariants = new Set(
      bp.songs.map(song => EARWORM_STYLE_VARIANTS.find(variant => song.stylePrompt.includes(variant))).filter(Boolean)
    );
    expect(usedVariants.size).toBeGreaterThanOrEqual(4);
  });

  it('no single earworm variant is used by more than 4 songs in an 18-song pack', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 18, earwormMode: true }), testGenres, testMoods, testSeason);
    const counts = new Map<string, number>();
    for (const song of bp.songs) {
      const variant = EARWORM_STYLE_VARIANTS.find(v => song.stylePrompt.includes(v));
      if (variant) counts.set(variant, (counts.get(variant) ?? 0) + 1);
    }
    for (const [variant, count] of counts) {
      expect(count, `variant "${variant}"`).toBeLessThanOrEqual(4);
    }
  });

  it('rotatingEarwormText is deterministic for a given seed/index and varies across index', () => {
    expect(rotatingEarwormText(42, 3)).toBe(rotatingEarwormText(42, 3));
    const distinctAcrossIndex = new Set(Array.from({ length: 18 }, (_, idx) => rotatingEarwormText(42, idx)));
    expect(distinctAcrossIndex.size).toBeGreaterThanOrEqual(4);
  });

  it('at most 2 non-exempt atoms are shared verbatim by every song in an 18-song earwormMode pack (was 4: the earworm phrase pair + a hook-repeat phrase, on top of the exempt duration atom)', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 18, earwormMode: true }), testGenres, testMoods, testSeason);
    const shared = nonExemptSharedAtoms(bp.songs.map(song => song.stylePrompt));
    expect(shared.length, shared.join(' | ')).toBeLessThanOrEqual(2);
  });

  it('the non-exempt shared-atom ratio (shared atoms / average atom count per song) is <= 0.15 (was 0.21)', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 18, earwormMode: true }), testGenres, testMoods, testSeason);
    const stylePrompts = bp.songs.map(song => song.stylePrompt);
    const shared = nonExemptSharedAtoms(stylePrompts);
    const averageAtomCount = stylePrompts.reduce((sum, prompt) => sum + stylePromptAtoms(prompt).length, 0) / stylePrompts.length;
    const ratio = shared.length / averageAtomCount;
    expect(ratio).toBeLessThanOrEqual(0.15);
  });
});
