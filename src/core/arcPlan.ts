/**
 * TASK v3.67 (TASK C) — an 18-song pack currently treats every track at the
 * same intensity (real measurement: peak-vs-closing BPM gap ~2, not the
 * >=15 a real "curve" needs). This is an ADDITIVE axis alongside the
 * existing songRole (cold-open/flagship/...) — see localGenerator.ts's
 * resolveSongRole, which this never replaces or reads from. buildArcPlan is
 * pure position data; callers use it to reorder (not rebuild) the tempo-band
 * plan and arrangementDensity plan they already compute (see
 * reorderByArcIntensity below), and to decide killing-point placement (see
 * data/killingPoints.ts).
 */
export type ArcPhase = 'opening' | 'rising' | 'peak' | 'easing' | 'closing';
export type PeakStrength = 'none' | 'subtle' | 'strong';

export interface SlotArcPosition {
  phase: ArcPhase;
  intensity: 1 | 2 | 3 | 4 | 5;
  peakStrength: PeakStrength;
}

/**
 * Proportional shares of an 18-song pack (mirrors data/audienceProfiles.ts's
 * SENIOR_TEMPO_BANDS shareOf18 convention). opening/closing each mix a
 * 'none' majority with one 'subtle' track at the edge nearest the rising/
 * easing section, so the pack doesn't snap straight from full calm to full
 * lift — rising/easing are 'subtle' throughout, peak is 'strong' throughout.
 */
const ARC_PHASES: { phase: ArcPhase; shareOf18: number; intensity: 1 | 2 | 3 | 4 | 5 }[] = [
  { phase: 'opening', shareOf18: 3, intensity: 2 },
  { phase: 'rising', shareOf18: 5, intensity: 3 },
  { phase: 'peak', shareOf18: 3, intensity: 5 },
  { phase: 'easing', shareOf18: 4, intensity: 3 },
  { phase: 'closing', shareOf18: 3, intensity: 1 }
];

function scalePhaseCounts(songCount: number): number[] {
  const totalShare = ARC_PHASES.reduce((sum, entry) => sum + entry.shareOf18, 0) || 1;
  const raw = ARC_PHASES.map(entry => (entry.shareOf18 / totalShare) * songCount);
  const floors = raw.map(Math.floor);
  let remainder = songCount - floors.reduce((sum, value) => sum + value, 0);
  const byFraction = raw
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction);
  const counts = [...floors];
  for (let k = 0; k < byFraction.length && remainder > 0; k += 1, remainder -= 1) {
    counts[byFraction[k].index] += 1;
  }
  return counts;
}

export function buildArcPlan(songCount: number): SlotArcPosition[] {
  if (songCount <= 0) return [];
  const counts = scalePhaseCounts(songCount);
  const plan: SlotArcPosition[] = [];
  ARC_PHASES.forEach((entry, phaseIdx) => {
    const count = counts[phaseIdx];
    for (let i = 0; i < count; i += 1) {
      const edgeTowardLift = entry.phase === 'opening' && i === count - 1 && count > 1;
      const edgeFromLift = entry.phase === 'closing' && i === 0 && count > 1;
      const peakStrength: PeakStrength =
        entry.phase === 'peak' ? 'strong'
          : (entry.phase === 'rising' || entry.phase === 'easing') ? 'subtle'
            : (edgeTowardLift || edgeFromLift) ? 'subtle' : 'none';
      plan.push({ phase: entry.phase, intensity: entry.intensity, peakStrength });
    }
  });
  return plan.slice(0, songCount);
}

/**
 * Reorders an already-computed per-track value plan (e.g. a tempo-band
 * plan, an arrangementDensity level plan) so its own low-to-high value
 * order lines up with the arc's intensity order, instead of whatever
 * shuffled/cyclic order the source plan happened to produce. Deliberately
 * does NOT recompute the values themselves — buildTempoBandPlan/
 * arrangementDensityLevel stay exactly as they are (see this task's own
 * "buildTempoBandPlan을 새로 만들지 마십시오" instruction); this only
 * permutes which track receives which already-planned value, so the same
 * multiset (same counts per band/level) still comes out the other end.
 * A stable sort keeps same-intensity tracks in their original relative
 * order, so a phase with several tracks still gets some natural variety
 * rather than a flat repeat of one value.
 */
export function reorderByArcIntensity<T>(values: readonly T[], arc: readonly SlotArcPosition[], rank: (value: T) => number): T[] {
  if (values.length !== arc.length || values.length === 0) return [...values];
  const sortedValues = [...values].sort((a, b) => rank(a) - rank(b));
  const orderByIntensity = arc.map((_, idx) => idx).sort((a, b) => arc[a].intensity - arc[b].intensity);
  const result = new Array<T>(values.length);
  orderByIntensity.forEach((trackIdx, position) => { result[trackIdx] = sortedValues[position]; });
  return breakLongRuns(result, 2);
}

