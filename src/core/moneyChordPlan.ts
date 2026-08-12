import type { ChannelArchetype, GenerationOptions } from '../types';
import { moneyChordPresets, moneyChordRotationPool, resolveEarwormMoneyChordMode, signatureMoneyChordId, type MoneyChordMode } from '../data/moneyChords';
import { moneyChordDistributionForFamily } from '../data/paletteFamilyMoneyChords';
import { moneyChordAffinityForGenre } from '../data/genreMoneyChordAffinity';
import { shuffle } from './lyricEngine';
import { stridePick } from './stridePlan';

/**
 * TASK v3.33 Part C — per-song progression quota activates only when the
 * channel hasn't made an explicit money-chord choice (moneyChordMode still
 * at its 'default' starting value — see utils/generation.ts's
 * createInitialOptions) and the archetype has a real signature progression
 * defined (senior-morning/showa-cafe — see data/moneyChords.ts's
 * signatureMoneyChordId). A user who deliberately picked e.g. 'jazzColor'
 * without moneyChordModeIsExplicitChoice set (an older/API caller that
 * hasn't migrated) keeps that exact progression uniformly across the whole
 * pack, unchanged from pre-v3.33 behavior — the quota system only ever
 * activates in place of the *default* choice, never overrides a deliberate
 * one. v5.7 (TASK v5.7, TASK B) — a REAL explicit choice
 * (moneyChordModeIsExplicitChoice: true) now uses
 * usesUserChosenProgressionPlan/buildUserChosenProgressionPlan below
 * instead of either of this function's two outcomes — see that function's
 * own doc comment for why 100%-one-progression was itself a gap (하루
 * explicitly wants "겨울발라드를 주로 하되 다른 진행도 섞기", not literally
 * every song). Reads the earworm-adjusted effective mode (not the raw
 * field) so the two features compose consistently: earwormMode redirecting
 * an unrelated preset back to 'default' also (correctly) lets quota
 * rotation take over from there.
 *
 * 지시문 27 (TASK A-3) — 이전에는 위 doc comment가 말하는 대로 아키타입을
 * 하드코딩 allowlist로 나열했다: 이 목록에 없는 아키타입(oldpop-lounge 포함
 * 7개)은 회전 풀이 실제로 존재해도(data/moneyChords.ts's
 * moneyChordRotationPool) 절대 회전하지 않았다 — §1-1 실측(36곡 전부
 * I-V-vi-IV)의 근본 원인. "시그니처가 있는가"가 아니라 "회전할 게 있는가"가
 * 진짜 조건이므로, moneyChordRotationPool의 실제 크기로 판단한다. 풀이
 * 정말 1종뿐인 아키타입(정의되지 않아 ['default']로 떨어지는 경우 포함)은
 * 여전히 회전하지 않는다 — 1종을 "회전"시켜봐야 항상 같은 값이 나오므로
 * 이건 회귀가 아니라 정상 동작이다.
 */
export function usesMoneyChordQuota(opts: Pick<GenerationOptions, 'moneyChordMode' | 'earwormMode' | 'channel' | 'moneyChordModeIsExplicitChoice'>): boolean {
  const effectiveMode = resolveEarwormMoneyChordMode(opts.moneyChordMode, opts.earwormMode, opts.moneyChordModeIsExplicitChoice);
  if (effectiveMode !== 'default') return false;
  return moneyChordRotationPool(opts.channel.archetype).length >= 2;
}

/**
 * TASK v5.7 (TASK B §2-2) — true whenever the user genuinely picked a named
 * money-chord preset in Step2Concept's picker (moneyChordModeIsExplicitChoice
 * true) and it isn't 'default' (nothing to blend against — the system default
 * already IS the neutral choice) or 'custom' (a hand-typed progression already
 * gets 100% of the pack via compactMoneyChord's own custom branch — "선택
 * 반영" is already 100%, and this app has no principled way to invent
 * "progressions compatible with a string the user just typed"). Deliberately
 * independent of usesMoneyChordQuota's own archetype allowlist: TASK B's own
 * §2-2 applies to "사용자가 머니코드를 선택했을 때" with no archetype carve-out,
 * unlike the *default*-side per-archetype signature rotation that function
 * gates — a user's explicit choice should be honored on every archetype, not
 * just the 7 with a hand-authored default rotation pool.
 */
