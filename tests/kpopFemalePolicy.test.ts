import { describe, expect, it } from 'vitest';
import {
  KR_IDOL_FEMALE_POLICY,
  checkKrIdolFemaleMotifQuotas,
  checkKrIdolFemaleRapShare,
  findKrIdolFemaleConsecutiveLeadRuns,
  checkKrIdolFemaleChantOveruse
} from '../src/core/kpopFemalePolicy';

/**
 * codex 지시문 04 (§7, required test file) — kr-idol-female's own thin
 * instantiation of the shared K-pop engine (core/kpopSharedChecks.ts)
 * against its own real motif word list (queen/diamond/shine/mirror/fire/
 * runway) — mirrors tests/kpopMalePolicy.test.ts's own coverage shape.
 */
describe('[codex 지시문 04 §7] kr-idol-female motif quotas — real word list, real engine reuse', () => {
  it('flags a real overuse of the queen motif (cap 2)', () => {
    const songs = [
      { trackNo: 1, lyrics: 'call me your queen' },
      { trackNo: 2, lyrics: 'like a queen on the runway' },
      { trackNo: 3, lyrics: 'the queen never bows' }
    ];
    const findings = checkKrIdolFemaleMotifQuotas(songs);
    expect(findings.some(f => f.familyId === 'queen')).toBe(true);
  });

  it('does not flag a pack that stays within every motif\'s own cap', () => {
    const songs = [{ trackNo: 1, lyrics: 'diamonds in the night' }];
    expect(checkKrIdolFemaleMotifQuotas(songs)).toEqual([]);
  });

  it('the female motif list is genuinely different from the male one (queen/diamond/runway vs crown/spotlight)', () => {
    expect(KR_IDOL_FEMALE_POLICY.motifQuotas.map(m => m.id)).toContain('queen');
    expect(KR_IDOL_FEMALE_POLICY.motifQuotas.map(m => m.id)).not.toContain('crown-throne');
  });
});

describe('[codex 지시문 04 §7] kr-idol-female rap share — same real 12/18 target as kr-idol-male', () => {
  it('a real 12/18 rap-section pack lands within tolerance', () => {
    const plans = [...Array(12).fill({ hasRapSection: true }), ...Array(6).fill({ hasRapSection: false })];
    expect(checkKrIdolFemaleRapShare(plans).withinTolerance).toBe(true);
  });

  it('KR_IDOL_FEMALE_POLICY.rapPolicy.targetRatio matches kr-idol-male\'s own real seed value', () => {
    expect(KR_IDOL_FEMALE_POLICY.rapPolicy.targetRatio).toBeCloseTo(12 / 18);
  });
});

describe('[codex 지시문 04 §7] kr-idol-female consecutive lead-type runs', () => {
  it('flags 3+ consecutive songs led by the same part type', () => {
    const warnings = findKrIdolFemaleConsecutiveLeadRuns(['main-vocal', 'main-vocal', 'main-vocal', 'rapper']);
    expect(warnings.some(w => w.phase === 'main-vocal')).toBe(true);
  });
});

describe('[codex 지시문 04 §7] kr-idol-female chant overuse', () => {
  it('flags the identical chant phrase repeating across most of a small pack', () => {
    const songs = [
      { trackNo: 1, lyrics: '[ad-lib]\nshine like a diamond\n[verse 1]\nlyric' },
      { trackNo: 2, lyrics: '[ad-lib]\nshine like a diamond\n[verse 1]\nlyric' },
      { trackNo: 3, lyrics: '[verse 1]\na different song entirely' }
    ];
    const findings = checkKrIdolFemaleChantOveruse(songs);
    expect(findings.some(f => f.phrase === 'shine like a diamond')).toBe(true);
  });
});
