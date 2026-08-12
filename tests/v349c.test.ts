import { describe, expect, it } from 'vitest';
import { forecastCapacity } from '../src/core/capacityPlanner';
import { clampMultiSetTotal, createInitialOptions } from '../src/utils/generation';
import { channelPresets } from './fixtures';

describe('[v3.49c] basic 18-song / five-pack workflow defaults', () => {
  // 지시문 38 (TASK A) — 기본 곡 수 18 → 15. 18은 여전히 선택 가능한 값이라
  // 아래 "18곡 5팩" 케이스는 그대로 둔다 — 바뀐 건 초기 기본값 하나뿐이다.
  it('starts a new channel at 15 songs with auto diversity allocations', () => {
    const options = createInitialOptions(channelPresets[0]);
    expect(options.songCount).toBe(15);
    expect(options.diversityAllocations).toEqual([]);
  });

  it('keeps five packs at 18 songs each within the multi-pack limits', () => {
    expect(clampMultiSetTotal(5, 18)).toEqual({ setCount: 5, songsPerSet: 18 });
    const forecast = forecastCapacity(channelPresets[0].archetype || 'senior-morning', channelPresets[0].primaryLanguage, 90);
    expect(forecast.poolSize).toBeGreaterThan(0);
    expect(forecast.weeksAtCurrentPace).toBeGreaterThan(0);
  });
});
