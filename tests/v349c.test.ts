import { describe, expect, it } from 'vitest';
import { forecastCapacity } from '../src/core/capacityPlanner';
import { clampMultiSetTotal, createInitialOptions } from '../src/utils/generation';
import { channelPresets } from './fixtures';

describe('[v3.49c] basic 18-song / five-pack workflow defaults', () => {
  it('starts a new channel at 18 songs with auto diversity allocations', () => {
    const options = createInitialOptions(channelPresets[0]);
    expect(options.songCount).toBe(18);
    expect(options.diversityAllocations).toEqual([]);
  });

  it('keeps five packs at 18 songs each within the multi-pack limits', () => {
    expect(clampMultiSetTotal(5, 18)).toEqual({ setCount: 5, songsPerSet: 18 });
    const forecast = forecastCapacity(channelPresets[0].archetype || 'senior-morning', channelPresets[0].primaryLanguage, 90);
    expect(forecast.poolSize).toBeGreaterThan(0);
    expect(forecast.weeksAtCurrentPace).toBeGreaterThan(0);
  });
});
