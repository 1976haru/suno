import { describe, expect, it } from 'vitest';
import { checkTextMotifQuotas, checkTextMotifQuotasWithConceptOverride, type TextMotifFamily } from '../src/core/textMotifQuota';
import { SENIOR_MOTIF_QUOTAS, checkSeniorMotifQuotas } from '../src/core/seniorOldpopPolicy';
import { checkKr2030ModernMotifQuotas } from '../src/core/kr2030Policy';
import { checkJp2030ModernMotifQuotas } from '../src/core/jp2030Policy';
import { modern2030PolicyFor } from '../src/core/modern2030Policy';
import { KR_IDOL_MALE_POLICY, checkKrIdolMaleMotifQuotas } from '../src/core/kpopMalePolicy';
import { KR_IDOL_FEMALE_POLICY, checkKrIdolFemaleMotifQuotas } from '../src/core/kpopFemalePolicy';

/**
 * codex 지시문 04 (§10, required test file) — the shared-engine test:
 * covers core/textMotifQuota.ts's own generic engine directly, then every
 * real per-workspace instantiation together in one place (senior-oldpop,
 * kr-2030, jp-2030, kr-idol-male, kr-idol-female — kr-kids/jp-kids have no
 * motif-quota adapter, confirmed by investigation: the spec named motif
 * quotas only for these 5 workspaces). Individual adapter test files
 * (seniorOldpopPolicy.test.ts, kr2030Policy.test.ts, etc.) already cover
 * each workspace's own quota behavior in isolation — this file's own job is
 * to confirm the shared engine itself is sound and that every workspace's
 * word list is real, distinct, non-empty data (not a copy-pasted stub).
 */

describe('[codex 지시문 04 §10] checkTextMotifQuotas — the shared engine itself', () => {
  const families: TextMotifFamily[] = [
    { id: 'test-a', labelKo: 'A', patterns: [/\bfoo\b/i], maxPerPack: 1 }
  ];

  it('one song counts at most once per family regardless of repeat mentions within that song', () => {
    const songs = [{ trackNo: 1, lyrics: 'foo foo foo foo' }];
    expect(checkTextMotifQuotas(songs, families)).toEqual([]);
  });

  it('flags only once a real cap is exceeded by distinct songs, not before', () => {
    const songs = [{ trackNo: 1, lyrics: 'foo' }, { trackNo: 2, lyrics: 'foo' }];
    const findings = checkTextMotifQuotas(songs, families);
    expect(findings).toHaveLength(1);
    expect(findings[0].trackNos).toEqual([1, 2]);
  });

  it('checkTextMotifQuotasWithConceptOverride flags the SAME violation but marks it overridden when the concept itself names the subject', () => {
    const songs = [{ trackNo: 1, lyrics: 'foo' }, { trackNo: 2, lyrics: 'foo' }];
    const findings = checkTextMotifQuotasWithConceptOverride(songs, families, 'a concept all about foo');
    expect(findings[0].overridden).toBe(true);
    expect(findings[0].overrideReasonKo).toBeTruthy();
  });
});

describe('[codex 지시문 04 §10] every workspace\'s own real motif quota list is distinct, non-empty data', () => {
  it('senior-oldpop: 6 named subjects (letter/coffee/window/train/porch/diner)', () => {
    expect(SENIOR_MOTIF_QUOTAS.map(f => f.id).sort()).toEqual(
      ['coffee-breakfast', 'diner-friends', 'letter-mail', 'porch-courtship', 'train-platform', 'window-light'].sort()
    );
  });

  it('kr-2030 modern scene families are real and distinct from jp-2030\'s own list', () => {
    const kr = modern2030PolicyFor('kr-2030')!.modernSceneFamilies.map(f => f.id);
    const jp = modern2030PolicyFor('jp-2030')!.modernSceneFamilies.map(f => f.id);
    expect(kr.length).toBeGreaterThan(0);
    expect(jp.length).toBeGreaterThan(0);
    expect(kr).not.toEqual(jp);
  });

  it('kr-idol-male and kr-idol-female each have their own real, distinct word lists', () => {
    const male = KR_IDOL_MALE_POLICY.motifQuotas.map(f => f.id).sort();
    const female = KR_IDOL_FEMALE_POLICY.motifQuotas.map(f => f.id).sort();
    expect(male.length).toBeGreaterThan(0);
    expect(female.length).toBeGreaterThan(0);
    expect(male).not.toEqual(female);
    // Both real lists happen to share 'mirror' as a common idol-imagery word — confirmed intentional, not accidental duplication.
    expect(male).toContain('mirror');
    expect(female).toContain('mirror');
  });
});

describe('[codex 지시문 04 §10] every workspace adapter correctly flags a real overuse case', () => {
  it('senior-oldpop flags letter/mail overuse (cap 2)', () => {
    const songs = [
      { trackNo: 1, lyrics: 'an old letter arrives' },
      { trackNo: 2, lyrics: 'writing a letter tonight' },
      { trackNo: 3, lyrics: 'the mail brought memories' }
    ];
    expect(checkSeniorMotifQuotas(songs).some(f => f.familyId === 'letter-mail')).toBe(true);
  });

  it('kr-2030 flags a real phone/message motif overuse (cap 2)', () => {
    const songs = [
      { trackNo: 1, lyrics: '휴대폰을 붙잡고 밤새 기다렸어' },
      { trackNo: 2, lyrics: '문자 한 통 없는 밤' },
      { trackNo: 3, lyrics: '핸드폰 화면만 보다가' }
    ];
    expect(checkKr2030ModernMotifQuotas(songs).some(f => f.familyId === 'phone-message')).toBe(true);
  });

  it('jp-2030 flags a real convenience-store overuse (cap 2)', () => {
    const songs = [
      { trackNo: 1, lyrics: 'x', listenerSituation: '深夜のコンビニで' },
      { trackNo: 2, lyrics: 'x', listenerSituation: 'コンビニの明かりが' },
      { trackNo: 3, lyrics: 'x', listenerSituation: '一人でコンビニに寄る' }
    ];
    expect(checkJp2030ModernMotifQuotas(songs).some(f => f.familyId === 'convenience-store')).toBe(true);
  });

  it('kr-idol-male flags a real fire/rise overuse (cap 3)', () => {
    const songs = [
      { trackNo: 1, lyrics: 'we rise through the fire' },
      { trackNo: 2, lyrics: 'watch us rising up' },
      { trackNo: 3, lyrics: 'fire in our eyes' },
      { trackNo: 4, lyrics: 'rise again tonight' }
    ];
    expect(checkKrIdolMaleMotifQuotas(songs).some(f => f.familyId === 'fire-rise')).toBe(true);
  });

  it('kr-idol-female flags a real diamond overuse (cap 2)', () => {
    const songs = [
      { trackNo: 1, lyrics: 'shine like a diamond' },
      { trackNo: 2, lyrics: 'diamonds in my hand' },
      { trackNo: 3, lyrics: 'a diamond never fades' }
    ];
    expect(checkKrIdolFemaleMotifQuotas(songs).some(f => f.familyId === 'diamond')).toBe(true);
  });
});
