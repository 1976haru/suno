import { describe, expect, it } from 'vitest';
import {
  ALL_AUDIT_ITEM_ID_GROUPS,
  TRACK_SCOPED_ITEM_ID_SET,
  DESIGN_SCOPED_ITEM_ID_SET,
  FULL_AUDIT_ITEM_IDS,
  RELEASE_READINESS_ITEM_IDS
} from '../src/core/auditItemIds';
import { classifyReleaseReadinessFailures } from '../src/core/rewriteLoop';
import type { ReleaseReadinessItem, ReleaseReadinessReport } from '../src/core/releaseReadiness';

/**
 * codex 지시문 05 (TASK C, required test file) — real drift-detection
 * coverage for the single audit-item-id registry. The core assertion this
 * file exists to make: every id core/rewriteLoop.ts's own scope sets
 * reference is a REAL member of its declared source group — this is the
 * exact check that would have caught the confirmed 'bpm-in-range' vs
 * 'bpm_in_range' drift bug before this task fixed it.
 */

describe('[codex 지시문 05 TASK C] no two different constants collide on the same string value within a group', () => {
  it.each(Object.entries(ALL_AUDIT_ITEM_ID_GROUPS))('%s has no duplicate id values', (_name, group) => {
    const values = Object.values(group);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('[codex 지시문 05 TASK C] TRACK_SCOPED_ITEM_ID_SET / DESIGN_SCOPED_ITEM_ID_SET reference only real ids', () => {
  it('every track-scoped id is a real releaseReadiness id (not a hand-typed guess)', () => {
    const realReleaseReadinessIds = new Set(Object.values(RELEASE_READINESS_ITEM_IDS));
    for (const id of TRACK_SCOPED_ITEM_ID_SET) {
      expect(realReleaseReadinessIds.has(id)).toBe(true);
    }
  });

  it('every design-scoped id is a real fullAudit or releaseReadiness id — the real fix for the confirmed bpm-in-range/bpm_in_range drift bug', () => {
    const realIds = new Set([...Object.values(FULL_AUDIT_ITEM_IDS), ...Object.values(RELEASE_READINESS_ITEM_IDS)]);
    for (const id of DESIGN_SCOPED_ITEM_ID_SET) {
      expect(realIds.has(id)).toBe(true);
    }
    // The literal confirmed-broken old guess never appears as a real id.
    expect(realIds.has('bpm-in-range')).toBe(false);
    expect(realIds.has(FULL_AUDIT_ITEM_IDS.bpmInRange)).toBe(true);
  });
});

describe('[codex 지시문 05 TASK C] end-to-end: rewriteLoop now correctly classifies real fullAudit ids as design-scoped', () => {
  function makeReport(failing: ReleaseReadinessItem[]): ReleaseReadinessReport {
    return {
      items: failing, totalCriteria: 32, passedCriteria: 32 - failing.length, releaseReady: failing.length === 0, failing,
      explorationExemptCount: 0, measuredCriteria: 32, passedOfMeasured: 32 - failing.length, unmeasuredCount: 0
    };
  }

  it('a real fullAudit.ts id (bpm_in_range) now classifies as design scope, not the old silent rebalance fallback', () => {
    const songs = Array.from({ length: 6 }, (_, i) => ({ trackNo: i + 1 }));
    const report = makeReport([{ id: FULL_AUDIT_ITEM_IDS.bpmInRange, categoryKo: '음악 설계', category: 'structural', labelKo: 'BPM 범위', status: 'fail', detail: '' }]);
    const issues = classifyReleaseReadinessFailures(report, songs);
    expect(issues[0].scope).toBe('design');
  });
});
