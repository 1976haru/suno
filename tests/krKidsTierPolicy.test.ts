import { describe, expect, it } from 'vitest';
import {
  resolveKrKidsExpectedPhasePolicy,
  findConsecutivePhaseRuns,
  checkKrKidsSafety,
  findKrKidsExtendedSafetyIssues,
  maxWordsPerLineForTier,
  didacticToneAdvisory
} from '../src/core/krKidsPolicy';
import { kidsArcBundlePlanFor } from '../src/core/arcModels';

/**
 * codex 지시문 04 (§4) — real, dedicated kr-kids policy adapter. MAJOR
 * investigation finding: the phase/bundle/intensity/terminal-phase system
 * already fully exists (core/arcModels.ts + core/designGate.ts's
 * kidsArcBundleStructureIssues) — this module exposes that same real data
 * under this task's own literal vocabulary, and adds only the genuinely
 * new pieces (general consecutive-phase check, 4 new safety categories,
 * didactic-tone advisory).
 */
describe('[codex 지시문 04 §4] resolveKrKidsExpectedPhasePolicy — exposes the real, already-existing bundle system', () => {
  it('kidsAgeTierId is passed through exactly, never inferred', () => {
    const policy = resolveKrKidsExpectedPhasePolicy(18, 'kids-t1');
    expect(policy.kidsAgeTierId).toBe('kids-t1');
  });

  it('expectedPhaseSet/expectedPhaseCounts match the real arcModels.ts data exactly', () => {
    const policy = resolveKrKidsExpectedPhasePolicy(18, 'kids-t3');
    const real = kidsArcBundlePlanFor(18, 'kids-t3').filter(e => e.count > 0);
    expect(policy.expectedPhaseSet).toEqual(real.map(e => e.phase));
    expect(policy.expectedPhaseCounts).toEqual(real.map(e => ({ phase: e.phase, count: e.count })));
  });

  it('different tiers produce genuinely different expected phase sets (3 vs 4 vs 5 bundles)', () => {
    const t1 = resolveKrKidsExpectedPhasePolicy(18, 'kids-t1');
    const t2 = resolveKrKidsExpectedPhasePolicy(18, 'kids-t2');
    const t3 = resolveKrKidsExpectedPhasePolicy(18, 'kids-t3');
    expect(t1.expectedPhaseSet.length).toBe(3);
    expect(t2.expectedPhaseSet.length).toBe(4);
    expect(t3.expectedPhaseSet.length).toBe(5);
  });

  it('intensityPolicy carries the real per-phase intensity values', () => {
    const policy = resolveKrKidsExpectedPhasePolicy(18, 'kids-t2');
    expect(policy.intensityPolicy.every(p => p.intensity >= 1 && p.intensity <= 5)).toBe(true);
  });
});

describe('[codex 지시문 04 §4] findConsecutivePhaseRuns — NEW general consecutive-phase check', () => {
  it('flags 3+ consecutive songs sharing the identical phase (any phase, not just moving)', () => {
    const warnings = findConsecutivePhaseRuns(['kids-familiar', 'kids-familiar', 'kids-familiar', 'kids-calm']);
    expect(warnings.some(w => w.phase === 'kids-familiar')).toBe(true);
  });

  it('does not flag a real, well-alternating sequence', () => {
    expect(findConsecutivePhaseRuns(['kids-familiar', 'kids-learning', 'kids-moving', 'kids-calm'])).toHaveLength(0);
  });

  it('does not flag exactly 2 consecutive (within the default cap)', () => {
    expect(findConsecutivePhaseRuns(['kids-familiar', 'kids-familiar', 'kids-calm'])).toHaveLength(0);
  });
});

describe('[codex 지시문 04 §4] safety — 4 new categories beyond kidsLyricEngine.ts\'s existing list', () => {
  it('flags a real bullying/exclusion phrase', () => {
    expect(findKrKidsExtendedSafetyIssues('너랑 안 놀아 저리 가')).toContain('bullying');
  });

  it('flags a real guardian-less-danger phrase', () => {
    expect(findKrKidsExtendedSafetyIssues('보호자 없이 혼자 밤길을 걸었어요')).toContain('guardian-less-danger');
  });

  it('does not flag ordinary, safe kids content', () => {
    expect(findKrKidsExtendedSafetyIssues('오늘도 신나게 노래해요')).toHaveLength(0);
  });

  it('checkKrKidsSafety combines the existing real checker with the 4 new categories', () => {
    // Existing kidsLyricEngine.ts checker still fires for its own real content (fear/violence).
    expect(checkKrKidsSafety('무서운 괴물이 나타났어요').length).toBeGreaterThan(0);
    // New category also fires through the same combined entry point.
    expect(checkKrKidsSafety('너랑 안 놀아').length).toBeGreaterThan(0);
  });
});

describe('[codex 지시문 04 §4] language — sentence length by tier (real reuse), didactic-tone advisory (new)', () => {
  it('maxWordsPerLineForTier reuses the real data/kidsAgeTiers.ts value', () => {
    expect(maxWordsPerLineForTier('kids-t1')).toBe(5);
  });

  it('flags a real, heavily lecture-toned lyric', () => {
    const lines = ['손을 씻어야 해요', '이를 닦아야 돼요', '일찍 자야 해요', '꼭 인사하세요'];
    expect(didacticToneAdvisory(lines)).toBe(true);
  });

  it('does not flag an ordinary, mostly-narrative kids lyric', () => {
    const lines = ['우리 함께 놀아요', '신나는 노래를 불러요', '오늘은 즐거운 날이에요', '꽃이 활짝 피었어요'];
    expect(didacticToneAdvisory(lines)).toBe(false);
  });

  it('never false-positives on a very short lyric with too few lines to judge tone', () => {
    expect(didacticToneAdvisory(['손을 씻어야 해요'])).toBe(false);
  });
});
