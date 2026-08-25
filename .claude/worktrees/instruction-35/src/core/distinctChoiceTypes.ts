/**
 * 지시문 15 (TASK A) — distinctChoice를 자유 문자열에서 구조화된 규칙으로.
 * 지시문 12의 eraBuckets/eraNoteKo와 같은 패턴이다: 사람이 읽는 문장
 * (descriptionKo)과 기계가 판정하는 값(ruleId)을 분리한다.
 *
 * §1-5의 근본 원인 그대로다 — "자유 문자열이라 기계가 이행을 판정할 수
 * 없다. eraTag 가 자유 문자열이라 시대 관문이 무너졌던 것과 정확히 같은
 * 구조다." ruleId는 워크스페이스 정책(DistinctChoicePolicy.allowedRuleIds,
 * core/workspaceQualityPolicies.ts)이 허용 목록을 정하고, 브릿지는 그
 * 목록 중에서만 고른다 — 자유 작문이 아니다.
 *
 * verifiability 3분류가 이 지시문의 핵심 설계다:
 *  - lyrics-ast   가사 텍스트에서 실제로 검증 가능 (core/lyricsAst.ts의
 *                 LyricsSection[]을 읽는다)
 *  - prompt-only  가사에는 흔적이 없고 stylePrompt 자기모순만 검증 가능
 *                 (예: NO_INTRO인데 stylePrompt에 "short intro"가 있으면 모순)
 *  - not-measured 편곡 지시라 텍스트 어디에도 흔적이 남지 않는다 — 미구현이
 *                 아니라 검증 불가다. blocking하지 않고 pass로도 세지 않는다.
 */

import type { DistinctChoiceRuleId, DistinctChoiceVerifiability } from '../types';

export type { DistinctChoiceRuleId, DistinctChoiceVerifiability };

/** ruleId → verifiability는 고정 매핑이다(규칙 자체의 성질이지 곡마다 다르지 않다). */
export const DISTINCT_CHOICE_VERIFIABILITY: Record<DistinctChoiceRuleId, DistinctChoiceVerifiability> = {
  NO_CHORUS: 'lyrics-ast',
  FINAL_QUESTION: 'lyrics-ast',
  VOCAL_TOGETHER: 'lyrics-ast',
  VERSE2_HALF_LENGTH: 'lyrics-ast',
  VERSE_TAIL_REPEAT: 'lyrics-ast',
  WORD_ACCUMULATION: 'lyrics-ast',
  SCENE_PER_VERSE: 'lyrics-ast',
  HOOK_LAST_WORD_SHIFT: 'lyrics-ast',
  SINGLE_CHORUS: 'lyrics-ast',
  CALL_AND_RESPONSE: 'lyrics-ast',
  NO_INTRO: 'prompt-only',
  KEY_LIFT: 'prompt-only',
  OCTAVE_DOWN_CHORUS: 'prompt-only',
  MODE_SHIFT: 'prompt-only',
  ARRANGEMENT_NUANCE: 'not-measured'
};

export const ALL_DISTINCT_CHOICE_RULE_IDS: DistinctChoiceRuleId[] = Object.keys(DISTINCT_CHOICE_VERIFIABILITY) as DistinctChoiceRuleId[];

/** 사람이 읽는 규칙 설명 — 브릿지 안내문·UI 표시용. 판정에는 절대 쓰지 않는다(ruleId만 쓴다). */
export const DISTINCT_CHOICE_RULE_LABEL_KO: Record<DistinctChoiceRuleId, string> = {
  NO_CHORUS: '후렴 없이 진행 (chorus 계열 섹션 0개)',
  FINAL_QUESTION: '마지막 줄이 물음표로 끝남',
  VOCAL_TOGETHER: '교대 없이 두 목소리가 동일 가사를 함께 부름',
  VERSE2_HALF_LENGTH: '2절이 1절의 40~60% 길이로 압축됨',
  VERSE_TAIL_REPEAT: '지정 문구가 각 절 끝줄에 변형 반복됨',
  WORD_ACCUMULATION: '지정 어휘군이 절마다 하나씩 추가됨',
  SCENE_PER_VERSE: '절마다 장소(장면)가 바뀜',
  HOOK_LAST_WORD_SHIFT: '후렴 반복 시 마지막 단어가 바뀜',
  SINGLE_CHORUS: 'chorus를 세트 전체에서 한 번만 부름',
  CALL_AND_RESPONSE: '한 줄씩 주고받는 콜앤리스폰스 구조',
  NO_INTRO: '인트로 없이 바로 시작 (introMode가 정확히 none)',
  KEY_LIFT: '전조(key change)가 정확히 한 번 지시됨',
  OCTAVE_DOWN_CHORUS: '후렴이 한 옥타브 낮게 지시됨',
  MODE_SHIFT: '단조에서 장조로 전환',
  ARRANGEMENT_NUANCE: '편곡 뉘앙스 — 가사·프롬프트 텍스트로 검증 불가(무반주 아웃트로, 박자 정지 등)'
};

/**
 * 지시문 15 (TASK A-1) — 브릿지가 실제로 채우는 구조체. descriptionKo는
 * 사람이 읽는 한 줄 설명이며 판정에 쓰지 않는다. params는 VERSE_TAIL_REPEAT
 * (예: {phrase: "no rush"}) · WORD_ACCUMULATION 등 규칙이 인자를 요구할
 * 때만 채운다.
 */
export interface DistinctChoice {
  ruleId: DistinctChoiceRuleId;
  verifiability: DistinctChoiceVerifiability;
  descriptionKo: string;
  params?: Record<string, string | number>;
}

/**
 * 지시문 15 (TASK A-2) — 하위호환: 기존(v5.23~) 자유 문자열 응답이나
 * ruleId를 인식할 수 없는 값은 ARRANGEMENT_NUANCE + not-measured로
 * 받아들인다(거부하지 않는다). descriptionKo는 원문 그대로 보존한다.
 */
export function coerceDistinctChoice(raw: unknown): DistinctChoice | undefined {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const ruleId = typeof obj.ruleId === 'string' && ALL_DISTINCT_CHOICE_RULE_IDS.includes(obj.ruleId as DistinctChoiceRuleId)
      ? (obj.ruleId as DistinctChoiceRuleId)
      : 'ARRANGEMENT_NUANCE';
    const descriptionKo = typeof obj.descriptionKo === 'string' ? obj.descriptionKo.trim() : '';
    if (!descriptionKo) return undefined;
    const params = obj.params && typeof obj.params === 'object' ? (obj.params as Record<string, string | number>) : undefined;
    return { ruleId, verifiability: DISTINCT_CHOICE_VERIFIABILITY[ruleId], descriptionKo, ...(params ? { params } : {}) };
  }
  if (typeof raw === 'string' && raw.trim()) {
    // 구형 자유 문자열 응답 — 거부하지 않고 ARRANGEMENT_NUANCE/not-measured로 수용.
    return { ruleId: 'ARRANGEMENT_NUANCE', verifiability: 'not-measured', descriptionKo: raw.trim() };
  }
  return undefined;
}
