/**
 * 지시문 11 (TASK B) — kr-kids/jp-kids "서사 결말 안전성". 실제 신고된 증상
 * (챗지피티 지시문 09 TASK 4에서 최초 신고, 코덱스 지시문 03에서 명시적으로
 * 미구현으로 신고됨 — src/data/goldenCases.ts의 'kids-outcome' 케이스):
 * 아이 대상 가사의 서사가 위험한 행동을 보상하거나, 공포·위협 상태로
 * 끝나거나, 안전 규칙 무시를 칭찬하는 방향으로 종결될 위험이 체계적으로
 * 점검되지 않았다.
 *
 * relationshipContinuity.ts와 같은 좁은 범위 원칙: 완전한 서사 이해가 아니라
 * 지시문이 이름 붙인 4가지 결말 패턴만 키워드 기반으로 감지한다 —
 * unsafe-reward(위험 행동 보상), fear-ending(공포로 종결),
 * bullying-wins(괴롭힘이 해결 없이 성공), rule-violation-praised(안전 규칙
 * 위반이 칭찬됨). 교정/안전 표지(안전하게 배웠다·다치고 나서 조심하게
 * 됐다·엄마가 꼭 안아줬다 등)가 함께 있으면 서사가 위험을 정당화하지 않은
 * 것으로 보고 차단하지 않는다.
 *
 * 이 모듈이 하지 않는 것: 완전한 서사 이해, 은유 판별, 한국어/일본어 외
 * 언어. 이 자동 체크는 지시문이 별도로 요구하는 "kr-kids/jp-kids 첫 세트
 * 사람 검수"를 대체하지 않는다 — 그건 코드로 자동화할 수 없는 별개의 실제
 * 사람 작업이다(이 모듈의 doc comment에서 정직하게 명시).
 */

import { parseLyricsSections } from './lyricsAst';

export type KidsOutcomeIssueId = 'unsafe-reward' | 'fear-ending' | 'bullying-wins' | 'rule-violation-praised';

export interface KidsOutcomeIssue {
  id: KidsOutcomeIssueId;
  labelKo: string;
}

interface Keywords {
  korean: string[];
  japanese: string[];
}

const UNSAFE_ACTION_KEYWORDS: Keywords = {
  korean: ['불을 가지고 놀았', '혼자 길을 건넜', '모르는 사람을 따라갔', '높은 곳에 올라갔', '뜨거운 걸 만졌', '위험한 곳에 들어갔'],
  japanese: ['火で遊んだ', '一人で道を渡った', '知らない人について行った', '高い所に登った', '熱い物を触った']
};

const RULE_VIOLATION_KEYWORDS: Keywords = {
  korean: ['안전벨트를 안 맸', '헬멧 없이 탔', '빨간불에 건넜', '규칙을 어겼'],
  japanese: ['シートベルトをしなかった', 'ヘルメットなしで乗った', '赤信号で渡った', 'ルールを破った']
};

const PRAISE_REWARD_KEYWORDS: Keywords = {
  korean: ['잘했어', '최고야', '상을 받았', '칭찬받았', '멋져'],
  japanese: ['よくやった', '最高だ', '賞をもらった', '褒められた', 'すごいね']
};

const CORRECTIVE_MARKERS: Keywords = {
  korean: ['안전하게 배웠', '다치고 나서 조심', '다시는 그러지 않기로', '위험하다는 걸 알았', '조심하기로 했', '어른한테 혼났'],
  japanese: ['安全に学んだ', 'けがをして気をつける', 'もう二度としないと', '危ないと分かった', '気をつけることにした']
};

const FEAR_KEYWORDS: Keywords = {
  korean: ['무서운 어둠 속에', '괴물이 쫓아왔', '갇혀서 무서웠', '너무 무서웠어'],
  japanese: ['怖い暗闇の中', '怪物が追いかけてきた', '閉じ込められて怖かった', 'とても怖かった']
};

const COMFORT_RESOLUTION_KEYWORDS: Keywords = {
  korean: ['괜찮아졌', '엄마가 꼭 안아줬', '이제 안전해', '잠에서 깨어나니', '무섭지 않게 됐'],
  japanese: ['大丈夫になった', 'お母さんが抱きしめてくれた', 'もう安全だ', '目が覚めたら', '怖くなくなった']
};

const BULLYING_KEYWORDS: Keywords = {
  korean: ['놀렸다', '괴롭혔다', '따돌렸다', '못생겼다고 놀렸'],
  japanese: ['からかった', 'いじめた', '仲間はずれにした']
};

const BULLYING_RESOLUTION_KEYWORDS: Keywords = {
  korean: ['미안하다고 했', '친구가 됐', '선생님이 도와줬', '사과했'],
  japanese: ['ごめんと言った', '友達になった', '先生が助けてくれた', '謝った']
};

function textContainsAny(text: string, keywords: string[]): boolean {
  return keywords.some(keyword => text.includes(keyword));
}

/**
 * "결말" — 마지막 실제 가사 섹션의 줄들. 노래 전체가 아니라 정말 끝나는
 * 지점만 봐야 fear-ending의 "공포로 종결"이라는 정의에 맞다(중간에 무서운
 * 장면이 나왔다가 안전하게 해소되는 건 정상적인 동요 서사 장치).
 */
function lastSectionText(lyrics: string): string {
  const sections = parseLyricsSections(lyrics).filter(s => s.lines.length > 0);
  const last = sections[sections.length - 1];
  return last ? last.lines.join('\n') : '';
}

export function checkKidsOutcome(lyrics: string, language: 'korean' | 'japanese'): KidsOutcomeIssue[] {
  const issues: KidsOutcomeIssue[] = [];
  const hasCorrective = textContainsAny(lyrics, CORRECTIVE_MARKERS[language]);

  if (!hasCorrective) {
    if (textContainsAny(lyrics, UNSAFE_ACTION_KEYWORDS[language]) && textContainsAny(lyrics, PRAISE_REWARD_KEYWORDS[language])) {
      issues.push({ id: 'unsafe-reward', labelKo: '위험한 행동을 한 뒤 교정 없이 칭찬·보상하는 서사입니다.' });
    }
    if (textContainsAny(lyrics, RULE_VIOLATION_KEYWORDS[language]) && textContainsAny(lyrics, PRAISE_REWARD_KEYWORDS[language])) {
      issues.push({ id: 'rule-violation-praised', labelKo: '안전 규칙 위반을 교정 없이 칭찬하는 서사입니다.' });
    }
  }

  const ending = lastSectionText(lyrics);
  if (textContainsAny(ending, FEAR_KEYWORDS[language]) && !textContainsAny(ending, COMFORT_RESOLUTION_KEYWORDS[language])) {
    issues.push({ id: 'fear-ending', labelKo: '노래가 공포·위협 상태로 끝나고 안심되는 결말이 없습니다.' });
  }

  if (textContainsAny(lyrics, BULLYING_KEYWORDS[language]) && !textContainsAny(lyrics, BULLYING_RESOLUTION_KEYWORDS[language])) {
    issues.push({ id: 'bullying-wins', labelKo: '괴롭힘 장면이 해결·사과 없이 그대로 끝나는 서사입니다.' });
  }

  return issues;
}
