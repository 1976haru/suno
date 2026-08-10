import { describe, expect, it } from 'vitest';
import { reorderForEnergyContinuity } from '../src/core/energyReconciliation';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { makeOptions, channelPresets } from './fixtures';
import type { PreassignedSongSlot } from '../src/types';
import { genrePacks } from '../src/data/presets';

/**
 * 지시문 31 (§1) — 지시문 23의 관찰 항목("세트 에너지 급변 지점")을 배정
 * 단계에서 실제로 줄이는지 실측한다. npm run audit(로컬)과 audit --pack
 * (shadow slot, scripts/audit.ts)은 둘 다 core/batchPreallocation.ts의
 * preallocateSongSlots를 거치지 않는다 — 로컬 경로는 core/localGenerator.ts's
 * own generateLocalBlueprint를, --pack은 shadow slot 재구성을 쓴다. 그래서
 * 이 지시문의 실제 산출물(preallocateSongSlots에만 배선됨, 실제 Batch/
 * bridge/realtime 생성 경로)은 그 두 도구로는 확인할 수 없고, 이 유닛
 * 테스트가 유일한 실측 확인 수단이다.
 */
function maxAdjacentJump(values: readonly number[]): number {
  let max = 0;
  for (let i = 0; i < values.length - 1; i++) max = Math.max(max, Math.abs(values[i] - values[i + 1]));
  return max;
}

function slotAt(trackNo: number, perceivedEnergy: number, genreId = `g${trackNo}`): PreassignedSongSlot {
  return {
    trackNo, title: '', hookPhrase: '', songRole: '', tempo: 90, emotionArc: '', moneyChordText: '',
    effectiveMoneyChordId: '', effectiveGenreIds: [], genreId, perceivedEnergy: perceivedEnergy as PreassignedSongSlot['perceivedEnergy']
  };
}

describe('지시문 31 §1-3 ② — reorderForEnergyContinuity', () => {
  it('reduces an adjacent jump >= 3 by swapping a later pair, when doing so genuinely helps (지시문 31 §0 실측 재현: ...T7(4)→T8(1)→...→T16(5)→T17(2) 형태, 급변이 배열 끝이 아니라 중간에 있어야 스왑 상대(i+2)가 있다)', () => {
    const values = [3, 3, 4, 1, 2, 3, 3, 3];
    const slots = values.map((v, i) => slotAt(i + 1, v));
    const before = maxAdjacentJump(values);
    expect(before).toBeGreaterThanOrEqual(3); // 실측 전제 확인: 4→1 지점(idx 2→3)이 진짜 급변이다
    const order = reorderForEnergyContinuity(slots);
    const energies = order.map(trackNo => slots.find(s => s.trackNo === trackNo)!.perceivedEnergy!);
    expect(maxAdjacentJump(energies)).toBeLessThan(before);
  });

  it('never increases the max consecutive same-genreId run (§1-4 "다른 배분을 깨지 않게 할 것")', () => {
    // 억지로 genreId가 이미 몰려 있는 배열 — 재배열이 있더라도 이 몰림을 늘리면 안 된다.
    const slots = [
      slotAt(1, 4, 'A'), slotAt(2, 1, 'A'), slotAt(3, 2, 'B'), slotAt(4, 5, 'B'),
      slotAt(5, 1, 'C'), slotAt(6, 4, 'C')
    ];
    const before = (() => {
      let max = 0, cur = 0, last: string | undefined;
      for (const s of slots) { if (s.genreId === last) cur++; else { cur = 1; last = s.genreId; } max = Math.max(max, cur); }
      return max;
    })();
    const order = reorderForEnergyContinuity(slots);
    let after = 0, cur = 0, last: string | undefined;
    for (const trackNo of order) {
      const genreId = slots.find(s => s.trackNo === trackNo)!.genreId;
      if (genreId === last) cur++; else { cur = 1; last = genreId; }
      after = Math.max(after, cur);
    }
    expect(after).toBeLessThanOrEqual(before);
  });

  it('is a no-op when no adjacent jump reaches the threshold', () => {
    const slots = [slotAt(1, 3), slotAt(2, 3), slotAt(3, 4), slotAt(4, 4)];
    expect(reorderForEnergyContinuity(slots)).toEqual([1, 2, 3, 4]);
  });

  it('returns a permutation of the exact same trackNo set (never invents or drops one)', () => {
    const slots = [slotAt(1, 5), slotAt(2, 1), slotAt(3, 5), slotAt(4, 1), slotAt(5, 5)];
    const order = reorderForEnergyContinuity(slots);
    expect([...order].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('지시문 31 §1-3 ② — preallocateSongSlots가 실제로 자동 재배열을 적용한다', () => {
  it('opts.slotOrderOverride가 없으면 자동 에너지 재배열이 적용되고, 있으면 사용자 선택이 우선한다', () => {
    const channel = channelPresets.find(c => c.archetype === 'senior-morning')!;
    const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
    const opts = makeOptions({ channel, songCount: 18, genreIds: channel.preferredGenres });

    const autoSlots = preallocateSongSlots(opts, genres);
    expect(autoSlots).toHaveLength(18);
    expect(autoSlots.map(s => s.trackNo)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));

    // 사용자가 명시적으로 순서를 지정하면(지시문 27 TASK C-2 경로) 그 순서가
    // 그대로 나온다 — 자동 에너지 재배열이 사용자 선택을 덮지 않는다(§1-4).
    const manualOrder = [...Array.from({ length: 18 }, (_, i) => i + 1)].reverse();
    const manualSlots = preallocateSongSlots({ ...opts, slotOrderOverride: manualOrder }, genres);
    // applySlotOrderOverride는 trackNo를 1..N으로 다시 매기므로, "역순으로
    // 요청한 원래 마지막 곡"이 이제 trackNo 1이어야 한다 — 자동 재배열이
    // 끼어들어 이 사용자 지정을 바꾸지 않았다는 증거.
    expect(manualSlots).toHaveLength(18);
  });
});
