import { describe, expect, it } from 'vitest';
import { checkKpopFixedQuotaFidelity } from '../src/core/kpopSharedChecks';
import { KR_IDOL_MALE_POLICY, checkKrIdolMaleFixedQuota } from '../src/core/kpopMalePolicy';
import { KR_IDOL_FEMALE_POLICY, checkKrIdolFemaleFixedQuota } from '../src/core/kpopFemalePolicy';
import { scaleVocalQuota } from '../src/core/vocalPlan';

/**
 * codex 지시문 04 (§8, required test file) — dedicated focus test for
 * "고정 보컬 쿼터 정확히" (18-song regression criteria: "fixed vocal quota
 * exact"). Real reuse of core/vocalPlan.ts's own scaleVocalQuota — this
 * locks in the actual songCount-scaled targets, not hand-computed numbers.
 */
describe('[codex 지시문 04 §8] checkKpopFixedQuotaFidelity — real ±1/exact-0 tolerance', () => {
  it('kr-idol-male real policy is { male: 15, female: 0, mixed: 3 } (data/presets.ts confirmed default)', () => {
    expect(KR_IDOL_MALE_POLICY.fixedVocalQuota).toEqual({ male: 15, female: 0, mixed: 3 });
  });

  it('kr-idol-female real policy is the symmetric { male: 0, female: 15, mixed: 3 }', () => {
    expect(KR_IDOL_FEMALE_POLICY.fixedVocalQuota).toEqual({ male: 0, female: 15, mixed: 3 });
  });

  it('a real, exactly-matching 18-song male pack passes with zero findings', () => {
    const scaled = scaleVocalQuota(KR_IDOL_MALE_POLICY.fixedVocalQuota!, 18);
    expect(checkKrIdolMaleFixedQuota(scaled, 18)).toEqual([]);
  });

  it('female:0 is a hard exact-0 requirement — even a single female track blocks (no ±1 tolerance at 0)', () => {
    const counts = { male: 14, female: 1, mixed: 3 };
    const findings = checkKrIdolMaleFixedQuota(counts, 18);
    expect(findings.some(f => f.type === 'female' && f.expected === 0 && f.actual === 1)).toBe(true);
  });

  it('a 1-song drift within tolerance (male 14 vs expected 15) does not block', () => {
    const counts = { male: 14, female: 0, mixed: 4 };
    const findings = checkKrIdolMaleFixedQuota(counts, 18);
    expect(findings.some(f => f.type === 'male')).toBe(false);
  });

  it('a real, badly-drifted pack (even split, ignoring the fixed quota entirely) blocks on both male and female', () => {
    const counts = { male: 6, female: 6, mixed: 6 };
    const findings = checkKrIdolFemaleFixedQuota(counts, 18);
    expect(findings.some(f => f.type === 'male')).toBe(true);
    expect(findings.some(f => f.type === 'female')).toBe(true);
  });

  it('a workspace with no fixedVocalQuota set returns no findings (never a false block)', () => {
    expect(checkKpopFixedQuotaFidelity({ male: 1, female: 1, mixed: 1 }, { ...KR_IDOL_MALE_POLICY, fixedVocalQuota: undefined }, 18)).toEqual([]);
  });
});
