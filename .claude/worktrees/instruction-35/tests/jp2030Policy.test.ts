import { describe, expect, it } from 'vitest';
import {
  katakanaShareOfKana,
  findKatakanaOveruse,
  checkJp2030ModernMotifQuotas,
  checkJp2030TitleSuffixOveruse,
  checkJp2030Translationese,
  JP_2030_KATAKANA_OVERUSE_THRESHOLD
} from '../src/core/jp2030Policy';
import { resolveBilingualPair } from '../src/core/localGenerator';
import { checkLyricLanguageMatch } from '../src/core/lyricMetrics';
import { channelPresets } from './fixtures';

/**
 * codex 지시문 04 (§3) — real, dedicated jp-2030 policy adapter. katakana
 * overuse is a real gap (core/bilingualLint.ts's own katakana check is
 * scoped to bilingual English-word-learning content only); title-suffix
 * overuse is real (data/titlePatterns.ts only ever applies to English
 * titles); kana-minimum/pure-Chinese-blocking and 직역체 are reused, not
 * reimplemented (core/lyricMetrics.ts/core/languageQuality.ts).
 */
describe('[codex 지시문 04 §3] katakanaShareOfKana / findKatakanaOveruse', () => {
  it('measures a real high katakana share correctly', () => {
    // Heavy katakana loanword lyric.
    const heavy = 'ラブソングとメロディーとハーモニーとリズムとパッションとエナジーとフィーリングとストーリーとドラマとロマンス';
    expect(katakanaShareOfKana(heavy)).toBeGreaterThan(JP_2030_KATAKANA_OVERUSE_THRESHOLD);
  });

  it('measures a real hiragana-dominant lyric as low katakana share', () => {
    const natural = 'こんにちは 今日もいい天気ですね いっしょに あるいていこう';
    expect(katakanaShareOfKana(natural)).toBeLessThan(JP_2030_KATAKANA_OVERUSE_THRESHOLD);
  });

  it('flags a real song with katakana overuse', () => {
    const songs = [{ trackNo: 1, lyrics: 'ラブソングとメロディーとハーモニーとリズムとパッションとエナジーとフィーリングとストーリーとドラマとロマンス' }];
    expect(findKatakanaOveruse(songs)).toEqual([1]);
  });

  it('does not flag a natural, hiragana-forward lyric', () => {
    const songs = [{ trackNo: 1, lyrics: 'こんにちは 今日もいい天気ですね いっしょに あるいていこう みんなでうたおう' }];
    expect(findKatakanaOveruse(songs)).toEqual([]);
  });

  it('never false-positives on a near-empty/short lyric with too little kana to measure meaningfully', () => {
    expect(findKatakanaOveruse([{ trackNo: 1, lyrics: 'キー' }])).toEqual([]);
  });
});

describe('[codex 지시문 04 §3] checkJp2030ModernMotifQuotas', () => {
  it('flags a real motif overuse (convenience store, cap 2)', () => {
    const songs = [
      { trackNo: 1, lyrics: 'x', listenerSituation: '深夜のコンビニで' },
      { trackNo: 2, lyrics: 'x', listenerSituation: 'コンビニの明かりが' },
      { trackNo: 3, lyrics: 'x', listenerSituation: '一人でコンビニに寄る' }
    ];
    const findings = checkJp2030ModernMotifQuotas(songs);
    expect(findings.some(f => f.familyId === 'convenience-store')).toBe(true);
  });
});

describe('[codex 지시문 04 §3] checkJp2030TitleSuffixOveruse', () => {
  it('flags real title-suffix overuse ("〜の夜", cap 2)', () => {
    const songs = [
      { trackNo: 1, title: '街の夜' },
      { trackNo: 2, title: '恋の夜' },
      { trackNo: 3, title: '君との夜' }
    ];
    const findings = checkJp2030TitleSuffixOveruse(songs);
    expect(findings.some(f => f.familyId === 'title-no-yoru')).toBe(true);
  });

  it('does not flag varied, natural title shapes', () => {
    const songs = [
      { trackNo: 1, title: '街の夜' },
      { trackNo: 2, title: '青い春' },
      { trackNo: 3, title: 'また明日' }
    ];
    expect(checkJp2030TitleSuffixOveruse(songs)).toHaveLength(0);
  });
});

describe('[codex 지시문 04 §3] checkJp2030Translationese — reuses 지시문 03 TASK J, not reimplemented', () => {
  it('flags a real 直訳体 line', () => {
    const songs = [{ trackNo: 1, lyrics: 'この歌はあなたによって作られた' }];
    expect(checkJp2030Translationese(songs).length).toBeGreaterThan(0);
  });
});

describe('[codex 지시문 04 §3] kana-minimum / pure-Chinese-blocking (already real, reused not reimplemented)', () => {
  it('a real pure-Chinese body still correctly fails the existing japanese language check', () => {
    const pureChinese = '床前明月光，疑是地上霜。举头望明月，低头思故乡。';
    const check = checkLyricLanguageMatch(pureChinese, 'japanese');
    expect(check?.ok).toBe(false);
  });
});

describe('[codex 지시문 04 §3] bilingualPair defaults to en-ja (already real, 지시문 02 TASK F)', () => {
  it('jp-2030-pop resolves to en-ja', () => {
    const channel = channelPresets.find(c => c.archetype === 'jp-2030-pop')!;
    expect(resolveBilingualPair({ channel })).toBe('en-ja');
  });
});
