import { FLASHBACK_MARKERS_JAPANESE, FLASHBACK_MARKERS_KOREAN, checkRelationshipContinuity } from './relationshipContinuity';

/**
 * 지시문 17 (TASK B) — "소품 상태 추적". 지시문 원문은 "지시문 11 TASK A가
 * 만든 RelationshipState를 여기서 공통 엔진으로 확장한다"고 지시했지만,
 * 실측 결과 그런 타입은 저장소 어디에도 없다 — 실제로 있는 건
 * core/relationshipContinuity.ts의 훨씬 좁은 키워드-쌍 모순 감지기
 * (checkRelationshipContinuity, kr-2030/jp-2030 전용, unsent↔reply /
 * ex↔first-meeting 두 조합만)뿐이다. 그래서 이 파일은 "RelationshipState를
 * 재사용"하는 대신, 그 파일의 실제 아키텍처(키워드-쌍 + 회상 표지로 억제)를
 * ObjectState에 그대로 적용하고, 회상 표지 목록만 실제로 공유한다(export된
 * FLASHBACK_MARKERS_KOREAN/JAPANESE — 두 곳에 다른 목록을 두지 않는다는
 * 지시문 자신의 요구). 'message' kind는 그 파일의 unsent-then-reply 판정을
 * 그대로 위임한다 — 같은 실측 근거를 두 번 만들지 않는다.
 *
 * 실측: T10 "Before I Lose My Nerve"(20260808 팩) — "내 어깨가 편해진 건
 * 편지가 떨어진 뒤였다"(발송 증거) 다음에 "나는 마지막 줄을 다시 읽고
 * 웃었다"(재독 서술)가 복사본/초안 언급 없이 나온다. 이게 이 파일이
 * 실제로 검증한 유일한 kind다(letter) — 같은 워크스페이스에 배정된
 * window/light/door/vehicle은 실측 근거가 없다. "구조는 공통, 차단 권한은
 * 실측된 곳에만"을 워크스페이스 단위가 아니라 kind 단위로 적용한다(data/
 * objectStatePolicy.ts의 verifiedKinds가 이 구분을 담는다) — 같은
 * 워크스페이스에 배정됐다고 모든 kind가 자동으로 blocking 권한을 갖지
 * 않는다.
 */

export type ObjectStateKind = 'letter' | 'message' | 'door' | 'window' | 'light' | 'vehicle' | 'container';
export type ObjectStateSeverity = 'blocking' | 'advisory';
export type ObjectStateLanguage = 'english' | 'korean' | 'japanese';

export interface ObjectStateFinding {
  kind: ObjectStateKind;
  severity: ObjectStateSeverity;
  reasonKo: string;
  lines: string[];
}

const FLASHBACK_MARKERS_ENGLISH = ['remember', 'years ago', 'back then', 'looking back', 'used to', 'that summer', 'those days', 'long ago'];

function hasFlashbackMarker(text: string, language: ObjectStateLanguage): boolean {
  if (language === 'english') return FLASHBACK_MARKERS_ENGLISH.some(m => text.toLowerCase().includes(m));
  if (language === 'korean') return FLASHBACK_MARKERS_KOREAN.some(m => text.includes(m));
  return FLASHBACK_MARKERS_JAPANESE.some(m => text.includes(m));
}

interface KindMarkerSet {
  /** 물건이 화자의 손/현재 상태를 떠났다는 증거(발송/출발/비움/닫힘). */
  departedMarkers: string[];
  /** 떠난 뒤에도 여전히 손에 있거나 원상태인 것처럼 서술하는 문구. */
  contradictionMarkers: string[];
  /** 복사본·초안·다른 차편 등 모순을 설명하는 문구 — 인접해 있으면 억제한다. */
  disclaimerMarkers: string[];
  reasonKo: string;
}

/**
 * 지시문 17 §1-2 실측(letter, T10)만 실제 근거가 있다. vehicle/container/
 * door/window/light는 같은 아키텍처를 적용한 합리적 추정 어휘다 — 실측이
 * 아니므로 아래 OBJECT_STATE_POLICY의 verifiedKinds에는 letter만 올린다.
 * 영어 어휘만 채운다 — 한국어/일본어는 message(relationshipContinuity.ts
 * 위임)를 빼면 실측이 전혀 없어 빈 배열로 둔다(과탐보다 미검출이 안전).
 */
