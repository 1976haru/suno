import { describe, expect, it } from 'vitest';
import { evaluateDistinctChoiceGate } from '../src/core/distinctChoiceGate';
import { distinctChoicePolicyForWorkspace, safetyForbiddenRuleIdsForWorkspace } from '../src/data/distinctChoicePolicy';
import type { DistinctChoiceRuleId, SongIdea } from '../src/types';
import pack from './fixtures/distinctChoice20260808Pack.json';

/**
 * 지시문 15 (TASK E-2 §4, 인수 기준) — "제가 손으로 잰 5건을 게이트가 그대로
 * 재현해야 한다. 재현하지 못하면 게이트가 관대한 것이다."
 *
 * 20260808 실제 oldpoplounge 팩(18곡, tests/fixtures/distinctChoice20260808Pack.json —
 * lyrics/ 폴더의 실제 파일을 그대로 복사)을 fixture로 쓴다. 이 팩은 이
 * 기능이 생기기 전에 만들어졌으므로 distinctChoiceRuleId가 없다 — §1의
 * 수작업 분석(자유 문자열 distinctChoice가 실제로 주장한 규칙)에 따라
 * 각 트랙에 ruleId를 부여해 "만약 브릿지가 구조화된 응답을 냈다면"을
 * 재현한다. descriptionKo는 원문 그대로 보존한다(판정에 쓰지 않는다는
 * 원칙 확인용).
 */

const RULE_BY_TRACK: Record<number, DistinctChoiceRuleId> = {
  1: 'NO_INTRO', // "인트로 없이 노래가 바로 시작된다"
  2: 'ARRANGEMENT_NUANCE', // "마지막 훅이 반주 없이 목소리만 남고 끝난다" — 편곡 지시, 검증 불가
  3: 'ARRANGEMENT_NUANCE', // "훅 전에 정확히 한 박자를 쉰다" — 편곡 지시, 검증 불가
  6: 'VERSE2_HALF_LENGTH', // "2절이 1절보다 짧다"
  8: 'FINAL_QUESTION', // "질문으로 끝난다"
  11: 'VOCAL_TOGETHER', // "두 목소리가 번갈아 부르지 않고 정확히 같은 가사를 함께 부른다"
  12: 'NO_CHORUS', // "후렴 없이 솔로 악기가 노래에 대답하듯..."
  14: 'VERSE_TAIL_REPEAT', // "'정해진 시간이 없다'가 후렴뿐 아니라 각 절 끝에도 반복된다"
  15: 'CALL_AND_RESPONSE' // "여러 목소리가 한 줄씩 겹치듯 주고받으며 진행된다"
};

interface RawPackSong {
  trackNo: number;
  lyrics: string;
  stylePrompt: string;
  distinctChoice?: string;
}

function buildSongs(): Pick<SongIdea, 'trackNo' | 'lyrics' | 'stylePrompt' | 'distinctChoice' | 'distinctChoiceRuleId' | 'distinctChoiceParams'>[] {
  const songs = (pack as { songs: RawPackSong[] }).songs;
  return songs.map(s => ({
    trackNo: s.trackNo,
    lyrics: s.lyrics,
    stylePrompt: s.stylePrompt,
    distinctChoice: s.distinctChoice,
    ...(RULE_BY_TRACK[s.trackNo] ? { distinctChoiceRuleId: RULE_BY_TRACK[s.trackNo] } : {})
  }));
}

describe('[지시문 15 TASK E §4] 20260808 실제 팩 재현 — 실측 5건 위반이 게이트에서 그대로 잡힌다', () => {
  const songs = buildSongs();
  const policy = distinctChoicePolicyForWorkspace('senior-oldpop');
  const result = evaluateDistinctChoiceGate(songs, policy, { safetyForbiddenRuleIds: safetyForbiddenRuleIdsForWorkspace('senior-oldpop') });
  const byTrack = new Map(result.trackResults.map(r => [r.trackNo, r]));

  it.each([
    [8, 'FINAL_QUESTION'],
    [11, 'VOCAL_TOGETHER'],
    [12, 'NO_CHORUS'],
    [14, 'VERSE_TAIL_REPEAT'],
    [15, 'CALL_AND_RESPONSE']
  ] as const)('T%i — 실측 위반이 재현된다 (%s)', (trackNo, ruleId) => {
    const r = byTrack.get(trackNo)!;
    expect(r.ruleId).toBe(ruleId);
    expect(r.status, `T${trackNo} reasonKo: ${r.reasonKo}`).toBe('violated');
  });

  it('T6 — 정상 구현(VERSE2_HALF_LENGTH)이 compliant로 나온다', () => {
    const r = byTrack.get(6)!;
    expect(r.status, r.reasonKo).toBe('compliant');
  });

  it('T2·T3 — 검증 불가(ARRANGEMENT_NUANCE)가 not-measured로 나오고 pass(compliant)로 세어지지 않는다', () => {
    for (const trackNo of [2, 3]) {
      const r = byTrack.get(trackNo)!;
      expect(r.status).toBe('not-measured');
      expect(r.status).not.toBe('compliant');
    }
    // not-measured는 이행률(complianceRate) 분모에도 분자에도 들어가지 않는다.
    expect(result.notMeasuredCount).toBeGreaterThanOrEqual(2);
  });

  it('T1 — stylePrompt 자기모순(NO_INTRO인데 intro texture·short intro 동시 존재)이 검출된다', () => {
    const r = byTrack.get(1)!;
    expect(r.ruleId).toBe('NO_INTRO');
    expect(r.status, r.reasonKo).toBe('violated');
    expect(r.reasonKo).toMatch(/intro texture|short intro/);
  });

  it('descriptionKo(원문 자유 문장)는 판정에 쓰이지 않는다 — reasonKo는 ruleId 기반 텍스트다', () => {
    const r = byTrack.get(12)!;
    expect(r.reasonKo).not.toContain('솔로 악기'); // 원문 한국어 설명 문구가 판정 근거 문자열에 섞이지 않는다
  });

  it('lyrics-ast 이행률(시니어 실측) — 8건 중 5위반/1정상/2not-measured', () => {
    // 이 fixture에서 lyrics-ast/prompt-only로 측정 가능한 트랙은 7개(T1,T6,T8,T11,T12,T14,T15)
    // + not-measured 2개(T2,T3) = 9개 중 나머지 9곡은 이 테스트가 ruleId를 부여하지 않았으므로 missing.
    const measured = result.trackResults.filter(r => r.status === 'compliant' || r.status === 'violated');
    expect(measured.length).toBe(7);
    expect(result.violatedCount).toBe(6); // T1(NO_INTRO) + T8,T11,T12,T14,T15
    expect(result.compliantCount).toBe(1); // T6
  });
});