export function usesUserChosenProgressionPlan(opts: Pick<GenerationOptions, 'moneyChordMode' | 'moneyChordModeIsExplicitChoice'>): boolean {
  return Boolean(opts.moneyChordModeIsExplicitChoice) && opts.moneyChordMode !== 'default' && opts.moneyChordMode !== 'custom';
}

/** Fraction of the pack the user's chosen progression gets — this task's own explicit "50~60%"/"9~11곡 (18곡 기준)". */
const CHOSEN_PROGRESSION_MIN_SHARE = 0.5;
const CHOSEN_PROGRESSION_MAX_SHARE = 0.6;
const CHOSEN_PROGRESSION_TARGET_SHARE = 0.55;
/**
 * Track 1-3 (cold-open + the two flagship slots, see resolveSongRole) —
 * this task's own explicit "대표곡(2~3번) 선택한 진행 우선". Track 1 is
 * included too: the whole point of an explicit choice is that it's the
 * identity the user wants heard first, which matters more here than an
 * archetype signature the user never asked for.
 *
 * v5.8 (TASK 2) — exported so the tempo/arrangement-density lean below can
 * exclude these same representative slots from its own eligible/donor pool:
 * arrangementDensityPlan pins exactly these 3 positions to
 * ['medium','sparse','sparse'] (localGenerator.ts/batchPreallocation.ts's
 * own v3.80 flagship-density pin) and tempoBandPlan's track-2 slot may carry
 * its own verifiedCombo tempo override — the lean must compose with both,
 * never fight them, so it never touches this prefix either as a target or a
 * swap donor.
 */
export const REPRESENTATIVE_TRACK_COUNT = 3;

/**
 * v5.8 (TASK 2) — money-chord → tempo/arrangement-density SOFT lean. Real
 * gap: an explicit money-chord pick (data/moneyChords.ts) currently has zero
 * influence on a track's tempo or arrangement density — those are decided
 * entirely by the audience-profile tempo-band plan (core/tempoPlan.ts) and
 * the arc-intensity-reordered density plan (core/promptComposer.ts's
 * buildArrangementDensityPlan), with no connection to which harmonic
 * "flavor" the user actually picked. This table encodes only the 6 presets
 * actually reachable as an explicit UI pick (GenerationOptions.moneyChordMode's
 * own union — 'default'/'custom' are excluded by usesUserChosenProgressionPlan
 * itself, and every other moneyChordPresets entry, e.g. doowop/royalRoad/
 * kidsSimple, is archetype-signature/internal-only, never opts.moneyChordMode).
 * Direction only (never a target BPM/level) — this stays a soft nudge
 * layered on top of whatever the audience profile / v4.16 calm-senior
 * baseline / arc shape already decided (see applyMoneyChordLean below for
 * how "soft" is enforced structurally, not just by convention).
 *
 * Leans chosen from each preset's own `audibleEffect` wording (data/moneyChords.ts):
 * emotional/winterBallad/showaModern/jazzColor read as hushed, sparse,
 * unresolved, or "smoky" (laid-back, adult-contemporary-cafe) — slower and
 * sparser. cityPop reads as a "smooth glide" into a "polished landing" —
 * fuller and a touch faster (night-drive momentum). canon is a "steadily
 * rising, cinematic swell" — an orchestral build wants fuller arrangement,
 * but has no clear fast/slow signal of its own (it's used across both
 * up-tempo and ballad contexts), so its tempo lean stays neutral.
 */
export interface MoneyChordLean {
  tempo: 'lower' | 'higher' | 'neutral';
  density: 'sparser' | 'fuller' | 'neutral';
}

const MONEY_CHORD_LEAN: Partial<Record<MoneyChordMode, MoneyChordLean>> = {
  emotional: { tempo: 'lower', density: 'sparser' },
  jazzColor: { tempo: 'lower', density: 'sparser' },
  cityPop: { tempo: 'higher', density: 'fuller' },
  canon: { tempo: 'neutral', density: 'fuller' },
  showaModern: { tempo: 'lower', density: 'sparser' },
  winterBallad: { tempo: 'lower', density: 'sparser' }
};