const KIND_MARKERS_ENGLISH: Partial<Record<ObjectStateKind, KindMarkerSet>> = {
  letter: {
    departedMarkers: ['the letter fell', 'letter fell', 'dropped the letter', 'sealed the envelope', 'into the mailbox', 'in the mailbox', 'sent the letter', 'mailed the letter', 'let the envelope go', 'the letter was gone'],
    contradictionMarkers: ['read it again', 'read the letter again', 'read the closing line again', 'reread', 'unfolded it again', 'opened the letter again', 'opened it again'],
    disclaimerMarkers: ['a copy', 'the copy', 'kept a copy', 'before i sent', 'before sealing', 'draft'],
    reasonKo: '편지가 이미 발송된 것으로 서술된 뒤(우체통/봉투 서술), 그 편지를 다시 읽는 서술이 복사본·초안 언급 없이 나온다.'
  },
  vehicle: {
    departedMarkers: ['the train left', 'the train pulled away', 'pulled out of the station', 'watched it leave', 'departed', 'pulled away', 'the car drove off'],
    contradictionMarkers: ['climbed back on', 'got back on', 'boarded again', 'stepped back on board', 'back in my seat'],
    disclaimerMarkers: ['next train', 'another train', 'a different train', 'the next one'],
    reasonKo: '차량이 이미 떠난 것으로 서술된 뒤, 다른 차편이라는 언급 없이 같은 차량에 다시 탑승하는 서술이 나온다.'
  },
  container: {
    departedMarkers: ['emptied the box', 'the box was empty', 'nothing left inside', 'poured it all out', 'used the last of it'],
    contradictionMarkers: ['took another out', 'pulled one more out', 'reached in and found', 'found one more inside'],
    disclaimerMarkers: ['a new box', 'another container', 'refilled'],
    reasonKo: '용기가 이미 빈 것으로 서술된 뒤, 새 용기라는 언급 없이 같은 용기에서 다시 무언가를 꺼내는 서술이 나온다.'
  },
  door: {
    departedMarkers: ['the door was closed', 'closed the door', 'locked the door', 'shut the door'],
    contradictionMarkers: ['walked through the door', 'passed through the door', 'stepped through the doorway'],
    disclaimerMarkers: ['opened the door', 'unlocked the door', 'pushed the door open'],
    reasonKo: '문이 닫힌 것으로 서술된 뒤, 다시 여는 서술 없이 그 문을 통과하는 서술이 나온다.'
  },
  window: {
    departedMarkers: ['the window was closed', 'closed the window', 'shut the window'],
    contradictionMarkers: ['climbed through the window', 'breeze came through the window', 'wind poured through the window'],
    disclaimerMarkers: ['opened the window', 'cracked the window'],
    reasonKo: '창문이 닫힌 것으로 서술된 뒤, 다시 여는 서술 없이 바람/사람이 창문을 통과하는 서술이 나온다.'
  },
  light: {
    departedMarkers: ['turned off the light', 'the light went out', 'switched off the lamp', 'the lamp went dark'],
    contradictionMarkers: ['the light still shone', 'glow filled the room', 'the lamp lit the room', 'light spilled across'],
    disclaimerMarkers: ['turned it back on', 'flicked it on again', 'a different light'],
    reasonKo: '조명이 꺼진 것으로 서술된 뒤, 다시 켜는 서술 없이 그 빛이 무언가를 비추는 서술이 나온다.'
  }
};

function matchingLines(lyrics: string, keywords: string[]): string[] {
  const lower = keywords.map(k => k.toLowerCase());
  return lyrics
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && lower.some(k => line.toLowerCase().includes(k)));
}

function checkKeywordPairKind(lyrics: string, kind: ObjectStateKind, language: ObjectStateLanguage, verified: boolean): ObjectStateFinding | undefined {
  const markers = language === 'english' ? KIND_MARKERS_ENGLISH[kind] : undefined;
  if (!markers) return undefined; // 이 kind/언어 조합은 실측 어휘가 없다 — 침묵(오탐보다 미검출이 안전).
  const lower = lyrics.toLowerCase();
  const hasDeparted = markers.departedMarkers.some(m => lower.includes(m));
  const hasContradiction = markers.contradictionMarkers.some(m => lower.includes(m));
  if (!hasDeparted || !hasContradiction) return undefined;
  const hasDisclaimer = markers.disclaimerMarkers.some(m => lower.includes(m));
  if (hasDisclaimer) return undefined;
  const flashback = hasFlashbackMarker(lyrics, language);
  return {
    kind,
    severity: verified && !flashback ? 'blocking' : 'advisory',
    reasonKo: flashback ? `${markers.reasonKo} (회상 표지가 있어 advisory로 낮춤)` : markers.reasonKo,
    lines: [...matchingLines(lyrics, markers.departedMarkers), ...matchingLines(lyrics, markers.contradictionMarkers)]
  };
}

/** message kind는 core/relationshipContinuity.ts의 unsent-then-reply 실측 판정을 그대로 위임한다 — 같은 근거를 두 번 만들지 않는다. 한국어/일본어 전용(그 함수 자신의 스코프). */
function checkMessageKind(lyrics: string, language: ObjectStateLanguage, verified: boolean): ObjectStateFinding | undefined {
  if (language !== 'korean' && language !== 'japanese') return undefined;
  const issues = checkRelationshipContinuity(lyrics, language);
  const unsentThenReply = issues.find(i => i.id === 'unsent-then-reply');
  if (!unsentThenReply) return undefined;
  // checkRelationshipContinuity 자신이 이미 회상 표지 억제를 내부에서 처리한다(hasFlashbackMarker면 issues가 애초에 빈 배열) — 여기서 다시 판정하지 않는다.
  return {
    kind: 'message',
    severity: verified ? 'blocking' : 'advisory',
    reasonKo: unsentThenReply.labelKo,
    lines: []
  };
}

/** ObjectState 판정 — archetype을 전혀 모른다. 어떤 kind를 적용할지, 어떤 kind가 verified인지는 전부 호출자가 넘기는 정책이 결정한다. */
export function evaluateObjectState(
  lyrics: string,
  kinds: ObjectStateKind[],
  verifiedKinds: ObjectStateKind[],
  language: ObjectStateLanguage
): ObjectStateFinding[] {
  const findings: ObjectStateFinding[] = [];
  for (const kind of kinds) {
    const verified = verifiedKinds.includes(kind);
    const finding = kind === 'message' ? checkMessageKind(lyrics, language, verified) : checkKeywordPairKind(lyrics, kind, language, verified);
    if (finding) findings.push(finding);
  }
  return findings;
}
