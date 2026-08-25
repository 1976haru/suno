/**
 * 지시문 11 (TASK A) — kr-2030/jp-2030 "관계 상태 연속성". 실제 신고된 증상
 * (챗지피티 지시문 09 TASK 3, 코덱스 지시문 03에서 명시적으로 미구현으로
 * 신고됨 — src/data/goldenCases.ts의 '2030-relation-break' 케이스): 한 곡
 * 안에서 관계 상태가 섹션 간 모순됐다. 예) 문자를 보내지 않았다고 해놓고
 * 답장을 받는 장면이 나오거나, 이별한 사이라고 해놓고 같은 시간선에서 첫
 * 만남을 묘사.
 *
 * 의도적으로 좁은 범위: 완전한 관계-상태-머신이나 의미 이해가 아니라, 이
 * 지시문이 실제로 이름 붙인 두 가지 명시적 모순 패턴만 키워드 기반으로
 * 감지한다 — "unsent -> reply", "ex -> same-timeline first meeting". 회상
 * 표지(flashback marker — "그때", "돌이켜보면", "あの日" 등)가 함께 있으면
 * 시간선이 갈린 것으로 보고 차단하지 않는다(지시문 자신의 "allow with
 * flashback markers" 명시 요구).
 *
 * 이 모듈이 하지 않는 것: 완전한 서사 이해, 은유/비유의 관계 상태 판별,
 * 한국어/일본어 외 언어. 키워드에 걸리지 않는 모순은 감지하지 못한다 —
 * 정직한 한계다.
 */

export type RelationshipMarker = 'unsent-message' | 'reply-received' | 'ex-relationship' | 'first-meeting';

export interface RelationshipContinuityIssue {
  id: string;
  labelKo: string;
  markers: [RelationshipMarker, RelationshipMarker];
}

interface MarkerKeywords {
  korean: string[];
  japanese: string[];
}

const MARKER_KEYWORDS: Record<RelationshipMarker, MarkerKeywords> = {
  'unsent-message': {
    korean: ['보내지 못한', '못 보낸 문자', '차마 보내지 못했', '전송하지 못한', '보내지 않은 문자', '지우고 만 문자'],
    japanese: ['送れなかった', '送信できなかった', '送らなかった手紙', '消してしまったメッセージ']
  },
  'reply-received': {
    korean: ['답장이 왔다', '답장을 받았다', '네게서 답이 왔다', '답장했어', '답문이 왔다'],
    japanese: ['返事が来た', '返信があった', '返事をもらった', '返信が届いた']
  },
  'ex-relationship': {
    korean: ['헤어진', '이별한', '전 연인', '헤어지고 나서', '이별 후', '헤어진 후'],
    japanese: ['別れた', '元恋人', '別れてから', '別れた後']
  },
  'first-meeting': {
    korean: ['처음 만난', '첫 만남', '처음 본 순간', '처음 마주친', '처음 널 본'],
    japanese: ['初めて会った', '出会った瞬間', '初対面', '初めて君を見た']
  }
};

/** 지시문 17 (TASK B) — core/narrativeState.ts의 ObjectState 회상 표지 판정이 이 목록을 그대로 재사용한다. "회상 표지 목록을 두 곳에 두지 않는다"는 그 지시문 자신의 요구 — export해서 공유한다, 복사하지 않는다. */
export const FLASHBACK_MARKERS_KOREAN = ['그때', '그날', '기억 속에', '추억 속에', '돌이켜보면', '회상하면', '떠올리면', '지난날'];
export const FLASHBACK_MARKERS_JAPANESE = ['あの日', 'あの頃', '思い出せば', '振り返れば', '記憶の中', '昔のこと'];

function textContainsAny(text: string, keywords: string[]): boolean {
  return keywords.some(keyword => text.includes(keyword));
}

function detectMarker(text: string, marker: RelationshipMarker, language: 'korean' | 'japanese'): boolean {
  const keywords = MARKER_KEYWORDS[marker][language];
  return textContainsAny(text, keywords);
}

function hasFlashbackMarker(text: string, language: 'korean' | 'japanese'): boolean {
  const markers = language === 'korean' ? FLASHBACK_MARKERS_KOREAN : FLASHBACK_MARKERS_JAPANESE;
  return textContainsAny(text, markers);
}

/**
 * 지시문이 이름 붙인 두 조합만 실제로 검사한다 — 감지된 마커가 이 두 조합
 * 중 하나에 해당하고 회상 표지가 전혀 없을 때만 blocking 이슈를 낸다.
 */
export function checkRelationshipContinuity(lyrics: string, language: 'korean' | 'japanese'): RelationshipContinuityIssue[] {
  const issues: RelationshipContinuityIssue[] = [];
  if (hasFlashbackMarker(lyrics, language)) return issues;

  const hasUnsent = detectMarker(lyrics, 'unsent-message', language);
  const hasReply = detectMarker(lyrics, 'reply-received', language);
  if (hasUnsent && hasReply) {
    issues.push({
      id: 'unsent-then-reply',
      labelKo: '문자를 보내지 못했다고 했는데 같은 곡 안에서 답장을 받는 장면이 있습니다 (회상 표지 없음).',
      markers: ['unsent-message', 'reply-received']
    });
  }

  const hasEx = detectMarker(lyrics, 'ex-relationship', language);
  const hasFirstMeeting = detectMarker(lyrics, 'first-meeting', language);
  if (hasEx && hasFirstMeeting) {
    issues.push({
      id: 'ex-then-first-meeting',
      labelKo: '이별한 사이라고 했는데 같은 곡 안에서 같은 시간선의 첫 만남을 묘사합니다 (회상 표지 없음).',
      markers: ['ex-relationship', 'first-meeting']
    });
  }

  return issues;
}