export function moneyChordLeanFor(mode: MoneyChordMode): MoneyChordLean | undefined {
  return MONEY_CHORD_LEAN[mode];
}

/**
 * v5.8 (TASK 2) — indices eligible for the lean: only tracks AFTER the
 * representative prefix (see REPRESENTATIVE_TRACK_COUNT's own doc comment
 * for why that prefix is excluded) whose assigned progression is the
 * chosen id EXACTLY (not a compatible-neighbor fill-in song — a neighbor's
 * own preset has its own, possibly different, lean and this function has no
 * principled way to blend two).
 */
export function leanEligibleIndices(progressionPlan: readonly string[] | null | undefined, chosenId: string, length: number): number[] {
  if (!progressionPlan) return [];
  const out: number[] = [];
  for (let i = REPRESENTATIVE_TRACK_COUNT; i < length && i < progressionPlan.length; i += 1) {
    if (progressionPlan[i] === chosenId) out.push(i);
  }
  return out;
}

/** v5.8 (TASK 2) — the representative prefix, protected from ever being touched (as either the lean's target or its swap donor). */
export function leanProtectedIndices(length: number): number[] {
  return Array.from({ length: Math.min(REPRESENTATIVE_TRACK_COUNT, length) }, (_, i) => i);
}

/**
 * v5.8 (TASK 2) — the actual soft-nudge mechanism, deliberately swap-only
 * (never a reassignment): for each eligible index, finds the single
 * non-eligible, non-protected donor index whose current value is most
 * extreme in the requested direction and swaps with it (once per donor, so
 * no position is touched twice). Because every change is a swap, the
 * output's own multiset is byte-identical to the input's — the v4.16
 * calm-senior tempo-band shares and arrangement-density 3:4:2 split are
 * mathematically untouched, only WHICH track carries which already-planned
 * value shifts, exactly the same "reorder, never recompute" contract
 * arcPlan.ts's own reorderByArcIntensity/pinPrefixPreservingCounts already
 * established for this codebase's other per-track value plans. A donor is
 * never reused, so this can only ever improve (never repeatedly churn) the
 * eligible tracks' lean, and it composes strictly AFTER (never before)
 * arc-intensity reordering and flagship pinning — called on their already-
 * finalized output, so it never fights either.
 */
export function applyMoneyChordLean<T>(
  values: readonly T[],
  eligibleIndices: readonly number[],
  protectedIndices: readonly number[],
  rank: (value: T) => number,
  direction: 'lower' | 'higher'
): T[] {
  if (!eligibleIndices.length) return [...values];
  const result = [...values];
  const eligible = new Set(eligibleIndices);
  const protectedSet = new Set(protectedIndices);
  const donorUsed = new Set<number>();
  for (const i of eligibleIndices) {
    const currentRank = rank(result[i]);
    let bestDonor = -1;
    let bestRank = currentRank;
    for (let j = 0; j < result.length; j += 1) {
      if (j === i || eligible.has(j) || protectedSet.has(j) || donorUsed.has(j)) continue;
      const candidateRank = rank(result[j]);
      const better = direction === 'lower' ? candidateRank < bestRank : candidateRank > bestRank;
      if (better) {
        bestRank = candidateRank;
        bestDonor = j;
      }
    }
    if (bestDonor !== -1) {
      const tmp = result[i];
      result[i] = result[bestDonor];
      result[bestDonor] = tmp;
      donorUsed.add(bestDonor);
    }
  }
  return result;
}

/**
 * TASK v5.7 (TASK B §2-2/§2-3/§2-4) — the user's chosen progression fills
 * 50-60% of the pack (representative tracks 1-3 first), the remainder is
 * filled from that preset's own `compatibleWith` neighbors (data/moneyChords.ts),
 * shuffled and de-duplicated adjacently the same way buildFamilyProgressionPlan
 * already does for the default-quota path. Falls back to ['default'] as the
 * sole neighbor when a preset has no compatibleWith entries (defensive; every
 * real preset has at least one after this task's own moneyChords.ts edit).
 * `chosenId` itself is used verbatim for winterBallad's own multi-part
 * verse/chorus/key-up structure — this function only decides WHICH tracks get
 * it, not what its text says (see soundSignature.ts's compactMoneyChord /
 * promptComposer.ts's resolveMoneyChordText, both keyed off the same preset id).
 */
