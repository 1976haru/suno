import { describe, expect, it } from 'vitest';
import { evaluateDesignGate } from '../src/core/designGate';
import { applySlotOrderOverride } from '../src/core/slotOrderOverride';
import { resolveConstraintsFromOptions } from '../src/core/constraints';
import { audienceProfileForChannelArchetype } from '../src/data/audienceProfiles';
import { makeOptions } from './fixtures';
import type { PreassignedSongSlot } from '../src/types';

/**
 * 지시문 27 (TASK C) — "[자동 수정] 버튼이 보이는데 눌러도 아무 변화가
 * 없다"(§1-5)의 실제 재현·수정 확인. vocal-consecutive/vocal-segment-balance
 * autoFix가 opts 쿼터 패치(withVocalTypeAllocation)를 재사용하던 게
 * 원인이었다 — 쿼터는 이미 맞았고 순서만 문제였다. 이제
 * computeVocalRunBreakingOrder가 slotOrderOverride를 계산해 실제로 순서를
 * 바꾼다.
 */
function baseSlot(trackNo: number, vocalType: 'male' | 'female' | 'mixed'): PreassignedSongSlot {
  return {
    trackNo,
    title: `T${trackNo}`,
    hookPhrase: 'hook',
    songRole: 'standard',
    tempo: 90,
    emotionArc: 'warm',
    moneyChordText: 'I-V-vi-IV progression',
    vocalType,
    effectiveMoneyChordId: 'default',
    effectiveGenreIds: []
  };
}

describe('지시문 27 TASK C — vocal-consecutive 자동 수정이 실제로 순서를 바꾼다', () => {
  const opts = makeOptions({ songCount: 18 });
  const constraints = resolveConstraintsFromOptions(opts, audienceProfileForChannelArchetype(opts.channel.archetype, opts.audience), 'senior-oldpop');

  // 6 male, 6 female, 6 mixed — 쿼터 자체는 완전히 균형 잡혀 있다(vocal-type-min/
  // variety 위반이 전혀 없다). 순서만 M×6 F×6 X×6로 몰아넣어 vocal-consecutive만
  // 순수하게 재현한다.
  const skewedSlots: PreassignedSongSlot[] = [
    ...Array.from({ length: 6 }, (_, i) => baseSlot(i + 1, 'male')),
    ...Array.from({ length: 6 }, (_, i) => baseSlot(i + 7, 'female')),
    ...Array.from({ length: 6 }, (_, i) => baseSlot(i + 13, 'mixed'))
  ];

  it('재현: 순서가 몰려 있으면 vocal-consecutive가 실제로 걸린다', () => {
    const result = evaluateDesignGate(skewedSlots, constraints, opts);
    const issue = result.blocking.find(i => i.id === 'vocal-consecutive');
    expect(issue).toBeDefined();
    expect(issue!.actual).toBe('6곡 연속');
  });

  it('autoFix가 slotOrderOverride를 담고 있다 (opts 쿼터 패치가 아니라)', () => {
    const result = evaluateDesignGate(skewedSlots, constraints, opts);
    const issue = result.blocking.find(i => i.id === 'vocal-consecutive')!;
    expect(issue.autoFix).toBeDefined();
    expect(issue.autoFix!.slotOrderOverride).toBeInstanceOf(Array);
    expect(issue.autoFix!.slotOrderOverride).toHaveLength(18);
  });

  it('autoFix를 실제로 적용하면(applySlotOrderOverride) 연속이 2곡 이하로 줄고, 각 타입 총곡수는 그대로다', () => {
    const result = evaluateDesignGate(skewedSlots, constraints, opts);
    const issue = result.blocking.find(i => i.id === 'vocal-consecutive')!;
    const fixed = applySlotOrderOverride(skewedSlots, issue.autoFix!.slotOrderOverride);

    // 재배열 후 trackNo 1..18 순서로 다시 관문을 돌린다 — 실제 UI가
    // slotOrderOverride를 opts에 반영하면 preallocateSongSlots/
    // generateLocalBlueprint가 이 순서로 다시 만들어주는 것과 동일하다.
    const refixedResult = evaluateDesignGate(fixed, constraints, opts);
    expect(refixedResult.blocking.find(i => i.id === 'vocal-consecutive')).toBeUndefined();
    expect(refixedResult.blocking.find(i => i.id === 'vocal-segment-balance')).toBeUndefined();

    const countsByType = { male: 0, female: 0, mixed: 0 };
    for (const slot of fixed) if (slot.vocalType) countsByType[slot.vocalType] += 1;
    expect(countsByType).toEqual({ male: 6, female: 6, mixed: 6 });
  });

  it('applySlotOrderOverride: trackNo가 1..N으로 재배정되고, 내용(vocalType 등)은 원래 slotOrderOverride가 가리키는 원본 trackNo의 것을 그대로 옮긴다', () => {
    const order = [7, 1, 13, 2, 8, 14, 3, 9, 15, 4, 10, 16, 5, 11, 17, 6, 12, 18];
    const reordered = applySlotOrderOverride(skewedSlots, order);
    expect(reordered.map(s => s.trackNo)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    // order[0] = 7 -> 원래 T7(female)이 새 T1 자리로 옮겨간다.
    expect(reordered[0].vocalType).toBe('female');
    expect(reordered[1].vocalType).toBe('male');
  });

  it('applySlotOrderOverride: 길이가 안 맞거나 원래 trackNo 집합과 안 맞는 오염된 override는 무시하고 원래 배열을 그대로 반환한다', () => {
    expect(applySlotOrderOverride(skewedSlots, [1, 2, 3])).toBe(skewedSlots);
    expect(applySlotOrderOverride(skewedSlots, [...Array.from({ length: 17 }, (_, i) => i + 1), 999])).toBe(skewedSlots);
    expect(applySlotOrderOverride(skewedSlots, undefined)).toBe(skewedSlots);
  });
});
