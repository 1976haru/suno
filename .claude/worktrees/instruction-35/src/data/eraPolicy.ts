/**
 * TASK E (design-gate and post-generation era-share checks disagree) — the
 * single shared source of truth both core/designGate.ts's pre-generation
 * `eraIssues` and core/compositionScorer.ts's post-generation
 * `eraConsistencyFindings` now read from, instead of each hardcoding its
 * own (previously disagreeing) numbers.
 *
 * Real investigation before picking these values:
 *  - designGate.ts's pre-generation `eraIssues` (before this task): single-
 *    primary share must be >= 40%, each co-primary bucket must be >= 30%
 *    (both BLOCKING).
 *  - compositionScorer.ts's post-generation `eraConsistencyFindings`
 *    (before this task): single-primary share must be >= 50% (BLOCKING),
 *    and NO co-primary handling at all — confirmed a real gap, not merely
 *    implemented some other way: that function only ever reads
 *    `eraConstraint.primary`/`.forbidden`/generic share, never
 *    `.coPrimary`, so a real 30%/30% co-primary set that passes the design
 *    gate has literally no post-generation era-share check waiting for it.
 *  - core/constraints.ts's `applyEraQuota` — the function that actually
 *    SHAPES a real pack's genre distribution at generation time (called
 *    from core/setDirector.ts, not merely a check that runs after the
 *    fact) — hard-codes `primaryMinShare = era.coPrimary ? 0.4 : 0.5`
 *    (see that function's own real code, from v3.77's TASK D compound-era
 *    work). This is the actual, already-tuned number a real generated pack
 *    is BUILT to satisfy.
 *
 * `applyEraQuota`'s 0.5 (single) / 0.4 (each co-primary) are treated as the
 * authoritative numbers here — NOT designGate.ts's own looser 40%/30% —
 * because they are the values a real pack is actually constructed to hit,
 * not just retroactively checked against. compositionScorer.ts's
 * pre-existing 0.5 single-primary number already independently agreed with
 * this real enforcement value, which is further evidence 0.5 (not 0.4) is
 * the genuinely validated one; designGate.ts's own 40%/30% were the ones
 * that had drifted loose of what generation actually guarantees. Raising
 * designGate.ts's own floor to match does not newly block any real,
 * achievable senior-oldpop pack — see designGate.ts's own eraIssues call
 * site and this task's regression tests for the verification.
 *
 * `genericAdvisoryMax`(구 `genericBlockingMax`도 여기 있었다) —
 * compositionScorer.ts의 20% ADVISORY 범용/era-neutral 장르 비중 경고
 * (mirrors this codebase's own established two-tier convention elsewhere,
 * e.g. compositionScorer.ts's own DESCRIPTOR_COUNT_ADVISORY_MIN/MAX and
 * DESCRIPTOR_COUNT_BLOCK_MIN/MAX pair, or LYRIC_ADVISORY_FLOOR_RATIO and
 * LYRIC_BLOCKING_FLOOR_RATIO — an early advisory heads-up, no hard block
 * behind it here since TASK A-3 below replaced that with something more
 * precise).
 *
 * 지시문 12 (TASK A-3) — `genericBlockingMax`(designGate.ts의 구
 * era-unspecified-share가 쓰던 전역 25% 블로킹 상한)는 삭제했다. genreLibrary
 * 354종 전수가 eraBuckets를 갖게 되면서 "시대 미지정" 상태 자체가 없어졌고
 * (모든 장르가 실제 연대 또는 명시적 'era-neutral' 값을 가짐), 그 대체
 * 메커니즘(era-neutral-share 관문)은 워크스페이스마다 다른 정책값
 * (data/workspaceEraIntent.ts의 eraNeutralMaxShare)을 쓴다 — 전역 단일
 * 상수로는 "kr-2030/kids는 제한 없음, senior-oldpop만 낮게"를 표현할 수
 * 없어서 이 파일에서 워크스페이스별 파일로 옮겼다.
 */
export interface EraPolicy {
  /** A single (non-compound) primary era bucket's minimum required genre-count share. Both designGate.ts and compositionScorer.ts: BLOCKING. */
  singlePrimaryMin: number;
  /** Each bucket's minimum required share in a compound (co-primary) concept. Both designGate.ts and compositionScorer.ts: BLOCKING. */
  coPrimaryMinEach: number;
  /** Era-neutral genre share ceiling past which compositionScorer.ts warns — ADVISORY only, workspace-agnostic (unlike designGate.ts's blocking era-neutral-share gate, see data/workspaceEraIntent.ts's eraNeutralMaxShare). */
  genericAdvisoryMax: number;
}

export const ERA_POLICY: EraPolicy = {
  singlePrimaryMin: 0.5,
  coPrimaryMinEach: 0.4,
  genericAdvisoryMax: 0.2
};