export function buildUserChosenProgressionPlan(chosenId: MoneyChordMode, songCount: number, seed: number): string[] {
  if (songCount <= 0) return [];
  const preset = moneyChordPresets[chosenId];
  const neighbors = (preset?.compatibleWith ?? []).filter(id => id !== chosenId && moneyChordPresets[id]);
  const neighborPool = neighbors.length ? neighbors : (['default'].filter(id => id !== chosenId));

  const representativeCount = Math.min(REPRESENTATIVE_TRACK_COUNT, songCount);
  const target = Math.round(songCount * CHOSEN_PROGRESSION_TARGET_SHARE);
  const minShare = Math.ceil(songCount * CHOSEN_PROGRESSION_MIN_SHARE);
  const maxShare = Math.floor(songCount * CHOSEN_PROGRESSION_MAX_SHARE);
  const chosenCount = Math.min(songCount, Math.max(representativeCount, Math.min(Math.max(target, minShare), Math.max(maxShare, minShare))));
  const remainderCount = songCount - chosenCount;

  const plan: string[] = new Array(songCount).fill(chosenId);
  if (remainderCount > 0 && neighborPool.length) {
    const neighborCounts = scaleMoneyChordCounts(Object.fromEntries(neighborPool.map(id => [id, 1])), remainderCount);
    const rawPool: string[] = [];
    for (const [id, count] of Object.entries(neighborCounts)) for (let i = 0; i < count; i += 1) rawPool.push(id);
    const shuffled = shuffle(rawPool, seed);
    let neighborIdx = 0;
    for (let i = representativeCount; i < songCount && neighborIdx < shuffled.length; i += 1) {
      plan[i] = shuffled[neighborIdx];
      neighborIdx += 1;
    }
    // Same anti-adjacent-duplicate swap buildFamilyProgressionPlan uses,
    // scoped to non-representative indices so a representative slot never
    // loses its chosen-progression guarantee to a swap.
    for (let index = representativeCount + 1; index < plan.length; index += 1) {
      if (plan[index] !== plan[index - 1]) continue;
      const swapIndex = plan.findIndex((id, candidateIndex) => candidateIndex > index && candidateIndex >= representativeCount && id !== plan[index]);
      if (swapIndex === -1) continue;
      const tmp = plan[index];
      plan[index] = plan[swapIndex];
      plan[swapIndex] = tmp;
    }
  }
  return plan;
}

/**
 * Track 1 is pinned to the archetype's signature progression; every other
 * track rotates through the archetype's expanded pool with no adjacent
 * duplicate when the pool has alternatives. `roles` is passed in (rather
 * than recomputed here) so
 * this module never needs to import core/localGenerator.ts — both real
 * callers (localGenerator.ts's own per-song loop and
 * batchPreallocation.ts's preallocateSongSlots) already compute roles via
 * resolveSongRole in their own loops and can hand them over directly,
 * avoiding a localGenerator.ts <-> moneyChordPlan.ts import cycle.
 *
 * Deterministic (seeded): the same seed always produces the same plan, so
 * local/realtime/Batch/bridge — everything that ultimately reads the same
 * seedForBlueprint(opts)-derived seed — agree on every trackNo's
 * progression without needing to coordinate at request time. Shuffling the
 * rotation pool by the (per-set, since each set's seed differs — see
 * core/multiSetGeneration.ts) seed is also what makes "세트마다 리드 진행이
 * 달라지도록" fall out for free: which non-signature progression leads a
 * given set's rotation varies with that set's own seed, the same mechanism
 * hook-shape sequencing already relies on.
 */
