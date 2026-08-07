import { describe, expect, it } from 'vitest';
import { checkKrIdolMaleLanguageRole } from '../src/core/kpopMalePolicy';
import { checkKrIdolFemaleLanguageRole } from '../src/core/kpopFemalePolicy';
import { KR_IDOL_MALE_POLICY } from '../src/core/kpopMalePolicy';

/**
 * codex 지시문 04 (§8, required test file) — dedicated focus test for
 * per-role K-pop language policy ("영어 비중이 높아도 한국어 핵심 정서와
 * title/hook 연결이 있으면 통과 가능" — role-aware, not one flat floor).
 * Real reuse of core/lyricMetrics.ts's own measureLyricLanguageRatios.
 */
describe('[codex 지시문 04 §8] checkKpopLanguageRole — real per-role Hangul floor', () => {
  it('rap-heavy has a real, honestly LOWER floor than a plain vocal-track', () => {
    expect(KR_IDOL_MALE_POLICY.languageProfiles['rap-heavy'].minHangulRatio)
      .toBeLessThan(KR_IDOL_MALE_POLICY.languageProfiles['vocal-track'].minHangulRatio);
  });

  it('bilingual-hook has the lowest floor of all 4 roles (English-heavy hook is expected)', () => {
    const floors = Object.values(KR_IDOL_MALE_POLICY.languageProfiles).map(p => p.minHangulRatio);
    expect(KR_IDOL_MALE_POLICY.languageProfiles['bilingual-hook'].minHangulRatio).toBe(Math.min(...floors));
  });

  it('a real, mostly-Korean vocal-track lyric passes its own (higher) floor', () => {
    const lyrics = '오늘 밤 우리는 빛나는 무대 위에서 함께 노래해 이 순간을 잊지 마';
    const check = checkKrIdolMaleLanguageRole(lyrics, 'vocal-track');
    expect(check.ok).toBe(true);
  });

  it('the SAME English-heavy lyric fails vocal-track\'s floor but passes rap-heavy\'s lower floor', () => {
    const englishHeavy = 'Yeah we run tonight, we blaze so bright 우리 함께 빛나는 이 밤을 날아가자 다시 만나자';
    const asVocalTrack = checkKrIdolMaleLanguageRole(englishHeavy, 'vocal-track');
    const asRapHeavy = checkKrIdolMaleLanguageRole(englishHeavy, 'rap-heavy');
    expect(asVocalTrack.ok).toBe(false);
    expect(asRapHeavy.ok).toBe(true);
  });

  it('kr-idol-female applies the identical real per-role table (workspace-symmetric, gender-independent)', () => {
    const lyrics = '오늘 밤 우리는 빛나는 무대 위에서 함께 노래해 이 순간을 잊지 마';
    expect(checkKrIdolFemaleLanguageRole(lyrics, 'vocal-track').minRequired)
      .toBe(checkKrIdolMaleLanguageRole(lyrics, 'vocal-track').minRequired);
  });
});
