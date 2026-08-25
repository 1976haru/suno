import { describe, expect, it } from 'vitest';
import { checkRelationshipContinuity } from '../src/core/relationshipContinuity';

/**
 * 지시문 11 (TASK A, required test file) — 실제 신고된 두 모순 패턴만
 * 검사한다는 좁은 범위 그대로: unsent-message -> reply-received,
 * ex-relationship -> first-meeting (같은 시간선). 회상 표지가 있으면
 * 차단하지 않는다는 명시 요구도 함께 검증한다.
 */

describe('[지시문 11 TASK A] checkRelationshipContinuity — unsent -> reply 모순', () => {
  it('문자를 보내지 못했다고 했는데 답장을 받는 장면이 있으면 blocking 이슈', () => {
    const lyrics = '[verse 1]\n차마 보내지 못했던 그 문자\n[chorus]\n네게서 답장이 왔다';
    const issues = checkRelationshipContinuity(lyrics, 'korean');
    expect(issues.some(i => i.id === 'unsent-then-reply')).toBe(true);
  });

  it('일본어도 동일 패턴을 감지한다', () => {
    const lyrics = '[verse 1]\n送れなかったメッセージ\n[chorus]\n返事が来た';
    const issues = checkRelationshipContinuity(lyrics, 'japanese');
    expect(issues.some(i => i.id === 'unsent-then-reply')).toBe(true);
  });

  it('회상 표지("그때")가 있으면 같은 조합이어도 차단하지 않는다', () => {
    const lyrics = '[verse 1]\n그때, 차마 보내지 못했던 문자\n[chorus]\n지금은 네게서 답장이 왔다';
    expect(checkRelationshipContinuity(lyrics, 'korean')).toEqual([]);
  });

  it('둘 중 하나만 있으면 이슈가 아니다', () => {
    const lyrics = '[verse 1]\n차마 보내지 못했던 문자만 있고\n[chorus]\n그냥 하루가 갔다';
    expect(checkRelationshipContinuity(lyrics, 'korean')).toEqual([]);
  });
});

describe('[지시문 11 TASK A] checkRelationshipContinuity — ex -> 같은 시간선 첫 만남 모순', () => {
  it('헤어진 사이인데 같은 곡에서 첫 만남을 묘사하면 blocking 이슈', () => {
    const lyrics = '[verse 1]\n우린 이미 헤어진 사이였지\n[chorus]\n처음 널 본 순간, 심장이 뛰었어';
    const issues = checkRelationshipContinuity(lyrics, 'korean');
    expect(issues.some(i => i.id === 'ex-then-first-meeting')).toBe(true);
  });

  it('일본어도 동일 패턴을 감지한다', () => {
    const lyrics = '[verse 1]\nもう別れた仲だった\n[chorus]\n初めて会った瞬間';
    const issues = checkRelationshipContinuity(lyrics, 'japanese');
    expect(issues.some(i => i.id === 'ex-then-first-meeting')).toBe(true);
  });

  it('회상 표지("돌이켜보면")가 있으면 차단하지 않는다 — 과거 회상은 실제로 흔한 서사 장치', () => {
    const lyrics = '[verse 1]\n돌이켜보면 우린 헤어진 사이였고\n[chorus]\n처음 만난 그날이 떠오른다';
    expect(checkRelationshipContinuity(lyrics, 'korean')).toEqual([]);
  });
});

describe('[지시문 11 TASK A] checkRelationshipContinuity — 정상 텍스트는 이슈 없음', () => {
  it('관계 마커가 전혀 없는 평범한 가사는 통과', () => {
    const lyrics = '[verse 1]\n오늘 하루도 참 길었다\n[chorus]\n집에 가는 길, 노래를 들었다';
    expect(checkRelationshipContinuity(lyrics, 'korean')).toEqual([]);
  });

  it('두 모순이 모두 있으면 두 이슈가 함께 보고된다 (하나만 조용히 숨기지 않음)', () => {
    const lyrics = [
      '[verse 1]', '차마 보내지 못했던 문자, 그리고 헤어진 사이였던 우리',
      '[chorus]', '네게서 답장이 왔다, 그리고 처음 널 본 순간'
    ].join('\n');
    const issues = checkRelationshipContinuity(lyrics, 'korean');
    expect(issues.map(i => i.id).sort()).toEqual(['ex-then-first-meeting', 'unsent-then-reply']);
  });
});