export function buildProgressionPlan(archetype: ChannelArchetype | undefined, seed: number, roles: string[]): string[] {
  const signature = signatureMoneyChordId(archetype);
  const pool = moneyChordRotationPool(archetype);
  const offset = Math.abs(seed) % pool.length;

  const plan: string[] = [];
  let rotationIndex = 0;
  for (let index = 0; index < roles.length; index += 1) {
    if (index === 0) {
      plan.push(signature);
      continue;
    }
    let candidate = stridePick(pool, rotationIndex, offset) ?? signature;
    let guard = 0;
    while (
      plan.length >= 1 &&
      plan[plan.length - 1] === candidate &&
      guard < pool.length
    ) {
      rotationIndex += 1;
      candidate = stridePick(pool, rotationIndex, offset) ?? signature;
      guard += 1;
    }
    plan.push(candidate);
    rotationIndex += 1;
  }
  return plan;
}

/**
 * 지시문 27 (TASK B-4) — "사용자가 'custom'으로 직접 진행을 입력하면 →
 * 그 진행이 시그니처. 회전은 보조 2~3종만." buildUserChosenProgressionPlan은
 * 'custom'을 의도적으로 제외한다(그 함수 자신의 doc comment: "이 앱은
 * 사용자가 방금 입력한 임의 문자열과 화성적으로 호환되는 진행을 만들어낼
 * 원칙적인 방법이 없다") — 맞는 말이지만, 그래서 지금까지 custom 모드는
 * 18곡 전부가 똑같은 커스텀 텍스트였다(core/soundSignature.ts's
 * compactMoneyChord 자체 분기, moneyChordIdOverride가 없을 때만 발동).
 * "호환되는 진행을 만들 수 없다"는 문제를 풀지 않고 우회한다 — 대표곡
 * 몇 곡만 커스텀 텍스트를 쓰고(plan[i] === undefined → moneyChordIdOverride
 * 없음 → compactMoneyChord의 custom 분기가 그대로 발동), 나머지는
 * "화성적으로 맞는 이웃"이 아니라 이 아키타입의 회전 풀에서 2~3종만
 * 고른다 — 사용자가 원래 입력하지 않은 진행이 실제 stylePrompt에
 * verbatim으로 등장하는 게 아니라 그냥 다른 트랙의 배경 화성일 뿐이므로,
 * "호환성"을 계산할 필요 자체가 없다.
 */
export function buildCustomProgressionPlan(archetype: ChannelArchetype | undefined, songCount: number, seed: number): (string | undefined)[] {
  if (songCount <= 0) return [];
  const pool = moneyChordRotationPool(archetype).slice(0, 3);
  const representativeCount = Math.min(REPRESENTATIVE_TRACK_COUNT, songCount);
  const target = Math.round(songCount * CHOSEN_PROGRESSION_TARGET_SHARE);
  const minShare = Math.ceil(songCount * CHOSEN_PROGRESSION_MIN_SHARE);
  const maxShare = Math.floor(songCount * CHOSEN_PROGRESSION_MAX_SHARE);
  const customCount = Math.min(songCount, Math.max(representativeCount, Math.min(Math.max(target, minShare), Math.max(maxShare, minShare))));
  const remainderCount = songCount - customCount;

  const plan: (string | undefined)[] = new Array(songCount).fill(undefined);
  if (remainderCount > 0 && pool.length) {
    const rotationCounts = scaleMoneyChordCounts(Object.fromEntries(pool.map(id => [id, 1])), remainderCount);
    const rawPool: string[] = [];
    for (const [id, count] of Object.entries(rotationCounts)) for (let i = 0; i < count; i += 1) rawPool.push(id);
    const shuffled = shuffle(rawPool, seed);
    let poolIdx = 0;
    for (let i = representativeCount; i < songCount && poolIdx < shuffled.length; i += 1) {
      plan[i] = shuffled[poolIdx];
      poolIdx += 1;
    }
    for (let index = representativeCount + 1; index < plan.length; index += 1) {
      if (!plan[index] || plan[index] !== plan[index - 1]) continue;
      const swapIndex = plan.findIndex((id, candidateIndex) => candidateIndex > index && candidateIndex >= representativeCount && id !== plan[index]);
      if (swapIndex === -1) continue;
      const tmp = plan[index];
      plan[index] = plan[swapIndex];
      plan[swapIndex] = tmp;
    }
  }
  return plan;
}

