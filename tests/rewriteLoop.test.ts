import { describe, expect, it } from 'vitest';
import { buildRewriteInstruction, classifyReleaseReadinessFailures, shouldContinueRewriteLoop } from '../src/core/rewriteLoop';
import type { ReleaseReadinessItem, ReleaseReadinessReport } from '../src/core/releaseReadiness';

/**
 * v5.22 (AXIS 5) — coverage for the rewrite loop: no such loop existed
 * before this task (recompose/regenerateFailedSongs/rewriteLoop were all
 * unimplemented, per this task's own audit).
 */
function makeReport(failing: ReleaseReadinessItem[], totalCriteria = 32): ReleaseReadinessReport {
  return { items: failing, totalCriteria, passedCriteria: totalCriteria - failing.length, releaseReady: failing.length === 0, failing };
}

describe('[v5.22 AXIS 5 §5-5] shouldContinueRewriteLoop — max 2 automatic rounds', () => {
  it('allows round 1 and round 2', () => {
    expect(shouldContinueRewriteLoop(0)).toBe(true);
    expect(shouldContinueRewriteLoop(1)).toBe(true);
  });

  it('refuses a 3rd round', () => {
    expect(shouldContinueRewriteLoop(2)).toBe(false);
    expect(shouldContinueRewriteLoop(3)).toBe(false);
  });
});

describe('[v5.22 AXIS 5 §5-3] classifyReleaseReadinessFailures — IssueScope classification', () => {
  const songs = Array.from({ length: 18 }, (_, i) => ({ trackNo: i + 1 }));

  it('a track-scoped item (english-grammar-errors) resolves real affectedTracks from its own detail string', () => {
    const report = makeReport([{ id: 'english-grammar-errors', categoryKo: '가사', labelKo: '영어 문법 오류 0건', status: 'fail', detail: 'T3, T5에서 감지' }]);
    const issues = classifyReleaseReadinessFailures(report, songs);
    expect(issues).toHaveLength(1);
    expect(issues[0].scope).toBe('track');
  });

  // codex 지시문 05 (TASK C) — fixture id fixed from the old, wrong
  // hyphenated guess ('bpm-in-range') to the real underscored id
  // fullAudit.ts actually uses ('bpm_in_range') — see core/auditItemIds.ts's
  // own doc comment for the real drift bug this closes.
  it('a design-scoped item (bpm_in_range) affects every track', () => {
    const report = makeReport([{ id: 'bpm_in_range', categoryKo: '음악 설계', labelKo: 'BPM 범위 준수', status: 'fail', detail: '2곡 위반' }]);
    const issues = classifyReleaseReadinessFailures(report, songs);
    expect(issues[0].scope).toBe('design');
    expect(issues[0].affectedTracks).toEqual(songs.map(s => s.trackNo));
  });

  it('a genuinely unimplemented item never generates a rewrite issue (nothing to rewrite toward)', () => {
    const report = makeReport([{ id: 'modulation-count', categoryKo: '음악 설계', labelKo: '전조 5~6곡', status: 'not-measured', detail: '미구현', notImplemented: true }]);
    expect(classifyReleaseReadinessFailures(report, songs)).toEqual([]);
  });

  it('a catastrophic failure (< totalCriteria - 12 passed) collapses to a single "full" scope issue', () => {
    const manyFailing: ReleaseReadinessItem[] = Array.from({ length: 15 }, (_, i) => ({
      id: `item-${i}`, categoryKo: '가사', labelKo: `문제 ${i}`, status: 'fail' as const, detail: ''
    }));
    const report = makeReport(manyFailing, 32); // passedCriteria = 17, threshold is totalCriteria-12=20 -> 17 < 20 -> full
    const issues = classifyReleaseReadinessFailures(report, songs);
    expect(issues).toHaveLength(1);
    expect(issues[0].scope).toBe('full');
  });
});

describe('[v5.22 AXIS 5 §5-4] buildRewriteInstruction — concrete per-track problem/requirement text', () => {
  const allTrackNos = [1, 2, 3, 4];

  it('names only the affected tracks, and states how many stay untouched', () => {
    const issues = classifyReleaseReadinessFailures(
      makeReport([{ id: 'english-grammar-errors', categoryKo: '가사', labelKo: '영어 문법 오류 0건', status: 'fail', detail: 'T3에서 감지' }]),
      allTrackNos.map(trackNo => ({ trackNo }))
    );
    const instruction = buildRewriteInstruction(issues, allTrackNos);
    expect(instruction).toContain('아래 1곡만 다시 만드십시오. 나머지 3곡은 그대로 유지합니다.');
    expect(instruction).toContain('T3');
    expect(instruction).not.toContain('T1\n');
  });

  it('returns an empty string when there is nothing to rewrite', () => {
    expect(buildRewriteInstruction([], allTrackNos)).toBe('');
  });

  it('a design-scoped issue lists every track under "세트 전체에 적용되는 문제", not per-track blocks', () => {
    const issues = classifyReleaseReadinessFailures(
      makeReport([{ id: 'bpm_in_range', categoryKo: '음악 설계', labelKo: 'BPM 범위 준수', status: 'fail', detail: '2곡 위반' }]),
      allTrackNos.map(trackNo => ({ trackNo }))
    );
    const instruction = buildRewriteInstruction(issues, allTrackNos);
    expect(instruction).toContain('세트 전체에 적용되는 문제');
    expect(instruction).toContain('BPM 범위 준수');
  });
});
