/**
 * TASK v4.14 (TASK B) — explicit money-chord distribution per
 * data/paletteFamilies.ts family, replacing the old flat archetype-only
 * rotation pool (data/moneyChords.ts's moneyChordRotationPool) for any pack
 * whose dominant palette family core/eraCanonPalettePlan.ts actually
 * resolves. Real gap: 18 songs could all land on the same progression
 * (moneyChordRotationPool only avoids an IMMEDIATE adjacent repeat, not an
 * overall skew), and the rotation pool was never family-aware at all — a
 * warm acoustic-folk set and a Motown-soul set drew from the exact same
 * pool shape whenever they shared a channel archetype.
 *
 * §9 "정직한 한계" — every distribution below is `basis: 'estimated'`:
 * general 1960s-70s pop harmony knowledge, not yet verified against real
 * listening feedback for this channel. Only one combo is actually verified
 * today (data/verifiedCombos.ts's senior-philly-81, which doesn't specify a
 * money chord at all) — these counts exist so a set doesn't monotonously
 * repeat one progression, not because any one distribution is proven best.
 * Update this table, not the code that reads it, once real ratings accumulate.
 */

export type MoneyChordBasis = 'verified' | 'estimated';

/** Counts sum to 18 (this task's own worked examples) — scaled proportionally for any other songCount by buildFamilyProgressionPlan. */
export interface PaletteFamilyMoneyChordDistribution {
  familyId: string;
  basis: MoneyChordBasis;
  /** moneyChordPresets id -> target count out of 18. */
  counts: Record<string, number>;
}

export const PALETTE_FAMILY_MONEY_CHORD_DISTRIBUTIONS: PaletteFamilyMoneyChordDistribution[] = [
  {
    familyId: 'family-acoustic-soft',
    basis: 'estimated',
    counts: { default: 5, warmCycle: 4, cityPop: 4, doowop: 3, jazzColor: 2 }
  },
  {
    familyId: 'family-bright-pop',
    basis: 'estimated',
    counts: { default: 5, doowop: 5, cityPop: 4, popStandard: 4 }
  },
  {
    familyId: 'family-orchestral',
    basis: 'estimated',
    counts: { jazzColor: 5, popStandard: 4, warmCycle: 4, default: 3, cityPop: 2 }
  },
  {
    familyId: 'family-soul',
    basis: 'estimated',
    counts: { default: 5, cityPop: 5, warmCycle: 4, jazzColor: 4 }
  }
];

export function moneyChordDistributionForFamily(familyId: string | undefined): PaletteFamilyMoneyChordDistribution | undefined {
  if (!familyId) return undefined;
  return PALETTE_FAMILY_MONEY_CHORD_DISTRIBUTIONS.find(entry => entry.familyId === familyId);
}

/**
 * TASK v4.14 (TASK A) — Korean-language "why this progression" one-liners
 * for the concept recommendation panel (Step2Plan.tsx), keyed by
 * moneyChordPresets id. Deliberately separate from moneyChords.ts's own
 * description/audibleEffect fields, which describe each preset for the
 * money-chord PICKER UI in a different (often market-specific, e.g.
 * cityPop's Japan/night-drive framing) voice than this palette-family
 * recommendation context needs. `basis: 'estimated'` throughout — see this
 * module's own top doc comment.
 */
export const MONEY_CHORD_EMOTION_KO: Record<string, string> = {
  default: '밝고 보편적. 후렴이 열림 → 대중적인 곡. 세트의 중심',
  doowop: '두왑·50~60년대. 순수한 향수 → 옛날 느낌이 가장 강함',
  cityPop: '마이너에서 시작해 열림 → 쓸쓸함에서 희망으로',
  warmCycle: '순환하며 완전히 끝나지 않음 → 회상·여운',
  jazzColor: '재즈·크루너 계열 → 스탠더드 느낌',
  popStandard: '50~60년대 스탠더드 순환 → 클래식한 팝'
};
