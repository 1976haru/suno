import type { VerifiedCombo } from '../data/verifiedCombos';
import type { PreassignedSongSlot } from '../types';

/**
 * v5.23 (TASK D §4-3) — "philly-soul 81 BPM 이 good 이면 안 해본 것을 자동으로
 * 나열하십시오" — the doc's own 5 axes (BPM shift, vocal swap, instrumentation,
 * arrangement density, money chord), each rendered as a plain Korean
 * description so it can be dropped straight into bridge-instruction text
 * (mirrors explorationSlots.ts's own "instruction lines are plain sentences,
 * not structured diffs" choice). Pure — no IndexedDB, fully unit-testable.
 */

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** One combo's full candidate list before removing anything already in triedVariations — exported mainly so tests can assert the raw axis coverage. */
export function candidateVariationsFor(combo: Pick<VerifiedCombo, 'bpmRange' | 'vocalType' | 'arrangementDensity'>): string[] {
  const [low, high] = combo.bpmRange;
  const bpmLow = Math.max(40, low - 3);
  const bpmHigh = high + 4;

  const vocalOptions =
    combo.vocalType === 'female' ? ['남성 솔로', '혼성 듀엣']
    : combo.vocalType === 'male' ? ['여성 솔로', '혼성 듀엣']
    : combo.vocalType === 'mixed' ? ['여성 솔로', '남성 솔로']
    : ['여성 듀엣', '남성 솔로'];

  const arrangementOptions =
    combo.arrangementDensity === 'sparse' ? ['full 편곡']
    : combo.arrangementDensity === 'full' ? ['sparse 편곡']
    : ['sparse 편곡', 'full 편곡'];

  return [
    `${bpmLow} BPM`,
    `${bpmHigh} BPM`,
    ...vocalOptions,
    '스트링 없이',
    '브라스 추가',
    ...arrangementOptions,
    '다른 머니코드'
  ];
}

/**
 * The doc's own §4-2 "untriedVariations": candidateVariationsFor's full list
 * minus anything already recorded in combo.triedVariations (normalized
 * string match, so "78 BPM" and " 78  bpm " collide correctly).
 */
export function generateUntriedVariations(combo: VerifiedCombo): string[] {
  const tried = new Set((combo.triedVariations ?? []).map(entry => normalize(entry.variation)));
  return candidateVariationsFor(combo).filter(variation => !tried.has(normalize(variation)));
}

/**
 * §4-4 "대표곡 2~3번: 1곡 검증된 조합 그대로, 1곡 그 조합의 변주" — picks the
 * single next variation to try (first untried one; caller decides which
 * track gets it). Returns undefined once every candidate has been tried at
 * least once — a real, if rare, terminal state for a combo this thoroughly
 * explored.
 */
export function nextComboVariation(combo: VerifiedCombo): string | undefined {
  return generateUntriedVariations(combo)[0];
}

export interface FlagshipVariationPlan {
  trackNo: number;
  comboLabelKo: string;
  variation: string;
}

/**
 * §4-4 "대표곡 2~3번: 1곡 검증된 조합 그대로, 1곡 그 조합의 변주" — track 2 (idx 1)
 * is always the exact combo (core/verifiedCombos.ts's own
 * applyVerifiedComboToGenrePlan guarantees that, unchanged by this task).
 * This picks the SECOND track already carrying that same genre id (the
 * MIN_SONGS=2 floor that same function enforces guarantees one exists
 * whenever a flagship combo applied at all) as the variation track, and
 * pairs it with the next untried variation. Returns undefined when there's
 * no second track (e.g. songCount too small) or every variation has
 * already been tried.
 */
export function resolveFlagshipVariationPlan(
  preassignedSongs: readonly Pick<PreassignedSongSlot, 'trackNo' | 'genreId'>[],
  combo: VerifiedCombo | undefined
): FlagshipVariationPlan | undefined {
  if (!combo) return undefined;
  const matches = preassignedSongs.filter(slot => slot.genreId === combo.genreId).sort((a, b) => a.trackNo - b.trackNo);
  const variationSlot = matches[1];
  if (!variationSlot) return undefined;
  const variation = nextComboVariation(combo);
  if (!variation) return undefined;
  return { trackNo: variationSlot.trackNo, comboLabelKo: combo.noteKo, variation };
}

/**
 * Mirrors explorationSlots.ts's buildExplorationInstructionLines shape (same
 * "plain Korean instruction block dropped into the bridge text" convention).
 * Empty array when there's no plan — every pre-v5.23 instruction stays
 * byte-identical.
 */
export function buildFlagshipVariationInstructionLines(plan: FlagshipVariationPlan | undefined): string[] {
  if (!plan) return [];
  return [
    '',
    `[대표곡 변주 — T${plan.trackNo}]`,
    '',
    `  이 곡은 검증된 조합(${plan.comboLabelKo})을 기본으로 삼되, 다음 한 가지만 바꿔 보십시오: ${plan.variation}`,
    '  나머지 요소는 검증된 조합 그대로 유지하십시오.',
    '  결과가 안 좋아도 괜찮습니다 — 무엇을 시도했는지가 기록에 남습니다.'
  ];
}
