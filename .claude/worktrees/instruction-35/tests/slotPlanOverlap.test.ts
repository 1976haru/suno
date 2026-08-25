import { describe, expect, it } from 'vitest';
import { computeSlotPlanOverlap } from '../src/core/slotPlanOverlap';
import type { SceneSignature } from '../src/core/situationLedger';

/**
 * 지시문 10 (TASK B-4-2) — real measured trigger: two concept-distinct real
 * packs ("60년대 올드팝 명곡" / "70년대 올드팝 명곡") landed 18/18 same-trackNo
 * lyricTheme duplication. These tests reproduce that shape directly (not a
 * hand-picked toy case) to lock in the block verdict.
 */
function recentSig(overrides: Partial<SceneSignature> & { trackNo: number }): SceneSignature {
  return { situation: '', packId: 'recent-pack', ...overrides };
}

describe('지시문 10 TASK B-4-2 — computeSlotPlanOverlap', () => {
  it('18/18 same-trackNo theme reuse (the real measured bug) verdicts block', () => {
    const recent: SceneSignature[] = Array.from({ length: 18 }, (_, i) => recentSig({ trackNo: i + 1, lyricTheme: `theme-${i + 1}`, situation: `situation-${i + 1}` }));
    const newSet = recent.map(r => ({ trackNo: r.trackNo, lyricTheme: r.lyricTheme, situation: r.situation }));

    const result = computeSlotPlanOverlap(newSet, recent);
    expect(result.verdict).toBe('block');
    expect(result.worstMatch?.overlapShare).toBe(1);
    expect(result.worstMatch?.matchedTrackNos).toHaveLength(18);
  });

  it('a genuinely different set (no trackNo overlap) verdicts ok', () => {
    const recent: SceneSignature[] = Array.from({ length: 18 }, (_, i) => recentSig({ trackNo: i + 1, lyricTheme: `theme-${i + 1}`, situation: `situation-${i + 1}` }));
    const newSet = Array.from({ length: 18 }, (_, i) => ({ trackNo: i + 1, lyricTheme: `different-${i + 1}`, situation: `different-situation-${i + 1}` }));

    const result = computeSlotPlanOverlap(newSet, recent);
    expect(result.verdict).toBe('ok');
    expect(result.worstMatch).toBeUndefined();
  });

  it('crosses the warn threshold (60%) but not block (80%)', () => {
    const recent: SceneSignature[] = Array.from({ length: 18 }, (_, i) => recentSig({ trackNo: i + 1, lyricTheme: `theme-${i + 1}` }));
    // 11/18 matched trackNos = ~61%, above warn (60%), below block (80%).
    const newSet = Array.from({ length: 18 }, (_, i) => ({
      trackNo: i + 1,
      lyricTheme: i < 11 ? `theme-${i + 1}` : `unique-${i + 1}`
    }));

    const result = computeSlotPlanOverlap(newSet, recent);
    expect(result.verdict).toBe('warn');
    expect(result.worstMatch?.matchedTrackNos).toHaveLength(11);
  });

  it('matches on situation alone (no theme id) still counts as reuse', () => {
    const recent: SceneSignature[] = [recentSig({ trackNo: 1, situation: 'a quiet kitchen morning' })];
    const newSet = [{ trackNo: 1, situation: 'a quiet kitchen morning' }];
    const result = computeSlotPlanOverlap(newSet, recent);
    expect(result.worstMatch?.matchedTrackNos).toEqual([1]);
  });

  it('the worst-matching pack (not just the first) is reported when multiple recent packs are supplied', () => {
    const packA = Array.from({ length: 18 }, (_, i) => recentSig({ trackNo: i + 1, packId: 'pack-A', lyricTheme: `a-${i + 1}` }));
    const packB = Array.from({ length: 18 }, (_, i) => recentSig({ trackNo: i + 1, packId: 'pack-B', lyricTheme: `theme-${i + 1}` }));
    const newSet = Array.from({ length: 18 }, (_, i) => ({ trackNo: i + 1, lyricTheme: `theme-${i + 1}` }));

    const result = computeSlotPlanOverlap(newSet, [...packA, ...packB]);
    expect(result.worstMatch?.packId).toBe('pack-B');
    expect(result.verdict).toBe('block');
  });
});
