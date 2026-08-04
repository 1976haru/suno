import type { ChannelArchetype, GenerationOptions } from '../types';
import { moneyChordRotationPool, resolveEarwormMoneyChordMode, signatureMoneyChordId } from '../data/moneyChords';
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
 * keeps that exact progression uniformly across the whole pack, unchanged
 * from pre-v3.33 behavior — the quota system only ever activates in place
 * of the *default* choice, never overrides a deliberate one. Reads the
 * earworm-adjusted effective mode (not the raw field) so the two features
 * compose consistently: earwormMode redirecting an unrelated preset back to
 * 'default' also (correctly) lets quota rotation take over from there.
 */
export function usesMoneyChordQuota(opts: Pick<GenerationOptions, 'moneyChordMode' | 'earwormMode' | 'channel'>): boolean {
  const effectiveMode = resolveEarwormMoneyChordMode(opts.moneyChordMode, opts.earwormMode);
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
