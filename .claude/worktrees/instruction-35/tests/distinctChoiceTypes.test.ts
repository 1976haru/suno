import { describe, expect, it } from 'vitest';
import { coerceDistinctChoice, ALL_DISTINCT_CHOICE_RULE_IDS, DISTINCT_CHOICE_VERIFIABILITY, DISTINCT_CHOICE_RULE_LABEL_KO } from '../src/core/distinctChoiceTypes';

/**
 * 지시문 15 (TASK A) — distinctChoice 구조화의 완료 판정 테스트.
 */
describe('[지시문 15 TASK A] DistinctChoiceRuleId 카탈로그', () => {
  it('14종 이상 등록됐다', () => {
    expect(ALL_DISTINCT_CHOICE_RULE_IDS.length).toBeGreaterThanOrEqual(14);
  });

  it('모든 ruleId에 verifiability와 한국어 라벨이 있다', () => {
    for (const ruleId of ALL_DISTINCT_CHOICE_RULE_IDS) {
      expect(DISTINCT_CHOICE_VERIFIABILITY[ruleId]).toBeDefined();
      expect(DISTINCT_CHOICE_RULE_LABEL_KO[ruleId]).toBeDefined();
    }
  });

  it('ARRANGEMENT_NUANCE만 not-measured다 (나머지는 lyrics-ast 또는 prompt-only)', () => {
    const notMeasured = ALL_DISTINCT_CHOICE_RULE_IDS.filter(id => DISTINCT_CHOICE_VERIFIABILITY[id] === 'not-measured');
    expect(notMeasured).toEqual(['ARRANGEMENT_NUANCE']);
  });
});

describe('[지시문 15 TASK A-2] coerceDistinctChoice — 하위호환 파서', () => {
  it('신형 구조체({ruleId, descriptionKo})를 그대로 받아들인다', () => {
    const result = coerceDistinctChoice({ ruleId: 'NO_CHORUS', descriptionKo: '후렴 없이 진행' });
    expect(result).toEqual({ ruleId: 'NO_CHORUS', verifiability: 'lyrics-ast', descriptionKo: '후렴 없이 진행' });
  });

  it('params가 있으면 함께 보존한다', () => {
    const result = coerceDistinctChoice({ ruleId: 'VERSE_TAIL_REPEAT', descriptionKo: '반복 문구', params: { phrase: 'no rush' } });
    expect(result?.params).toEqual({ phrase: 'no rush' });
  });

  it('구형 자유 문자열 응답을 거부하지 않고 ARRANGEMENT_NUANCE/not-measured로 받아들인다', () => {
    const result = coerceDistinctChoice('후렴을 한 번만 부른다');
    expect(result).toEqual({ ruleId: 'ARRANGEMENT_NUANCE', verifiability: 'not-measured', descriptionKo: '후렴을 한 번만 부른다' });
  });

  it('인식 불가 ruleId 문자열도 거부하지 않고 ARRANGEMENT_NUANCE로 받아들인다', () => {
    const result = coerceDistinctChoice({ ruleId: 'SOME_UNKNOWN_RULE', descriptionKo: '설명' });
    expect(result?.ruleId).toBe('ARRANGEMENT_NUANCE');
    expect(result?.verifiability).toBe('not-measured');
  });

  it('빈 문자열/undefined/null은 undefined를 반환한다', () => {
    expect(coerceDistinctChoice(undefined)).toBeUndefined();
    expect(coerceDistinctChoice('')).toBeUndefined();
    expect(coerceDistinctChoice('   ')).toBeUndefined();
    expect(coerceDistinctChoice(null)).toBeUndefined();
  });
});
