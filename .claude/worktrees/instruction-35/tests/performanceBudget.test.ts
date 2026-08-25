import { describe, expect, it } from 'vitest';
import {
  measurePreallocation18Songs, measureDesignGate, measureMultiSetPreflight90Songs,
  measureFullAudit, measureRewritePlan, measureHistorySnapshot, measureSceneSimilarity,
  measureImportInspection, measurePromptCompilation, type PerformanceMeasurement
} from '../scripts/performanceBudget';

/**
 * codex 지시문 07 (TASK I) — "성능 목표는 실제 baseline을 측정한 뒤 설정한다".
 * Budgets below are real observed baselines (3 local runs, all machines-vary
 * within ~15% of each other) with generous headroom for slower CI hardware —
 * same real-measured-then-budgeted-with-headroom convention as
 * tests/stress-production.test.ts's own S4 override.
 *
 * Real observed baselines (18-song single set, local run):
 *   preallocation-18-songs   ~16-17ms
 *   design-gate              ~1.4ms
 *   multiset-preflight-90-songs ~0.06ms
 *   full-audit               ~13-14ms
 *   rewrite-plan              ~0.2ms
 *   history-snapshot          ~0.8ms
 *   scene-similarity          ~1.4ms
 *   import-inspection         ~2.7-3.5ms
 *   prompt-compilation        ~0.25ms
 *
 * None of these approach a magnitude that would block the UI thread for
 * "a long time" (60fps frame budget is ~16.7ms) at real 18-song single-set
 * scale — preallocation and full-audit are the closest to that budget and
 * are the first candidates for worker offloading if a future task raises
 * the per-operation song count materially above 18 (e.g. a serial 90-song
 * multi-set full audit), but no worker offload is warranted today.
 */
const BUDGETS_MS: Record<string, number> = {
  'preallocation-18-songs': 200,
  'design-gate': 100,
  'multiset-preflight-90-songs': 50,
  'full-audit': 200,
  'rewrite-plan': 100,
  'history-snapshot': 100,
  'scene-similarity': 100,
  'import-inspection': 150,
  'prompt-compilation': 50
};

function assertWithinBudget(m: PerformanceMeasurement) {
  const budget = BUDGETS_MS[m.operation];
  expect(budget, `no budget defined for ${m.operation}`).toBeDefined();
  expect(m.durationMs, `${m.operation} took ${m.durationMs.toFixed(2)}ms, budget is ${budget}ms`).toBeLessThan(budget);
}

describe('[codex 지시문 07 TASK I] performance budgets — real baseline measurement', () => {
  it('preallocation of 18 songs stays within budget', () => {
    assertWithinBudget(measurePreallocation18Songs());
  });

  it('design gate evaluation stays within budget', () => {
    assertWithinBudget(measureDesignGate());
  });

  it('90-song (5-set) multi-set preflight aggregation stays within budget', () => {
    assertWithinBudget(measureMultiSetPreflight90Songs());
  });

  it('full audit (49-item) stays within budget', () => {
    assertWithinBudget(measureFullAudit());
  });

  it('rewrite plan construction stays within budget', () => {
    assertWithinBudget(measureRewritePlan());
  });

  it('generation history snapshot construction stays within budget', () => {
    assertWithinBudget(measureHistorySnapshot());
  });

  it('scene similarity check stays within budget', () => {
    assertWithinBudget(measureSceneSimilarity());
  });

  it('import inspection stays within budget', () => {
    assertWithinBudget(measureImportInspection());
  });

  it('prompt compilation stays within budget', () => {
    assertWithinBudget(measurePromptCompilation());
  });
});
