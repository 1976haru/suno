import type { ChannelArchetype, GenerationOptions } from '../types';
import { moneyChordRotationPool, resolveEarwormMoneyChordMode, signatureMoneyChordId } from '../data/moneyChords';
import { shuffle } from './lyricEngine';

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
  return archetype === 'senior-morning' || archetype === 'showa-cafe';
}

const OPENER_ROLES = new Set(['cold-open', 'flagship']);

/**
 * Cold-open + flagship (see core/localGenerator.ts's resolveSongRole —
 * trackNo 1-3 within whatever pack/set this plan covers) are pinned to the
 * archetype's signature progression; every other track rotates through the
 * archetype's expanded pool with no three consecutive tracks sharing the
 * same progression. `roles` is passed in (rather than recomputed here) so
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
  const shuffledPool = shuffle(pool, seed);

  const plan: string[] = [];
  let cursor = 0;
  for (const role of roles) {
    if (OPENER_ROLES.has(role)) {
      plan.push(signature);
      continue;
    }
    let candidate = shuffledPool[cursor % shuffledPool.length];
    let guard = 0;
    while (
      plan.length >= 2 &&
      plan[plan.length - 1] === candidate &&
      plan[plan.length - 2] === candidate &&
      guard < shuffledPool.length
    ) {
      cursor += 1;
      candidate = shuffledPool[cursor % shuffledPool.length];
      guard += 1;
    }
    plan.push(candidate);
    cursor += 1;
  }
  return plan;
}
