import type { VerifiedCombo } from '../data/verifiedCombos';
import type { PreassignedSongSlot } from '../types';
import { moneyChordPresets } from '../data/moneyChords';

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
 * v5.23 (TASK D gap 2) — "결정론적 로컬 생성기의 verifiedCombo 배정 구조
 * 변경": turns ONE variation string into a real structural patch on a
 * PreassignedSongSlot, for the local/realtime/batch paths that generate a
 * song deterministically FROM this slot's own fields (unlike the bridge
 * path, where slot fields are advisory text an LLM composes around).
 *
 * Deliberately only handles the 3 axes with no other downstream dependent
 * computed from them earlier in core/batchPreallocation.ts's own pipeline:
 * arrangementDensity, instrumentSet, and moneyChord are each standalone
 * fields nothing else derives from. BPM and vocal-type variations are
 * left as advisory-only (buildFlagshipVariationInstructionLines below,
 * bridge-instruction text only) — a real tempo change would desync
 * sectionCountRange/wordCountRange/estimatedLengthSec (all computed from
 * the ORIGINAL tempo earlier in the same pipeline), and a real vocal-type
 * change would desync the pack's own vocalDistribution quota counts
 * (fullAudit.ts's vocal_distribution/vocal_zone_max3/vocal_no_triple_run)
 * — both would need those earlier computations re-run, not just this one
 * slot patched, so they're deliberately NOT attempted here. Returns the
 * SAME slot object unchanged for a BPM/vocal variation (never throws,
 * never applies a half-safe patch).
 */
/**
 * The minimal field set applyComboVariationToSlot actually reads/writes —
 * both PreassignedSongSlot (core/batchPreallocation.ts) and SongIdea
 * (core/localGenerator.ts) satisfy this structurally, so the same
 * function patches either one without a duplicate SongIdea-specific copy.
 */
export interface ComboVariableSlot {
  trackNo: number;
  instrumentSet?: string[];
  arrangementDensity?: 'sparse' | 'medium' | 'full';
  moneyChordId?: string;
  moneyChordText?: string;
}

export function applyComboVariationToSlot<T extends ComboVariableSlot>(slot: T, variation: string): T {
  const normalized = normalize(variation);
  if (normalized === normalize('스트링 없이')) {
    return { ...slot, instrumentSet: (slot.instrumentSet ?? []).filter(name => !/string/i.test(name)) };
  }
  if (normalized === normalize('브라스 추가')) {
    const current = slot.instrumentSet ?? [];
    return current.some(name => /brass|horn/i.test(name)) ? slot : { ...slot, instrumentSet: [...current, 'brass'] };
  }
  if (normalized === normalize('sparse 편곡')) return { ...slot, arrangementDensity: 'sparse' };
  if (normalized === normalize('full 편곡')) return { ...slot, arrangementDensity: 'full' };
  if (normalized === normalize('다른 머니코드')) {
    const currentId = slot.moneyChordId ?? 'default';
    const alt = Object.values(moneyChordPresets).find(preset => preset.id !== currentId && preset.id !== 'custom');
    if (!alt) return slot;
    return { ...slot, moneyChordId: alt.id, moneyChordText: `${alt.compactProgression} - ${alt.audibleEffectTag}` };
  }
  // BPM ("NN BPM") / vocal ("여성 듀엣" 등) — advisory-only, see this function's own doc comment.
  return slot;
}

/**
 * The one real entry point core/batchPreallocation.ts's own preallocateSongSlots
 * and core/localGenerator.ts's own generateLocalBlueprint both call: resolves
 * the same FlagshipVariationPlan the bridge instruction already shows the
 * agent (resolveFlagshipVariationPlan above — same plan, same track, same
 * variation, so the deterministic path and the bridge-advisory path never
 * disagree about WHICH track is the variation track), then patches that one
 * slot via applyComboVariationToSlot. Every other slot in the array is
 * returned unchanged (same object references) — no plan means the exact
 * same array back, byte-identical to every pre-v5.23 caller.
 */
export function applyFlagshipVariationToSlots<T extends ComboVariableSlot & { genreId?: string }>(slots: T[], combo: VerifiedCombo | undefined): T[] {
  const plan = resolveFlagshipVariationPlan(slots, combo);
  if (!plan) return slots;
  return slots.map(slot => (slot.trackNo === plan.trackNo ? applyComboVariationToSlot(slot, plan.variation) : slot));
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