/**
 * Grouping same-intensity tracks together (several adjacent 'rising'/
 * 'easing' tracks share one intensity, see arcPlan's own ARC_PHASES) can
 * clump the SAME reordered value several tracks in a row — a real 18-song
 * measurement found a run of 5 identical arrangementDensity levels through
 * a tied-intensity stretch, itself a small version of the flatness this
 * whole task exists to fix. Swaps the run's overflow entry with the
 * nearest later track holding a different value (minimal displacement, so
 * the overall ascending/descending trend stays intact) whenever more than
 * `maxConsecutive` identical values land back to back.
 */
/**
 * v3.80 (TASK A) — forces `values[0..prefix.length-1]` to exactly match
 * `prefix`, while preserving the overall multiset of `values` (so a caller
 * enforcing an exact (or weighted, e.g. arrangementDensity's v4.16 6:8:4)
 * split, or a vocal-type quota, doesn't have that split broken by the pin). Swap-based,
 * never a reassignment, except in the one edge case a swap can't reach (see
 * below). Donor search prefers positions outside the prefix first (so
 * pinning position 0 doesn't disturb a not-yet-processed position 1/2's own
 * target), falling back to a later, not-yet-finalized prefix position.
 */
export function pinPrefixPreservingCounts<T>(values: readonly T[], prefix: readonly T[]): T[] {
  const result = [...values];
  const k = Math.min(prefix.length, result.length);
  for (let i = 0; i < k; i += 1) {
    if (result[i] === prefix[i]) continue;
    let donor = -1;
    for (let j = k; j < result.length; j += 1) {
      if (result[j] === prefix[i]) { donor = j; break; }
    }
    if (donor === -1) {
      for (let j = i + 1; j < k; j += 1) {
        if (result[j] === prefix[i]) { donor = j; break; }
      }
    }
    if (donor !== -1) {
      [result[i], result[donor]] = [result[donor], result[i]];
    } else {
      // The desired value doesn't exist anywhere in `values` — no swap can
      // preserve counts exactly. Forces it anyway (a real gap in the source
      // plan's own value domain, not something this helper can fix).
      result[i] = prefix[i];
    }
  }
  return result;
}

/**
 * v4.16 (TASK B) — two compounding gaps in the original single forward-only
 * pass: (1) fixing the run ending at position i by swapping in a later,
 * differing donor value can create a NEW run right at the donor's own old
 * position (its former neighbors may match the value just placed there),
 * which a pass that only checks the INSERTION side (i) never notices; (2) a
 * run at the very TAIL of the array has no later position to swap with at
 * all (searching only `j > i`), so it can never be fixed regardless of how
 * many passes run. Both were latent even before v4.16 (any forward-only
 * swap heuristic has the same two gaps), but only started actually
 * surfacing once arrangementDensity's weighted 6:8:4 split (was 6:6:6) gave
 * 'medium' a heavier 8/18 share — a real 18-song measurement hit a genuine
 * trailing run of 3 (positions 16-18, all 'sparse', arc-intensity reordering's
 * own "closing skews sparse" clustering). Now searches donors in BOTH
 * directions (forward preferred, backward as fallback — backward candidates
 * are restricted to positions before the run itself, `j < i - maxConsecutive`,
 * so a donor swap can never touch the run's own elements), loops to a fixed
 * point (bounded by result.length, so it always terminates), and each
 * candidate swap is simulated first, accepted only if it creates no new run
 * at EITHER the insertion or the donor position — still purely swap-based
 * (multiset preserved exactly).
 */
export function breakLongRuns<T>(values: readonly T[], maxConsecutive: number): T[] {
  const result = [...values];

  function endsRun(idx: number): boolean {
    if (idx < maxConsecutive) return false;
    for (let k = 1; k <= maxConsecutive; k += 1) {
      if (result[idx] !== result[idx - k]) return false;
    }
    return true;
  }

  function trySwap(i: number, j: number): boolean {
    if (result[j] === result[i]) return false;
    [result[i], result[j]] = [result[j], result[i]];
    const stillBad = endsRun(i) || endsRun(j) || (j + 1 < result.length && endsRun(j + 1)) || (i + 1 < result.length && endsRun(i + 1));
    [result[i], result[j]] = [result[j], result[i]];
    return !stillBad;
  }

  for (let pass = 0; pass < result.length; pass += 1) {
    let fixedAny = false;
    for (let i = maxConsecutive; i < result.length; i += 1) {
      if (!endsRun(i)) continue;
      let swapWith = -1;
      for (let j = i + 1; j < result.length; j += 1) {
        if (trySwap(i, j)) { swapWith = j; break; }
      }
      if (swapWith === -1) {
        for (let j = i - maxConsecutive - 1; j >= 0; j -= 1) {
          if (trySwap(i, j)) { swapWith = j; break; }
        }
      }
      if (swapWith === -1) continue;
      [result[i], result[swapWith]] = [result[swapWith], result[i]];
      fixedAny = true;
    }
    if (!fixedAny) break;
  }
  return result;
}
