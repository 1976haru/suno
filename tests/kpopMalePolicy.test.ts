import { describe, expect, it } from 'vitest';
import {
  KR_IDOL_MALE_POLICY,
  checkKrIdolMaleMotifQuotas,
  checkKrIdolMaleRapShare,
  findKrIdolMaleConsecutiveLeadRuns,
  checkKrIdolMaleChantOveruse
} from '../src/core/kpopMalePolicy';

/**
 * codex 지시문 04 (§6, required test file) — kr-idol-male's own thin
 * instantiation of the shared K-pop engine (core/kpopSharedChecks.ts)
 * against its own real motif word list (fire/crown/run/mirror/night/
 * spotlight).
 */
describe('[codex 지시문 04 §6] kr-idol-male motif quotas — real word list, real engine reuse', () => {
  it('flags a real overuse of the crown/throne motif (cap 2)', () => {
    const songs = [
      { trackNo: 1, lyrics: 'wearing the crown tonight' },
      { trackNo: 2, lyrics: 'sit on the throne alone' },
      { trackNo: 3, lyrics: 'this crown is mine' }
    ];
    const findings = checkKrIdolMaleMotifQuotas(songs);
    expect(findings.some(f => f.familyId === 'crown-throne')).toBe(true);
  });

  it('does not flag a pack that stays within every motif\'s own cap', () => {
    const songs = [{ trackNo: 1, lyrics: 'we run through the fire' }];
    expect(checkKrIdolMaleMotifQuotas(songs)).toEqual([]);
  });
});

// 지시문 43 (TASK D-2) — 12/18(0.667)에서 지시문 43 자신의 15곡 기준 목표
// 12/15(0.8)로 갱신(kpopWorkspacePolicy.ts의 rapPolicy 주석 참고).
describe('[codex 지시문 04 §6, 지시문 43 TASK D-2] kr-idol-male rap share — real reuse of idolPartPlan.ts\'s target, updated to 12/15', () => {
  it('a real 12/15 rap-section pack lands within tolerance', () => {
    const plans = [...Array(12).fill({ hasRapSection: true }), ...Array(3).fill({ hasRapSection: false })];
    expect(checkKrIdolMaleRapShare(plans).withinTolerance).toBe(true);
  });

  it('a pack with zero rap sections fails the target', () => {
    const plans = Array(18).fill({ hasRapSection: false });
    expect(checkKrIdolMaleRapShare(plans).withinTolerance).toBe(false);
  });

  it('KR_IDOL_MALE_POLICY.rapPolicy.targetRatio is the real 12/15 seed value (지시문 43 TASK D-2)', () => {
    expect(KR_IDOL_MALE_POLICY.rapPolicy.targetRatio).toBeCloseTo(12 / 15);
  });
});

describe('[codex 지시문 04 §6] kr-idol-male consecutive lead-type runs — real reuse of krKidsPolicy.ts\'s generic run check', () => {
  it('flags 3+ consecutive songs led by the same part type', () => {
    const warnings = findKrIdolMaleConsecutiveLeadRuns(['rapper', 'rapper', 'rapper', 'main-vocal']);
    expect(warnings.some(w => w.phase === 'rapper')).toBe(true);
  });

  it('does not flag a real, well-alternating lead sequence', () => {
    expect(findKrIdolMaleConsecutiveLeadRuns(['main-vocal', 'sub-vocal', 'rapper', 'main-vocal'])).toHaveLength(0);
  });
});

describe('[codex 지시문 04 §6] kr-idol-male chant overuse — real bounded check via lyricsAst.ts reuse', () => {
  it('flags the identical chant phrase repeating across most of a small pack', () => {
    const songs = [
      { trackNo: 1, lyrics: '[chant]\nwe rise together\n[verse 1]\nsome lyric here' },
      { trackNo: 2, lyrics: '[chant]\nwe rise together\n[verse 1]\nanother lyric' },
      { trackNo: 3, lyrics: '[verse 1]\na different song entirely' }
    ];
    const findings = checkKrIdolMaleChantOveruse(songs);
    expect(findings.some(f => f.phrase === 'we rise together')).toBe(true);
  });

  it('does not flag genuinely varied chant phrases', () => {
    const songs = [
      { trackNo: 1, lyrics: '[chant]\nwe rise together\n[verse 1]\nlyric' },
      { trackNo: 2, lyrics: '[chant]\nnever back down\n[verse 1]\nlyric' },
      { trackNo: 3, lyrics: '[chant]\none more round\n[verse 1]\nlyric' }
    ];
    expect(checkKrIdolMaleChantOveruse(songs)).toEqual([]);
  });
});
