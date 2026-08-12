import { describe, expect, it } from 'vitest';
import { recommendMoneyChordPlan, suitableProgressionsForArchetype } from '../src/core/moneyChordRecommender';
import { moneyChordRotationPool, signatureMoneyChordId } from '../src/data/moneyChords';
import type { ChannelArchetype } from '../src/types';

const NON_KIDS_ARCHETYPES: ChannelArchetype[] = [
  'senior-morning', 'showa-cafe', 'showa-70s', 'j2000s', 'modern-chill', 'city-night',
  'oldpop-lounge', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-male', 'kr-idol-female', 'lofi-study'
];

function longestRun(ids: string[]): number {
  let max = 1, cur = 1;
  for (let i = 1; i < ids.length; i++) {
    cur = ids[i] === ids[i - 1] ? cur + 1 : 1;
    max = Math.max(max, cur);
  }
  return ids.length ? max : 0;
}

describe('지시문 39 (TASK A) — suitableProgressionsForArchetype', () => {
  it('matches moneyChordRotationPool (single source of truth) for every archetype', () => {
    for (const archetype of [...NON_KIDS_ARCHETYPES, 'kids' as ChannelArchetype]) {
      const presetIds = suitableProgressionsForArchetype(archetype).map(p => p.id);
      expect(presetIds).toEqual(moneyChordRotationPool(archetype));
    }
  });
});

describe('지시문 39 (TASK A) — recommendMoneyChordPlan', () => {
  it('track 1 is always pinned to the archetype signature progression', () => {
    for (const archetype of NON_KIDS_ARCHETYPES) {
      const result = recommendMoneyChordPlan({ channelArchetype: archetype, songCount: 15, genrePlan: Array(15).fill(undefined), seed: 1 });
      // chordIds[0](주 진행)만 검사한다 — TASK B의 다중 진행 확장이
      // track 1도 대상이 될 수 있으므로 전체 배열 동일성은 보장하지 않는다.
      expect(result[0].chordIds[0]).toBe(signatureMoneyChordId(archetype));
    }
  });

  it('15곡 기준 진행 종류 4~5종, 같은 진행 최대 6곡 이하, 연속 2곡 이하 (인수 기준)', () => {
    for (const archetype of [...NON_KIDS_ARCHETYPES, 'kids' as ChannelArchetype]) {
      const result = recommendMoneyChordPlan({ channelArchetype: archetype, songCount: 15, genrePlan: Array(15).fill(undefined), seed: 7 });
      const ids = result.map(r => r.chordIds[0]);
      const counts = new Map<string, number>();
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
      expect(counts.size, archetype).toBeGreaterThanOrEqual(4);
      expect(counts.size, archetype).toBeLessThanOrEqual(5);
      for (const [id, count] of counts) expect(count, `${archetype}/${id}`).toBeLessThanOrEqual(6);
      expect(longestRun(ids), archetype).toBeLessThanOrEqual(2);
    }
  });

  it('회전 풀 밖의 진행을 추천하지 않는다 (주 진행 — TASK B의 compatibleWith 보조 진행은 별도로 tests/moneyChordSectionPlan.test.ts가 검사한다)', () => {
    for (const archetype of NON_KIDS_ARCHETYPES) {
      const pool = new Set(moneyChordRotationPool(archetype));
      const result = recommendMoneyChordPlan({ channelArchetype: archetype, songCount: 18, genrePlan: Array(18).fill(undefined), seed: 3 });
      expect(result.every(r => pool.has(r.chordIds[0]))).toBe(true);
    }
  });

  it('동요에는 kids* 진행만 추천된다', () => {
    const result = recommendMoneyChordPlan({ channelArchetype: 'kids', songCount: 15, genrePlan: Array(15).fill(undefined), seed: 2 });
    expect(result.every(r => r.chordIds.every(id => id.startsWith('kids')))).toBe(true);
  });

  it('장르 적합도(genreMoneyChordAffinity)가 실제로 반영된다 — 두왑 장르가 계속 오면 doowop 비중이 높아진다', () => {
    const result = recommendMoneyChordPlan({
      channelArchetype: 'oldpop-lounge',
      songCount: 15,
      genrePlan: Array(15).fill('oldpop-doowop-harmony'),
      seed: 9
    });
    const doowopCount = result.filter(r => r.chordIds[0] === 'doowop').length;
    expect(doowopCount).toBeGreaterThanOrEqual(4);
  });

  it('reasonKo가 모든 트랙에 채워진다', () => {
    const result = recommendMoneyChordPlan({ channelArchetype: 'senior-morning', songCount: 15, genrePlan: Array(15).fill(undefined), seed: 4 });
    expect(result.every(r => r.reasonKo.length > 0)).toBe(true);
  });

  it('is deterministic for the same seed', () => {
    const a = recommendMoneyChordPlan({ channelArchetype: 'showa-cafe', songCount: 12, genrePlan: Array(12).fill(undefined), seed: 123 });
    const b = recommendMoneyChordPlan({ channelArchetype: 'showa-cafe', songCount: 12, genrePlan: Array(12).fill(undefined), seed: 123 });
    expect(a).toEqual(b);
  });

  it('returns an empty array for songCount 0', () => {
    expect(recommendMoneyChordPlan({ channelArchetype: 'oldpop-lounge', songCount: 0, genrePlan: [], seed: 1 })).toEqual([]);
  });

  it('18곡 요청도 정상 동작한다 (회귀 없음 — 채널 정체성 원칙 유지)', () => {
    const result = recommendMoneyChordPlan({ channelArchetype: 'oldpop-lounge', songCount: 18, genrePlan: Array(18).fill(undefined), seed: 5 });
    expect(result).toHaveLength(18);
    // TASK B의 다중 진행 확장이 track 1도 대상이 될 수 있으므로(주 진행은
    // 안 바뀐다는 계약만 확인) chordIds[0]만 검사한다.
    expect(result[0].chordIds[0]).toBe('doowop');
  });

  it('지시문 39 (TASK A+B 통합) — 미리보기에도 다중 진행(chordIds.length>1)이 실제로 나타난다', () => {
    const result = recommendMoneyChordPlan({ channelArchetype: 'senior-morning', songCount: 15, genrePlan: Array(15).fill(undefined), seed: 7 });
    const multi = result.filter(r => r.chordIds.length > 1);
    expect(multi.length).toBeGreaterThan(0);
    for (const rec of multi) {
      expect(rec.sectionMap.length).toBe(rec.chordIds.length);
      expect(rec.sectionMap[0].chordId).toBe(rec.chordIds[0]);
      expect(rec.reasonKo).toContain('다중 진행');
    }
  });
});
