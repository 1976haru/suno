import { describe, expect, it } from 'vitest';
import { scaleQuotaToSongCount } from '../src/core/quotaScaling';
import { emotionQuotaAdvisory } from '../src/core/emotionArcQuota';
import { SENIOR_OLDPOP_EMOTION_QUOTA } from '../src/data/emotionQuotaPolicy';

const BASE_QUOTA_18 = Object.fromEntries(SENIOR_OLDPOP_EMOTION_QUOTA.entries.map(e => [e.category, e.targetCount]));

describe('지시문 38 (TASK A-3) — scaleQuotaToSongCount', () => {
  it('returns the base quota unchanged when target === base (18곡 회귀 확인)', () => {
    expect(scaleQuotaToSongCount(BASE_QUOTA_18, 18, 18)).toEqual(BASE_QUOTA_18);
  });

  it('scales the 18곡 감정 쿼터(5·3·3·2·2·2·1) to 15곡 and the sum stays exactly 15', () => {
    const scaled = scaleQuotaToSongCount(BASE_QUOTA_18, 18, 15);
    const sum = Object.values(scaled).reduce((a, b) => a + b, 0);
    expect(sum).toBe(15);
    // 지시문 본문의 손 계산 예시: 4·3·2·2·2·1·1 (calm-comfort 5→4, 순서는 largest-remainder라 문서 예시와 축별로 완전히 같지 않을 수 있으나 합은 반드시 15)
    expect(scaled['calm-comfort']).toBeGreaterThanOrEqual(3);
    expect(scaled['wistfulness']).toBeGreaterThanOrEqual(1);
  });

  it('never returns a negative or NaN count for a tiny target (edge case)', () => {
    const scaled = scaleQuotaToSongCount(BASE_QUOTA_18, 18, 1);
    const sum = Object.values(scaled).reduce((a, b) => a + b, 0);
    expect(sum).toBe(1);
    expect(Object.values(scaled).every(v => v >= 0 && Number.isFinite(v))).toBe(true);
  });
});

describe('지시문 38 (TASK A-3) — emotionQuotaAdvisory 18곡 회귀 확인', () => {
  // 지시문 33/36이 튜닝한 실제 emotionArc 텍스트 조합(4종 커버, 7종 미달 —
  // advisory가 실제로 발동하는 실측 상태) 재사용.
  const under7CoverageTexts = [
    'lonely memory to warm acceptance', 'quiet longing to calm gratitude',
    'small sadness to steady comfort', 'old regret to peaceful closure',
    'soft nostalgia to renewed hope', 'warm reunion feeling lifting into brighter delight',
    'bittersweet reflection to gentle lift'
  ];

  it('songCount 인자 없이 부르면(기존 호출부와 동일 시그니처) 18곡 기준 그대로 — 회귀 없음', () => {
    const withDefault = emotionQuotaAdvisory('senior-oldpop', under7CoverageTexts);
    const withExplicit18 = emotionQuotaAdvisory('senior-oldpop', under7CoverageTexts, 18);
    expect(withDefault).toEqual(withExplicit18);
    expect(withDefault[0]?.labelKo).toBe('18곡 감정 분포 (advisory, 추정치)');
    expect(withDefault[0]?.actual).toContain('평온/위로 4곡(목표 5)');
  });

  it('15곡으로 부르면 라벨과 목표 숫자가 실제 곡 수로 환산된다', () => {
    const result = emotionQuotaAdvisory('senior-oldpop', under7CoverageTexts, 15);
    expect(result[0]?.labelKo).toBe('15곡 감정 분포 (advisory, 추정치)');
    // calm-comfort 5/18 * 15 = 4.16 -> floor 4 (largest-remainder로 나머지는 다른 축에 갈 수도 있음), 어쨌든 5는 아니다
    expect(result[0]?.actual).not.toContain('(목표 5)');
  });
});
