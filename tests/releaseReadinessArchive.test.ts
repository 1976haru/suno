import { describe, expect, it } from 'vitest';
import { summarizeReleaseReadinessTrend, type ReleaseReadinessArchiveRecord } from '../src/core/releaseReadinessArchive';

/**
 * v5.22 (AXIS 4 §4-5) — coverage for summarizeReleaseReadinessTrend, the
 * one pure function in releaseReadinessArchive.ts (the rest is IndexedDB
 * CRUD, same untestable-in-Node limitation as every other ledger in this
 * codebase — see tests/lyricLineLedger.test.ts's own doc comment).
 */
function record(overrides: Partial<ReleaseReadinessArchiveRecord> = {}): ReleaseReadinessArchiveRecord {
  return {
    id: 'senior-oldpop::S1', setCode: 'S1', recordedAt: '2026-08-06T00:00:00.000Z',
    totalCriteria: 32, passedCriteriaFirstPass: 32, passedCriteriaLatest: 32, rewritePassesRun: 0,
    ...overrides
  };
}

describe('[v5.22 AXIS 4] summarizeReleaseReadinessTrend', () => {
  it('an empty history has a 0 clean rate, never divides by zero', () => {
    expect(summarizeReleaseReadinessTrend([])).toEqual({ records: [], firstPassCleanRate: 0 });
  });

  it('computes the first-pass-clean rate from passedCriteriaFirstPass === totalCriteria', () => {
    const records = [
      record({ setCode: 'S1', passedCriteriaFirstPass: 32 }),
      record({ setCode: 'S2', passedCriteriaFirstPass: 28 }),
      record({ setCode: 'S3', passedCriteriaFirstPass: 32 })
    ];
    const trend = summarizeReleaseReadinessTrend(records);
    expect(trend.firstPassCleanRate).toBeCloseTo(2 / 3);
  });

  it('rewrite-loop improvement (passedCriteriaLatest) never counts toward the first-pass rate', () => {
    const records = [record({ setCode: 'S1', passedCriteriaFirstPass: 28, passedCriteriaLatest: 32, rewritePassesRun: 1 })];
    const trend = summarizeReleaseReadinessTrend(records);
    expect(trend.firstPassCleanRate).toBe(0);
  });
});
