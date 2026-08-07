import type { AudioTake } from './audioTakes';
import { checkVocalGenderPlausibility } from './audioWorkspaceCompliance';

/**
 * codex 지시문 06 (TASK C) — real, bounded 12-item rejection-reason
 * taxonomy, exactly matching this task's own literal list. A real, typed
 * const instead of a free-text field, so a UI dropdown and a test can both
 * reference the same source of truth.
 */
export const REJECTION_REASONS = [
  { id: 'too-short', labelKo: '너무 짧음' },
  { id: 'too-long', labelKo: '너무 김' },
  { id: 'bpm-error', labelKo: 'BPM 오류' },
  { id: 'wrong-vocal-gender', labelKo: '보컬 성별 오류' },
  { id: 'duet-not-implemented', labelKo: '듀엣 미구현' },
  { id: 'missing-lyrics', labelKo: '가사 누락' },
  { id: 'pronunciation-error', labelKo: '발음 오류' },
  { id: 'weak-chorus', labelKo: '후렴 약함' },
  { id: 'excessive-intro', labelKo: '인트로 과다' },
  { id: 'mood-mismatch', labelKo: '분위기 불일치' },
  { id: 'unsuitable-for-kids', labelKo: '어린이 부적합' },
  { id: 'kpop-part-error', labelKo: 'K-pop 파트 오류' }
] as const;

export type RejectionReasonId = (typeof REJECTION_REASONS)[number]['id'];

const REJECTION_REASON_ID_SET: ReadonlySet<string> = new Set(REJECTION_REASONS.map(r => r.id));

export function isValidRejectionReasonId(id: string): id is RejectionReasonId {
  return REJECTION_REASON_ID_SET.has(id);
}

export function labelForRejectionReason(id: RejectionReasonId): string {
  return REJECTION_REASONS.find(r => r.id === id)?.labelKo ?? id;
}

// ---------------------------------------------------------------------------
// Selection — "트랙당 최종 선택" (at most one selected take per track)
// ---------------------------------------------------------------------------

/**
 * Pure sibling of core/audioTakes.ts's own real `setAdopted` (an IndexedDB
 * write) — same rule (adopting one take un-adopts every other take of the
 * SAME song), expressed as a pure array transform so it's independently
 * testable without IndexedDB. `setAdopted` is the real persisted version of
 * this exact logic; this is what a UI can call for an optimistic/preview
 * update before the IndexedDB write resolves.
 */
export function withTakeSelected(takes: readonly AudioTake[], takeId: string): AudioTake[] {
  const target = takes.find(take => take.takeId === takeId);
  if (!target) return [...takes];
  return takes.map(take => (take.songId === target.songId ? { ...take, adopted: take.takeId === takeId } : take));
}

// ---------------------------------------------------------------------------
// Selection safety — 완료 기준: "selected take without measurements = 0",
// "clipped selected take = 0", "wrong vocal gender selected without warning = 0"
// ---------------------------------------------------------------------------

export interface SelectionSafetyIssue {
  id: string;
  labelKo: string;
  /** 'blocking': the caller should refuse the selection outright. 'warning': the caller must SURFACE this before allowing selection, but the user may still proceed (real, e.g. a plausible-but-unconfirmed vocal-gender mismatch — advisory, per core/audioWorkspaceCompliance.ts's own doc comment). */
  severity: 'blocking' | 'warning';
}

/**
 * The one real gate a "select this take" UI action should call — always
 * returns every real issue, so "selected without a warning" is structurally
 * impossible for any caller that actually uses this function (the warning
 * is IN the return value, not a side effect the caller could forget to
 * check). Real basis for each check:
 *  - no measurements at all -> blocking (nothing to have judged compliance
 *    against — the exact "selected take without measurements" gap).
 *  - real clipping -> blocking (0-tolerance, matches TASK B's own core check).
 *  - a plausible vocal-gender mismatch (core/audioWorkspaceCompliance.ts's
 *    real, advisory-only registerHint check) -> warning, never blocking
 *    (registerHint is reference-only, so this can never hard-refuse a
 *    selection — only guarantee the warning is surfaced).
 */
export function evaluateTakeSelectionSafety(take: AudioTake): SelectionSafetyIssue[] {
  const issues: SelectionSafetyIssue[] = [];
  if (!take.measurements) {
    issues.push({ id: 'no-measurements', labelKo: '측정값 없이 선택되었습니다.', severity: 'blocking' });
  } else if (take.measurements.clipping) {
    issues.push({ id: 'clipping', labelKo: '클리핑이 감지된 테이크입니다.', severity: 'blocking' });
  }
  const expectedVocalType = take.directives.vocalType;
  if (expectedVocalType && expectedVocalType !== 'unknown') {
    const genderCheck = checkVocalGenderPlausibility(take.vocalMetrics, expectedVocalType);
    if (genderCheck.status === 'warn') {
      issues.push({ id: 'vocal-gender-mismatch', labelKo: `보컬 성별 불일치 가능성: ${genderCheck.detail}`, severity: 'warning' });
    }
  }
  return issues;
}

export function canSelectTake(take: AudioTake): boolean {
  return !evaluateTakeSelectionSafety(take).some(issue => issue.severity === 'blocking');
}

// ---------------------------------------------------------------------------
// Comparison — trackNo당 2~4개 real ordering for a comparison UI
// ---------------------------------------------------------------------------

const RATING_RANK: Record<'good' | 'ok' | 'bad', number> = { good: 0, ok: 1, bad: 2 };

/** Real ordering a comparison panel can render directly: rated 'good' first, unrated takes in the middle (untested, not yet judged — not assumed bad), 'bad' last; ties broken by takeNo ascending. */
export function orderTakesForComparison(takes: readonly AudioTake[]): AudioTake[] {
  return [...takes].sort((a, b) => {
    const rankA = a.rating ? RATING_RANK[a.rating] : 1.5;
    const rankB = b.rating ? RATING_RANK[b.rating] : 1.5;
    if (rankA !== rankB) return rankA - rankB;
    return (a.takeNo ?? 0) - (b.takeNo ?? 0);
  });
}
