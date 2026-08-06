/**
 * TASK (structural trackNo rejection, third-party audit follow-up) — the
 * duplicate-trackNo fix in core/batchPreallocation.ts's claimSlotsByTrackNo
 * (see its own doc comment) stopped a duplicate/out-of-range trackNo from
 * silently corrupting a track's data: the affected song still gets SAVED
 * and DISPLAYED, just degraded to raw/unenforced fields instead of its real
 * planned slot. A fresh audit found that gap still too soft — a response
 * with a duplicate or out-of-range trackNo is not a "degrade one track"
 * problem, it's proof the WHOLE response can't be trusted (an adversarial or
 * badly malfunctioning provider/agent), so it should never become a
 * savable/displayable pack at all.
 *
 * This module is the shared diagnostic every real entry point
 * (providers/index.ts's generateChunkWithSplitRetry, core/batchStitcher.ts's
 * stitchBatchResults, core/bridgeImport.ts's importSongsJson) now runs
 * BEFORE claimSlotsByTrackNo/reconciliation ever sees the response, so the
 * hard reject happens earlier than — and does not replace — that softer
 * per-track fallback. validateProviderTrackSet only ever produces a
 * diagnostic; each call site decides how to fail (throw, mark a sub-batch
 * failed, or return a null-blueprint report) using ITS OWN existing
 * failure-reporting convention, so this file doesn't invent a new one.
 *
 * A genuinely MISSING trackNo (some of 1..requestedCount never showing up at
 * all, no duplicates/no out-of-range) is deliberately NOT part of `valid` —
 * that is the softer, repairable case (a provider returning 17 of 18
 * requested tracks is not proof the response is corrupt) that the existing
 * countMismatchWarning/failedBatchIndexes machinery already handles, and
 * that a separate upcoming task builds a dedicated repair UI around.
 */
export interface TrackSetValidation {
  /**
   * trackNo values that can never be trusted as a real track position:
   * non-integer (decimals), non-numeric strings, booleans/objects, or a
   * cleanly-parsed integer that falls outside 1..requestedCount. When the
   * raw value itself was too broken to report as a number (e.g. a garbage
   * string), the 1-based position of that entry in the input array is
   * reported instead, since there is no usable trackNo to name.
   */
  invalid: number[];
  /** trackNo values (within the valid 1..requestedCount range) claimed by more than one entry. */
  duplicates: number[];
  /** Values in 1..requestedCount that no entry claims at all. */
  missing: number[];
  /** true only when `invalid` and `duplicates` are both empty — `missing` alone never fails this. */
  valid: boolean;
}

/**
 * Classifies one raw `trackNo` value. `undefined`/`null`/an empty string are
 * treated as "absent", not "invalid" — several real call sites (bridge/JSON
 * import in particular; see core/bridgeImport.ts's own claimedTrackNoFor)
 * legitimately support a song entry that omits trackNo entirely and relies
 * on its position in the array instead. This function only flags a trackNo
 * that was actually PRESENT but can't be trusted (a decimal, a non-numeric
 * string, a boolean/object, or a cleanly-integer value that's out of range).
 */
function coerceTrackNo(raw: unknown): number | 'invalid' | 'absent' {
  if (raw === undefined || raw === null) return 'absent';
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && Number.isInteger(raw) ? raw : 'invalid';
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return 'absent';
    return /^-?\d+$/.test(trimmed) ? Number(trimmed) : 'invalid';
  }
  return 'invalid';
}

/**
 * v5.17 (TASK E) — the ONE place the "absent trackNo -> this entry's own
 * array position" fallback rule lives. Takes the raw `trackNo` VALUE itself
 * (same contract as coerceTrackNo, e.g. `resolveEffectiveTrackNo(obj.trackNo,
 * index)`), never the whole raw song object — a caller holding a raw entry
 * must extract `.trackNo` first. Every real call site that actually CLAIMS a
 * slot from an absent trackNo (core/bridgeImport.ts's claimedTrackNoFor,
 * core/importInspection.ts's claimedTrackNoForRaw) delegates here instead of
 * keeping its own copy — see this module's own
 * header doc comment (§9 audit) for the real bug two independently-
 * maintained copies of this fallback used to cause: validateProviderTrackSet
 * used to treat an absent trackNo as "not claiming anything" (excluded from
 * duplicate/missing detection entirely), while every actual normalizer
 * resolved it to index+1 and claimed that slot for real — so
 * `[{trackNo:null},{trackNo:1}]` (both effectively claiming position 1) sailed
 * through the structural checker as "no duplicates" while genuinely
 * colliding downstream, and a legitimate all-omitted-trackNo file (every
 * entry's fallback lands on a distinct, in-range position) got misreported
 * as "every track missing" even though nothing was actually missing.
 * 'invalid' (a present-but-untrustworthy value) still falls back to the
 * positional label too, purely for totality — in practice this branch is
 * never reached with a real 'invalid' coercion, since validateProviderTrackSet
 * already refuses the whole response before any caller reaches this far.
 */
export function resolveEffectiveTrackNo(raw: unknown, index: number): number {
  const coerced = coerceTrackNo(raw);
  return coerced === 'absent' || coerced === 'invalid' ? index + 1 : coerced;
}

export function validateProviderTrackSet(
  songs: { trackNo: unknown }[],
  requestedCount: number
): TrackSetValidation {
  const invalid: number[] = [];
  const seen = new Map<number, number>();

  songs.forEach((song, index) => {
    const coerced = coerceTrackNo(song.trackNo);
    if (coerced === 'invalid') {
      invalid.push(index + 1);
      return;
    }
    // v5.17 (TASK E) — checked and claimed against the SAME effective value
    // resolveEffectiveTrackNo produces for the real normalizer below, not a
    // silently-excluded one — see that function's own doc comment for the
    // exact bug this closes.
    const effective = coerced === 'absent' ? index + 1 : coerced;
    if (effective < 1 || effective > requestedCount) {
      invalid.push(effective);
      return;
    }
    seen.set(effective, (seen.get(effective) || 0) + 1);
  });

  const duplicates = Array.from(seen.entries())
    .filter(([, count]) => count > 1)
    .map(([trackNo]) => trackNo)
    .sort((a, b) => a - b);
  const present = new Set(seen.keys());
  const missing = Array.from({ length: requestedCount }, (_, i) => i + 1).filter(trackNo => !present.has(trackNo));

  return {
    invalid,
    duplicates,
    missing,
    valid: invalid.length === 0 && duplicates.length === 0
  };
}

/** Small shared formatter so every call site's rejection message names the same two hard-fail categories the same way. */
export function describeTrackSetValidation(validation: TrackSetValidation): string {
  const parts: string[] = [];
  if (validation.duplicates.length) parts.push(`중복 trackNo: ${validation.duplicates.join(', ')}`);
  if (validation.invalid.length) parts.push(`유효하지 않은/범위를 벗어난 trackNo: ${validation.invalid.join(', ')}`);
  return parts.join(' / ');
}
