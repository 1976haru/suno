import { describe, expect, it } from 'vitest';
import { checkKidsOutcome } from '../src/core/kidsOutcome';

/**
 * 지시문 11 (TASK B, required test file) — 4가지 명시된 결말 패턴만 좁게
 * 검사한다: unsafe-reward, fear-ending, bullying-wins, rule-violation-praised.
 * 교정/안전 표지가 있으면 차단하지 않는다는 명시 요구도 함께 검증한다.
 */

describe('[지시문 11 TASK B] checkKidsOutcome — unsafe-reward', () => {
  it('위험한 행동을 교정 없이 칭찬하면 blocking 이슈', () => {
    const lyrics = '[verse 1]\n혼자 길을 건넜어요\n[chorus]\n잘했어! 최고야!';
    const issues = checkKidsOutcome(lyrics, 'korean');
    expect(issues.some(i => i.id === 'unsafe-reward')).toBe(true);
  });

  it('일본어도 동일 패턴을 감지한다', () => {
    const lyrics = '[verse 1]\n一人で道を渡った\n[chorus]\nよくやった、最高だ';
    const issues = checkKidsOutcome(lyrics, 'japanese');
    expect(issues.some(i => i.id === 'unsafe-reward')).toBe(true);
  });

  it('교정 표지가 있으면 차단하지 않는다', () => {
    const lyrics = '[verse 1]\n혼자 길을 건넜어요\n[chorus]\n잘했어! 그런데 위험하다는 걸 알았어요';
    expect(checkKidsOutcome(lyrics, 'korean').some(i => i.id === 'unsafe-reward')).toBe(false);
  });

  it('위험 행동만 있고 보상이 없으면 이슈가 아니다', () => {
    const lyrics = '[verse 1]\n혼자 길을 건넜어요\n[chorus]\n그냥 집에 갔어요';
    expect(checkKidsOutcome(lyrics, 'korean')).toEqual([]);
  });
});

describe('[지시문 11 TASK B] checkKidsOutcome — rule-violation-praised', () => {
  it('안전 규칙 위반을 교정 없이 칭찬하면 blocking 이슈', () => {
    const lyrics = '[verse 1]\n안전벨트를 안 맸어요\n[chorus]\n멋져!';
    const issues = checkKidsOutcome(lyrics, 'korean');
    expect(issues.some(i => i.id === 'rule-violation-praised')).toBe(true);
  });

  it('교정 표지가 있으면 차단하지 않는다', () => {
    const lyrics = '[verse 1]\n안전벨트를 안 맸어요\n[chorus]\n멋져! 다시는 그러지 않기로 했어요';
    expect(checkKidsOutcome(lyrics, 'korean').some(i => i.id === 'rule-violation-praised')).toBe(false);
  });
});

describe('[지시문 11 TASK B] checkKidsOutcome — fear-ending', () => {
  it('마지막 섹션이 공포로 끝나고 해소가 없으면 blocking 이슈', () => {
    const lyrics = '[verse 1]\n오늘은 신나는 하루였어요\n[final chorus]\n괴물이 쫓아왔고 너무 무서웠어';
    const issues = checkKidsOutcome(lyrics, 'korean');
    expect(issues.some(i => i.id === 'fear-ending')).toBe(true);
  });

  it('마지막 섹션에서 안심되는 결말이 있으면 차단하지 않는다', () => {
    const lyrics = '[verse 1]\n괴물이 쫓아왔고 너무 무서웠어\n[final chorus]\n엄마가 꼭 안아줬어요, 이제 안전해';
    expect(checkKidsOutcome(lyrics, 'korean').some(i => i.id === 'fear-ending')).toBe(false);
  });

  it('중간에 무서운 장면이 나왔다가 해소되고, 마지막 섹션은 평범하면 fear-ending이 아니다', () => {
    const lyrics = '[verse 1]\n괴물이 쫓아왔고 너무 무서웠어\n[chorus]\n엄마가 꼭 안아줬어요\n[final chorus]\n오늘도 즐거운 하루였어요';
    expect(checkKidsOutcome(lyrics, 'korean').some(i => i.id === 'fear-ending')).toBe(false);
  });
});

describe('[지시문 11 TASK B] checkKidsOutcome — bullying-wins', () => {
  it('괴롭힘이 해결 없이 끝나면 blocking 이슈', () => {
    const lyrics = '[verse 1]\n친구를 놀렸다\n[chorus]\n그리고 하루가 끝났다';
    const issues = checkKidsOutcome(lyrics, 'korean');
    expect(issues.some(i => i.id === 'bullying-wins')).toBe(true);
  });

  it('사과·화해 장면이 있으면 차단하지 않는다', () => {
    const lyrics = '[verse 1]\n친구를 놀렸다\n[chorus]\n미안하다고 했고 다시 친구가 됐다';
    expect(checkKidsOutcome(lyrics, 'korean').some(i => i.id === 'bullying-wins')).toBe(false);
  });
});

describe('[지시문 11 TASK B] checkKidsOutcome — 정상 텍스트/여러 이슈 동시 보고', () => {
  it('아무 위험 마커도 없는 평범한 동요는 이슈 없음', () => {
    const lyrics = '[verse 1]\n오늘은 즐거운 소풍날\n[chorus]\n다 같이 노래해요';
    expect(checkKidsOutcome(lyrics, 'korean')).toEqual([]);
  });

  it('두 이슈가 동시에 있으면 둘 다 보고된다', () => {
    const lyrics = '[verse 1]\n혼자 길을 건넜고 친구를 놀렸다\n[final chorus]\n잘했어! 최고야! 그리고 너무 무서웠어';
    const issues = checkKidsOutcome(lyrics, 'korean');
    expect(issues.map(i => i.id).sort()).toEqual(['bullying-wins', 'fear-ending', 'unsafe-reward']);
  });
});
