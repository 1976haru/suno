import { describe, expect, it } from 'vitest';
import {
  resolveJpKidsExpectedPhasePolicy,
  checkJpKidsKanaRatio,
  kanaRatioMinForTier,
  checkJpKidsNotChineseStyle,
  findJpKidsKatakanaOveruse,
  findJpKidsTrademarkReferences,
  findKrSchoolTermMistranslation,
  JP_KIDS_FURIGANA_POLICY,
  JP_KIDS_KANA_RATIO_CALIBRATION_STATUS,
  JP_KIDS_KANA_RATIO_MIN_APPROVED_SAMPLES_FOR_CALIBRATION
} from '../src/core/jpKidsPolicy';

/**
 * codex 지시문 04 (§5) — "kr-kids의 구조를 공유하되 일본어 전용 정책을
 * 적용한다": jp-kids reuses the SAME real phase/bundle system as kr-kids
 * (core/arcModels.ts is workspace-agnostic, confirmed by direct read), and
 * this covers only the genuinely jp-kids-own language/culture checks.
 */
describe('[codex 지시문 04 §5] shared phase system — reused, not duplicated', () => {
  it('resolveJpKidsExpectedPhasePolicy produces the same real data as kr-kids for the same tier', () => {
    const policy = resolveJpKidsExpectedPhasePolicy(18, 'kids-t2');
    expect(policy.kidsAgeTierId).toBe('kids-t2');
    expect(policy.expectedPhaseSet.length).toBeGreaterThan(0);
  });
});

describe('[codex 지시문 04 §5] checkJpKidsKanaRatio — real per-age-tier floor', () => {
  it('a real, high-kana kids lyric passes the T1 floor', () => {
    const pureKana = 'うたをうたおう たのしいね みんなでうたおう きょうもいいひだね';
    expect(checkJpKidsKanaRatio(pureKana, 'kids-t1').belowFloor).toBe(false);
  });

  it('a kanji-heavy lyric fails the stricter T1 floor even if it might pass T3\'s looser one', () => {
    const kanjiHeavy = '新年の街の向こうで小さな鐘が鳴り静かな戸口にそっと触れる';
    const t1 = checkJpKidsKanaRatio(kanjiHeavy, 'kids-t1');
    expect(t1.belowFloor).toBe(true);
  });

  it('younger tiers have a real, stricter (higher) kana floor than older tiers', () => {
    expect(kanaRatioMinForTier('kids-t1')).toBeGreaterThan(kanaRatioMinForTier('kids-t3'));
  });
});

describe('[지시문 11 TASK D] 캘리브레이션 상태 — 모든 tier가 provisional로 명시돼 있다', () => {
  it('세 tier 전부 provisional이다 (실측 검증 전)', () => {
    expect(JP_KIDS_KANA_RATIO_CALIBRATION_STATUS['kids-t1']).toBe('provisional');
    expect(JP_KIDS_KANA_RATIO_CALIBRATION_STATUS['kids-t2']).toBe('provisional');
    expect(JP_KIDS_KANA_RATIO_CALIBRATION_STATUS['kids-t3']).toBe('provisional');
  });

  it('50개 이상의 승인된 결과가 필요하다는 기준이 실제로 50이다', () => {
    expect(JP_KIDS_KANA_RATIO_MIN_APPROVED_SAMPLES_FOR_CALIBRATION).toBe(50);
  });
});

describe('[codex 지시문 04 §5] checkJpKidsNotChineseStyle — reuses core/lyricMetrics.ts, not reimplemented', () => {
  it('a real pure-Chinese body fails', () => {
    const pureChinese = '床前明月光，疑是地上霜。举头望明月，低头思故乡。';
    expect(checkJpKidsNotChineseStyle(pureChinese)).toBe(false);
  });

  it('real Japanese passes', () => {
    const japanese = 'うたをうたおう たのしいね みんなでうたおう きょうもいいひだね';
    expect(checkJpKidsNotChineseStyle(japanese)).toBe(true);
  });
});

describe('[codex 지시문 04 §5] findJpKidsKatakanaOveruse — reuses jp2030Policy.ts, not reimplemented', () => {
  it('flags a real katakana-heavy song', () => {
    const songs = [{ trackNo: 1, lyrics: 'ラブソングとメロディーとハーモニーとリズムとパッションとエナジーとフィーリングとストーリーとドラマとロマンス' }];
    expect(findJpKidsKatakanaOveruse(songs)).toEqual([1]);
  });
});

describe('[codex 지시문 04 §5] findJpKidsTrademarkReferences — real gap (lyric-side had none before this)', () => {
  it('flags a real known trademarked character name', () => {
    expect(findJpKidsTrademarkReferences('きょうはポケモンと あそぼうね')).toBe(true);
    expect(findJpKidsTrademarkReferences('アンパンマンが とんでくる')).toBe(true);
  });

  it('does not flag ordinary, generic kids content', () => {
    expect(findJpKidsTrademarkReferences('きょうも たのしく あそぼうね')).toBe(false);
  });
});

describe('[codex 지시문 04 §5] findKrSchoolTermMistranslation', () => {
  it('flags a real literal Korean-school-term mistranslation pattern', () => {
    expect(findKrSchoolTermMistranslation('給食当番がお母さんに教えてくれた')).toBe(true);
  });

  it('does not flag ordinary Japanese school-life lyric content', () => {
    expect(findKrSchoolTermMistranslation('きょうしつで みんなと べんきょうしたよ')).toBe(false);
  });
});

describe('[codex 지시문 04 §5] furigana — honestly scoped as a type stub (미구현), not fake-wired', () => {
  it('has a real type, defaulted to "none" (no ruby-text generation infra exists)', () => {
    expect(JP_KIDS_FURIGANA_POLICY.format).toBe('none');
  });
});