/**
 * TASK v4.14 (TASK B) — largest-remainder proportional scale of a family's
 * own 18-song-worked-example counts (data/paletteFamilyMoneyChords.ts) down
 * or up to this pack's real songCount. Same apportionment approach
 * vocalPlan.ts's scaleVocalQuota already uses for the vocal-type quota
 * (never duplicated verbatim here since that function's return type is
 * hard-typed to the 3 fixed VocalType keys, not an arbitrary money-chord id
 * map).
 */
function scaleMoneyChordCounts(counts: Record<string, number>, songCount: number): Record<string, number> {
  const ids = Object.keys(counts);
  if (!ids.length || songCount <= 0) return {};
  const sourceTotal = ids.reduce((sum, id) => sum + counts[id], 0) || 1;
  const exact = ids.map(id => ({ id, value: (counts[id] / sourceTotal) * songCount }));
  const result: Record<string, number> = {};
  let assigned = 0;
  for (const { id, value } of exact) {
    const floored = Math.floor(value);
    result[id] = floored;
    assigned += floored;
  }
  const byRemainderDesc = exact
    .slice()
    .sort((a, b) => (b.value - Math.floor(b.value)) - (a.value - Math.floor(a.value)))
    .map(entry => entry.id);
  let remainder = songCount - assigned;
  let i = 0;
  while (remainder > 0 && byRemainderDesc.length) {
    result[byRemainderDesc[i % byRemainderDesc.length]] += 1;
    remainder -= 1;
    i += 1;
  }
  return result;
}

/**
 * TASK v4.14 (TASK B) — family-aware replacement for
 * moneyChordRotationPool's flat archetype pool, used whenever this pack's
 * dominant palette family (data/paletteFamilies.ts, resolved by
 * core/moneyChordPlan.ts's own callers off their already-decided genrePlan)
 * actually has a distribution table. Real gap the flat pool left open:
 * moneyChordRotationPool only ever guarantees no *immediate* adjacent
 * repeat, never an overall spread — an 18-song pack could still land 14
 * songs on the same progression, and the pool itself was never
 * family-aware to begin with (every senior-morning pack drew from the same
 * 5-id pool regardless of whether the set leaned acoustic-folk or Motown
 * soul). Track 1 (cold-open) still pins to the archetype's own
 * signatureMoneyChordId, exactly like buildProgressionPlan — real listening
 * feedback (v3.33 Part C) established that channel-identity anchor, and
 * this task never asked to remove it; only the *rotation pool* the
 * remaining tracks draw from becomes family-aware. Falls back to undefined
 * (caller should use buildProgressionPlan instead) when no distribution
 * exists for this family.
 */
export function buildFamilyProgressionPlan(familyId: string | undefined, archetype: ChannelArchetype | undefined, seed: number, songCount: number): string[] | undefined {
  const distribution = moneyChordDistributionForFamily(familyId);
  if (!distribution || songCount <= 0) return undefined;
  const signature = signatureMoneyChordId(archetype);
  if (songCount === 1) return [signature];
  // Track 1's own signature slot is carved out of the family's proportional
  // share first (if the family table names it at all) so the total count
  // handed to the rest-of-pack pool below still sums to songCount - 1.
  const remainingCounts = scaleMoneyChordCounts(distribution.counts, songCount - 1);
  const pool: string[] = [];
  for (const [id, count] of Object.entries(remainingCounts)) {
    for (let i = 0; i < count; i += 1) pool.push(id);
  }
  const shuffled = shuffle(pool, seed);
  for (let index = 1; index < shuffled.length; index += 1) {
    if (shuffled[index] !== shuffled[index - 1]) continue;
    const swapIndex = shuffled.findIndex((id, candidateIndex) => candidateIndex > index && id !== shuffled[index]);
    if (swapIndex === -1) continue;
    const tmp = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = tmp;
  }
  return [signature, ...shuffled];
}

