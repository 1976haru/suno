import { describe, expect, it } from 'vitest';
import { distinctPackIdCount, evaluateCombosForLearning, nextComboLearningStage } from '../src/core/verifiedCombos';
import type { RatingRecord } from '../src/core/ratingLedger';

/**
 * codex 지시문 06 (TASK G, required test file) — real coverage of the 4-gate
 * "suggested" evaluation (sample≥5/good≥70%/bad≤15%/sets≥2) and the
 * structural "자동 승격 금지" guarantee: nextComboLearningStage can never
 * produce 'approved' on its own, no matter how strong the data is.
 */

function makeRating(overrides: Partial<RatingRecord> = {}): RatingRecord {
  return {
    songId: 's1', packId: 'p1', rating: 'good', ratedAt: '2026-01-01T00:00:00.000Z',
    attributes: { genreId: 'jazz-pop', bpm: 96 },
    workspaceId: 'senior-oldpop',
    ...overrides
  } as RatingRecord;
}

describe('[codex 지시문 06 TASK G] distinctPackIdCount', () => {
  it('counts real distinct sets, not raw rating count', () => {
    const ratings = [makeRating({ packId: 'p1' }), makeRating({ packId: 'p1' }), makeRating({ packId: 'p2' })];
    expect(distinctPackIdCount(ratings)).toBe(2);
  });
});

describe('[codex 지시문 06 TASK G] evaluateCombosForLearning — real 4-gate "suggested" evaluation', () => {
  it('stays "observed" below 5 real takes even with a perfect good rate', () => {
    const ratings = Array.from({ length: 4 }, (_, i) => makeRating({ songId: `s${i}`, packId: `p${i}`, rating: 'good' }));
    const results = evaluateCombosForLearning(ratings, 'senior-oldpop', []);
    expect(results[0].stage).toBe('observed');
  });

  it('stays "observed" with 5+ takes but good rate below 70%', () => {
    const ratings = [
      ...Array.from({ length: 3 }, (_, i) => makeRating({ songId: `g${i}`, packId: `p${i}`, rating: 'good' })),
      ...Array.from({ length: 3 }, (_, i) => makeRating({ songId: `b${i}`, packId: `p${i + 10}`, rating: 'bad' }))
    ];
    const results = evaluateCombosForLearning(ratings, 'senior-oldpop', []);
    expect(results[0].stage).toBe('observed');
  });

  it('stays "observed" when good>=70% but bad exceeds the real 15% cap (this task\'s own new gate)', () => {
    // 5 good (71%), 2 bad (29% — over the 15% cap) out of 7.
    const ratings = [
      ...Array.from({ length: 5 }, (_, i) => makeRating({ songId: `g${i}`, packId: `p${i}`, rating: 'good' })),
      ...Array.from({ length: 2 }, (_, i) => makeRating({ songId: `b${i}`, packId: `p${i + 10}`, rating: 'bad' }))
    ];
    const results = evaluateCombosForLearning(ratings, 'senior-oldpop', []);
    expect(results[0].stage).toBe('observed');
    expect(results[0].badShare).toBeGreaterThan(0.15);
  });

  it('stays "observed" when every gate but "spread across >= 2 sets" passes (all takes from ONE set)', () => {
    const ratings = Array.from({ length: 6 }, (_, i) => makeRating({ songId: `s${i}`, packId: 'the-only-pack', rating: 'good' }));
    const results = evaluateCombosForLearning(ratings, 'senior-oldpop', []);
    expect(results[0].distinctSetCount).toBe(1);
    expect(results[0].stage).toBe('observed');
  });

  it('reaches "suggested" only when ALL 4 real gates pass at once', () => {
    const ratings = [
      ...Array.from({ length: 5 }, (_, i) => makeRating({ songId: `g${i}`, packId: `p${i % 2}`, rating: 'good' })),
      ...Array.from({ length: 1 }, (_, i) => makeRating({ songId: `o${i}`, packId: `p${i}`, rating: 'ok' }))
    ];
    const results = evaluateCombosForLearning(ratings, 'senior-oldpop', []);
    expect(results[0].sampleSize).toBeGreaterThanOrEqual(5);
    expect(results[0].goodShare).toBeGreaterThanOrEqual(0.7);
    expect(results[0].badShare).toBeLessThanOrEqual(0.15);
    expect(results[0].distinctSetCount).toBeGreaterThanOrEqual(2);
    expect(results[0].stage).toBe('suggested');
  });

  it('never returns "approved"/"verified"/"revalidated" — a pure ratings evaluation structurally cannot reach those', () => {
    const ratings = [
      ...Array.from({ length: 20 }, (_, i) => makeRating({ songId: `g${i}`, packId: `p${i}`, rating: 'good' }))
    ];
    const results = evaluateCombosForLearning(ratings, 'senior-oldpop', []);
    expect(['observed', 'suggested']).toContain(results[0].stage);
  });
});

describe('[codex 지시문 06 TASK G] nextComboLearningStage — 완료 기준 "automatic learning without approval = 0"', () => {
  it('observed -> suggested when all gates pass', () => {
    expect(nextComboLearningStage('observed', 6, 0.8, 0.1, 2)).toBe('suggested');
  });

  it('observed stays observed when any gate fails', () => {
    expect(nextComboLearningStage('observed', 3, 0.9, 0, 3)).toBe('observed');
  });

  it('suggested NEVER self-promotes to approved, no matter how strong the data is', () => {
    expect(nextComboLearningStage('suggested', 1000, 1, 0, 100)).toBe('suggested');
  });

  it('approved -> verified only with a real, larger post-approval sample still clearing every gate', () => {
    expect(nextComboLearningStage('approved', 6, 0.8, 0.1, 2)).toBe('approved'); // same-size sample as suggestion — not yet "more evidence"
    expect(nextComboLearningStage('approved', 10, 0.8, 0.1, 2)).toBe('verified'); // 2x the original min sample, still passing
  });

  it('verified -> revalidated on a later re-check that still passes', () => {
    expect(nextComboLearningStage('verified', 10, 0.75, 0.1, 3)).toBe('revalidated');
  });

  it('a stage never regresses automatically when a later check fails — surfaced unchanged for manual review', () => {
    expect(nextComboLearningStage('approved', 5, 0.5, 0.4, 2)).toBe('approved');
    expect(nextComboLearningStage('verified', 5, 0.5, 0.4, 2)).toBe('verified');
  });

  it('the ONLY way currentStage is ever "approved" in the first place is an external event — this function itself has no path that outputs "approved"', () => {
    const allInputs: Array<[number, number, number, number]> = [
      [0, 0, 0, 0], [5, 1, 0, 5], [1000, 1, 0, 1000], [3, 0.5, 0.5, 1]
    ];
    for (const stage of ['observed', 'suggested', 'verified', 'revalidated'] as const) {
      for (const [sample, good, bad, sets] of allInputs) {
        expect(nextComboLearningStage(stage, sample, good, bad, sets)).not.toBe('approved');
      }
    }
  });
});
