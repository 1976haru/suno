import type { ChannelArchetype, GenerationOptions } from '../types';
import { moneyChordPresets, moneyChordRotationPool, resolveEarwormMoneyChordMode, signatureMoneyChordId, type MoneyChordMode } from '../data/moneyChords';
import { moneyChordDistributionForFamily } from '../data/paletteFamilyMoneyChords';
import { shuffle } from './lyricEngine';
import { stridePick } from './stridePlan';
import { isKidsArchetype } from '../utils/channelArchetype';

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
 */
export function usesMoneyChordQuota(opts: Pick<GenerationOptions, 'moneyChordMode' | 'earwormMode' | 'channel' | 'moneyChordModeIsExplicitChoice'>): boolean {
  const effectiveMode = resolveEarwormMoneyChordMode(opts.moneyChordMode, opts.earwormMode, opts.moneyChordModeIsExplicitChoice);
  if (effectiveMode !== 'default') return false;
  const archetype = opts.channel.archetype;
  // TASK v3.38 Part B4 — 'kids' now has a real signature progression too (kidsSimple).
  return archetype === 'senior-morning'
    || archetype === 'showa-cafe'
    || isKidsArchetype(archetype)
    || archetype === 'showa-70s'
    || archetype === 'j2000s'
    || archetype === 'modern-chill'
    || archetype === 'city-night';
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