/**
 * 지시문 27 (TASK B) — "같은 곡의 장르와 진행이 서로 맞아야 한다"(§B-3).
 * buildFamilyProgressionPlan은 팩 전체의 dominant 팔레트 계열 하나로
 * 진행을 뽑아 셔플만 할 뿐, 트랙별 실제 장르는 전혀 보지 않는다 — 두왑
 * 트랙에 재즈 컬러가 배정돼도 상관하지 않는다. 이 함수는 각 트랙의 실제
 * genrePlan[idx]를 data/genreMoneyChordAffinity.ts와 대조해 장르-진행
 * 정합성을 우선한다.
 *
 * 알고리즘:
 *  1. 아키타입 회전 풀(시그니처 포함)에서, 이 팩의 장르 구성이 실제로
 *     선호하는 진행에 가산점을 줘 상위 4-5종을 고른다(시그니처는 항상
 *     포함 — §B-2 "시그니처 6~8곡"은 반드시 나와야 하는 정체성).
 *  2. §B-2의 배분 모양(시그니처 6~8 · 보조 2종 각 4~5 · 색깔 1종 2~3,
 *     18곡 기준)을 가중치로 목표 곡수를 정한다 — scaleMoneyChordCounts로
 *     songCount에 비례 축소/확대.
 *  3. 각 트랙을 "그 트랙 장르의 선호 진행 중 선택된 집합에 있고 아직
 *     목표치가 남은 것" 우선으로 배정. 장르에 대응이 없으면(폴백)
 *     선택된 집합에서 목표치가 가장 많이 남은 진행에 배정한다.
 *  4. 인접 중복은 자리만 바꿔 피한다(buildFamilyProgressionPlan과 동일
 *     패턴) — 곡수 목표는 건드리지 않는다.
 *
 * pool.length < 2면 회전하지 않는다(usesMoneyChordQuota와 같은 기준) —
 * undefined를 반환해 호출부가 flat 시그니처로 폴백하게 한다.
 */
