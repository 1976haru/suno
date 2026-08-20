import { describe, expect, it } from 'vitest';
import {
  firstInstrumentPosition,
  vocalDescriptorClauseCount,
  INSTRUMENT_POSITION_MAX_CHARS,
  VOCAL_DESCRIPTOR_MIN,
  VOCAL_DESCRIPTOR_MAX
} from '../src/core/promptElementOrder';
import { runGenreFidelityCheck } from '../src/core/genreFidelity';

/**
 * 지시문 59 (TASK D) — §1-3의 실제 GOOD/BAD 예문(8/13 카페 세트 스타일 vs
 * 8/14 명품발라드 세트 스타일)을 그대로 재사용한다. GOOD 쪽은 genreLibrary의
 * 실제 장르 앵커(genre.label, 지시문 58 enforceGenreOpensPrompt가 붙이는
 * 형태)를 앞에 붙여 정규화 "이후" 텍스트를 흉내낸다 — 그래야 이 파일이
 * 다루는 ④/⑤(악기 위치·보컬 개수)만 검증하고 ①(58의 장르-첫자리)과
 * 섞이지 않는다.
 */
const GOOD_STYLE_PROMPT =
  'British Beat Pop, early-1960s British beat pop, 74 BPM, jangly 12-string electric guitar, melodic walking bass, tambourine backbeat, brushed drum kit, I-V-vi-IV progression, low calm male baritone, restrained emotional delivery';

const BAD_STYLE_PROMPT =
  'late-1950s memory through a 1970s piano pop ballad lens, 66 BPM, soulful female voice, restrained understated reading, warm rounded midrange, intimate close-mic, gospel-inflected melisma, singing starts immediately with no intro tag, full playback level from first bar, grand piano, warm bass';

describe('지시문 59 (TASK D) — firstInstrumentPosition', () => {
  it('8/13 스타일(GOOD): 장르 핵심 악기가 100자 이내에 등장한다', () => {
    const position = firstInstrumentPosition('oldpop-british-beat', GOOD_STYLE_PROMPT);
    expect(position).not.toBeNull();
    expect(position!).toBeLessThanOrEqual(INSTRUMENT_POSITION_MAX_CHARS);
  });

  it('8/14 스타일(BAD): 장르 핵심 악기가 100자를 훌쩍 넘겨(실측 220자대) 등장한다', () => {
    const position = firstInstrumentPosition('oldpop-piano-ballad-70s', BAD_STYLE_PROMPT);
    expect(position).not.toBeNull();
    expect(position!).toBeGreaterThan(INSTRUMENT_POSITION_MAX_CHARS);
  });

  it('genreId가 없으면 측정 불가(null) — 위반으로 세지 않는다', () => {
    expect(firstInstrumentPosition(undefined, GOOD_STYLE_PROMPT)).toBeNull();
  });

  it('genre.instruments 중 어느 것도 stylePrompt에 없으면 측정 불가(null)', () => {
    expect(firstInstrumentPosition('oldpop-british-beat', 'British Beat Pop, 74 BPM, no matching words here')).toBeNull();
  });
});

describe('지시문 59 (TASK D) — vocalDescriptorClauseCount', () => {
  it('8/13 스타일(GOOD): 보컬 서술이 2개 연속으로 끝난다', () => {
    expect(vocalDescriptorClauseCount(GOOD_STYLE_PROMPT)).toBe(2);
  });

  it('8/14 스타일(BAD): 보컬 서술이 5개 연속으로 이어진다', () => {
    expect(vocalDescriptorClauseCount(BAD_STYLE_PROMPT)).toBe(5);
  });

  it('보컬 신호(성별/음역대 단어)가 전혀 없으면 측정 불가(null)', () => {
    expect(vocalDescriptorClauseCount('British Beat Pop, 74 BPM, jangly guitar, walking bass')).toBeNull();
  });
});

describe('지시문 59 (TASK D) — runGenreFidelityCheck ④/⑤ (8/13 통과 · 8/14 미달)', () => {
  it('8/13 스타일 팩은 ④(악기 위치)·⑤(보컬 개수) 둘 다 통과한다', () => {
    const report = runGenreFidelityCheck([{ trackNo: 1, genreId: 'oldpop-british-beat', stylePrompt: GOOD_STYLE_PROMPT }]);
    expect(report.instrumentPosition.failedTrackNos).toEqual([]);
    expect(report.vocalDescriptorCount.failedTrackNos).toEqual([]);
  });

  it('8/14 스타일 팩은 ④(악기 위치)에서 미달로 잡힌다', () => {
    const report = runGenreFidelityCheck([{ trackNo: 1, genreId: 'oldpop-piano-ballad-70s', stylePrompt: BAD_STYLE_PROMPT }]);
    expect(report.instrumentPosition.failedTrackNos).toEqual([1]);
  });

  it('8/14 스타일 팩은 ⑤(보컬 개수, 5개 > 3개)에서도 미달로 잡힌다', () => {
    const report = runGenreFidelityCheck([{ trackNo: 1, genreId: 'oldpop-piano-ballad-70s', stylePrompt: BAD_STYLE_PROMPT }]);
    expect(report.vocalDescriptorCount.failedTrackNos).toEqual([1]);
  });

  it('정책 상수 자체가 실측값과 일치한다 (2~3개, 100자)', () => {
    expect(VOCAL_DESCRIPTOR_MIN).toBe(2);
    expect(VOCAL_DESCRIPTOR_MAX).toBe(3);
    expect(INSTRUMENT_POSITION_MAX_CHARS).toBe(100);
  });
});