export function buildGenreAwareProgressionPlan(
  genrePlan: readonly (string | undefined)[],
  archetype: ChannelArchetype | undefined,
  seed: number,
  songCount: number
): string[] | undefined {
  const pool = moneyChordRotationPool(archetype);
  if (pool.length < 2 || songCount <= 0) return undefined;
  const signature = signatureMoneyChordId(archetype);
  if (songCount === 1) return [signature];

  // 1. 이 팩의 장르 구성이 실제로 선호하는 진행에 가산점(1순위 2점 · 2순위
  // 1점)을 줘 풀 안에서 점수를 매긴다.
  const score = new Map<string, number>(pool.map(id => [id, 0]));
  for (const genreId of genrePlan) {
    const preferences = moneyChordAffinityForGenre(genreId).filter(id => pool.includes(id));
    preferences.forEach((id, rank) => {
      score.set(id, (score.get(id) ?? 0) + (rank === 0 ? 2 : 1));
    });
  }
  // 시그니처는 항상 선택 — 나머지는 점수 내림차순으로 최대 4종 더(총 5종
  // 상한), 풀이 그보다 작으면 풀 전체를 쓴다.
  // 지시문 43 (TASK B-1/B-4) — kr-idol만 상한을 6종 더(총 7종)로 올린다.
  // "세트 내 진행 종류 6~7종" 목표는 이 5종 상한 자체가 원인이었다(풀을
  // 9종으로 늘려도(§B-1) 이 함수가 상위 5개만 뽑으면 여전히 5종에서 안
  // 늘어난다) — archetype으로 게이팅해 다른 워크스페이스는 기존 5종 상한
  // 그대로 유지한다(§하지 말 것 "다른 워크스페이스를 건드리지 말 것").
  const isKrIdol = archetype === 'kr-idol-male' || archetype === 'kr-idol-female';
  const rankedOthers = pool
    .filter(id => id !== signature)
    .sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0));
  const maxOthers = Math.min(isKrIdol ? 6 : 4, rankedOthers.length);
  const selected = [signature, ...rankedOthers.slice(0, maxOthers)];

  // 2. §B-2 배분 모양 — 시그니처(가중치 3.5) · 보조 2종(가중치 2씩) · 나머지
  // 색깔 진행(가중치 1씩), 18곡 worked example로 만들어 scaleMoneyChordCounts로
  // songCount에 비례.
  // 지시문 43 (TASK B-4) — kr-idol만 균등 가중치(전부 1)로 바꾼다. 기존
  // 가중치(시그니처 3.5)를 7종에 그대로 적용하면 15곡 기준 시그니처 혼자
  // ~30%(4~5곡)를 가져가 "같은 진행 최대 3곡"(§B-4 완료 판정)을 못
  // 지킨다 — 균등 가중치라야 7종 배분이 대략 15/7≈2.1곡씩 고르게 퍼져
  // 3곡 상한 안에 자연스럽게 들어온다.
  const weightOf = (index: number) => (isKrIdol ? 1 : index === 0 ? 3.5 : index <= 2 ? 2 : 1);
  const workedCounts: Record<string, number> = {};
  const totalWeight = selected.reduce((sum, _, index) => sum + weightOf(index), 0);
  selected.forEach((id, index) => {
    workedCounts[id] = Math.round((weightOf(index) / totalWeight) * 18);
  });
  const remaining = scaleMoneyChordCounts(workedCounts, songCount);

  // 3. 트랙 0(cold-open)은 buildFamilyProgressionPlan/buildProgressionPlan과
  // 동일하게 항상 시그니처로 고정한다(tests/moneyChordPlan.test.ts의 기존
  // 기대치이자 실제 규약 — "채널의 정체성은 가장 먼저 들리는 트랙에 있어야
  // 한다"). 장르 기반 배정은 트랙 1부터만 적용한다.
  const plan: (string | undefined)[] = new Array(genrePlan.length).fill(undefined);
  plan[0] = signature;
  remaining[signature] = Math.max(0, (remaining[signature] ?? 0) - 1);

  // 4. 트랙별 배정(인덱스 1부터) — 여러 단계로 나눈다. 한 번에 트랙 순서대로
  // 돌면 "선호 없는 트랙"이 앞에서 먼저 여유 슬롯을 가로채 뒤에 나오는
  // "선호 있는 트랙"이 밀려나는 문제(실측 확인: soft-rock-am이
  // default/warmCycle을 원했는데 앞선 무관 트랙이 이미 다 써서 doowop으로
  // 밀림)뿐 아니라, 트랙 배열 순서 자체도 선호 순위보다 우선시되는
  // 문제(예: doowop-harmony 장르가 정확히 'doowop' 진행을 1순위로
  // 원하는데도 배열상 뒤에 있어 그 자리를 못 받고 2순위 진행으로 밀림)가
  // 있었다. "선호 순위" 단계로 전체 트랙을 훑어 1순위부터 채운다 — 트랙
  // 배열 위치가 아니라 선호 강도가 우선순위가 되도록.
  const preferencesByIndex = genrePlan.map(genreId => moneyChordAffinityForGenre(genreId).filter(id => selected.includes(id)));
  const maxPreferenceRank = preferencesByIndex.reduce((max, prefs) => Math.max(max, prefs.length), 0);

  for (let rank = 0; rank < maxPreferenceRank; rank += 1) {
    preferencesByIndex.forEach((preferences, index) => {
      if (index === 0 || plan[index]) return;
      const candidate = preferences[rank];
      if (!candidate || (remaining[candidate] ?? 0) <= 0) return;
      remaining[candidate] = Math.max(0, (remaining[candidate] ?? 0) - 1);
      plan[index] = candidate;
    });
  }

  preferencesByIndex.forEach((_, index) => {
    if (index === 0) return;
    if (plan[index]) return;
    const fallback = selected
      .filter(id => (remaining[id] ?? 0) > 0)
      .sort((a, b) => (remaining[b] ?? 0) - (remaining[a] ?? 0))[0];
    const chosen = fallback ?? selected[0];
    remaining[chosen] = Math.max(0, (remaining[chosen] ?? 0) - 1);
    plan[index] = chosen;
  });

  const finalPlan = plan.map(id => id ?? selected[0]);

  // 4. 인접 중복 자리 바꿈 — buildFamilyProgressionPlan과 동일 패턴.
  for (let index = 1; index < finalPlan.length; index += 1) {
    if (finalPlan[index] !== finalPlan[index - 1]) continue;
    const swapIndex = finalPlan.findIndex((id, candidateIndex) => candidateIndex > index && id !== finalPlan[index]);
    if (swapIndex === -1) continue;
    const tmp = finalPlan[index];
    finalPlan[index] = finalPlan[swapIndex];
    finalPlan[swapIndex] = tmp;
  }

  return finalPlan;
}
