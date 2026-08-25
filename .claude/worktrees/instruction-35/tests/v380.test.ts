import { describe, expect, it } from 'vitest';
import { directSetLocal } from '../src/core/setDirector';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { pinPrefixPreservingCounts } from '../src/core/arcPlan';
import { applyFlagshipVocalOrder, buildVocalTechniquePlan, resolveFlagshipVocalOrder } from '../src/core/vocalPlan';
import { SENIOR_AUDIENCE_PROFILE } from '../src/data/audienceProfiles';
import { PROXIMITY_POOL, MODERN_PROXIMITY_VALUES } from '../src/data/vocalTraits';
import { VOCAL_TECHNIQUES_BY_ERA } from '../src/data/vocalTechniquesByEra';
import { getGenreById } from '../src/data/genreLibrary';
import { channelPresets, makeOptions, testMoods, testSeason } from './fixtures';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;

function realPack(concept: string, previousFlagshipOrder?: ('male' | 'female' | 'mixed')[]) {
  const plan = directSetLocal(concept, seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
  const genreAllocation = plan.allocations.find(a => a.axis === 'genre')!;
  const genreIds = Object.keys(genreAllocation.counts);
  const genres = genreIds.map(id => getGenreById(id)).filter(Boolean) as ReturnType<typeof getGenreById>[];
  const opts = makeOptions({
    channel: seniorChannel,
    songCount: 18,
    genreIds,
    moodIds: seniorChannel.preferredMoods,
    vocalTone: seniorChannel.defaultVocal,
    customConcept: concept,
    diversityAllocations: plan.allocations
  });
  const avoid = previousFlagshipOrder ? { previousFlagshipOrder } : undefined;
  return { opts, genres: genres as any[], slots: preallocateSongSlots(opts, genres as any[], avoid) };
}

describe('[v3.80 TASK A] arcPlan.pinPrefixPreservingCounts', () => {
  it('pins the prefix while preserving the overall multiset', () => {
    const values = ['full', 'full', 'full', 'sparse', 'sparse', 'sparse', 'medium', 'medium', 'medium'];
    const pinned = pinPrefixPreservingCounts(values, ['medium', 'sparse', 'sparse']);
    expect(pinned.slice(0, 3)).toEqual(['medium', 'sparse', 'sparse']);
    const countOf = (list: string[], v: string) => list.filter(x => x === v).length;
    for (const v of ['full', 'sparse', 'medium']) {
      expect(countOf(pinned, v)).toBe(countOf(values, v));
    }
  });

  it('is a no-op when the prefix already matches', () => {
    const values = ['medium', 'sparse', 'sparse', 'full'];
    expect(pinPrefixPreservingCounts(values, ['medium', 'sparse', 'sparse'])).toEqual(values);
  });
});

describe('[v3.80 TASK A-3] resolveFlagshipVocalOrder / applyFlagshipVocalOrder', () => {
  it('never repeats the immediately prior order', () => {
    let prev: ('male' | 'female' | 'mixed')[] | undefined;
    for (let seed = 0; seed < 30; seed++) {
      const order = resolveFlagshipVocalOrder(seed, prev);
      expect(order).toHaveLength(3);
      expect(new Set(order).size).toBe(3);
      if (prev) expect(order).not.toEqual(prev);
      prev = order;
    }
  });

  it('is deterministic for the same seed and previousOrder', () => {
    expect(resolveFlagshipVocalOrder(42, undefined)).toEqual(resolveFlagshipVocalOrder(42, undefined));
  });

  it('applyFlagshipVocalOrder pins positions 0-2 and preserves overall type counts', () => {
    const plan: ('male' | 'female' | 'mixed')[] = ['male', 'male', 'male', 'male', 'male', 'male', 'female', 'female', 'female', 'female', 'female', 'female', 'mixed', 'mixed', 'mixed', 'mixed', 'mixed', 'mixed'];
    const pinned = applyFlagshipVocalOrder(plan, ['mixed', 'female', 'male']);
    expect(pinned.slice(0, 3)).toEqual(['mixed', 'female', 'male']);
    for (const type of ['male', 'female', 'mixed'] as const) {
      expect(pinned.filter(t => t === type).length).toBe(6);
    }
  });
});

describe('[v3.80 TASK E] buildVocalTechniquePlan', () => {
  it('caps any single technique at 4 uses pack-wide', () => {
    const eraBucketByIndex = Array.from({ length: 18 }, () => '1980s' as const);
    const plan = buildVocalTechniquePlan(eraBucketByIndex, 7);
    const usage = new Map<string, number>();
    for (const text of plan) {
      for (const technique of text.split(', ').filter(Boolean)) {
        usage.set(technique, (usage.get(technique) ?? 0) + 1);
      }
    }
    for (const count of usage.values()) expect(count).toBeLessThanOrEqual(4);
  });

  it('every entry across every era is at most 8 words', () => {
    for (const pool of Object.values(VOCAL_TECHNIQUES_BY_ERA)) {
      for (const technique of pool) {
        expect(technique.split(/\s+/).length, technique).toBeLessThanOrEqual(8);
      }
    }
  });

  it('falls back to the timeless pool for an unmatched era', () => {
    const plan = buildVocalTechniquePlan([undefined], 1);
    expect(plan[0].length === 0 || VOCAL_TECHNIQUES_BY_ERA.timeless.some(t => plan[0].includes(t))).toBe(true);
  });
});

describe('[v3.80 TASK B] proximity axis', () => {
  it('PROXIMITY_POOL has 7 values, 2 modern + 5 era-signature', () => {
    expect(PROXIMITY_POOL).toHaveLength(7);
    expect(MODERN_PROXIMITY_VALUES.size).toBe(2);
  });
});

describe('[v3.80 TASK D] hardExclusions/exclusions clarify belting vs falsetto, add cavernous-hall-reverb', () => {
  it('keeps the existing belting exclusion and adds the new reverb exclusion, in both lists', () => {
    expect(SENIOR_AUDIENCE_PROFILE.exclusions).toContain('shouted or belted high notes');
    expect(SENIOR_AUDIENCE_PROFILE.exclusions).toContain('excessive reverb washing out the vocal');
    expect(SENIOR_AUDIENCE_PROFILE.exclusions).toContain('cavernous hall reverb');
    expect(SENIOR_AUDIENCE_PROFILE.hardExclusions).toContain('cavernous hall reverb');
  });

  it('relaxes the forward-in-mix constraint to an audibility constraint', () => {
    expect(SENIOR_AUDIENCE_PROFILE.constraints).not.toContain('lead vocal sits forward in the mix');
    expect(SENIOR_AUDIENCE_PROFILE.constraints).toContain('lead vocal stays clearly audible above the arrangement');
  });
});

describe('[v3.80 TASK A] flagship slot spec — real 18-song senior packs via preallocateSongSlots', () => {
  const concepts = ['60~70년대 향수가 느껴지는 올드팝', '80년대 초반 어덜트 컨템포러리 발라드', '비틀즈 느낌의 밝은 60년대 팝'];

  for (const concept of concepts) {
    it(`"${concept}": tracks 1-3 are 3 distinct vocal types, track 1 has no killing point, tracks 2-3 do`, () => {
      const { slots } = realPack(concept);
      const order = slots.slice(0, 3).map(s => s.vocalType);
      expect(new Set(order).size).toBe(3);
      expect(slots[0].killingPointId).toBeUndefined();
      expect(slots[1].killingPointId).toBeDefined();
      expect(slots[2].killingPointId).toBeDefined();
    });

    it(`"${concept}": arrangementDensity is pinned medium/sparse/sparse for tracks 1-3, exact 6:8:4 overall (v4.16), no run > 2`, () => {
      const { slots } = realPack(concept);
      const density = slots.map(s => s.arrangementDensity);
      expect(density.slice(0, 3)).toEqual(['medium', 'sparse', 'sparse']);
      const counts = { sparse: 0, medium: 0, full: 0 } as Record<string, number>;
      for (const d of density) counts[d!] += 1;
      // v4.16 (TASK B) — weighted 3:4:2 (sparse:medium:full), not an even
      // split — real listening found 12/18 full-density tracks under the
      // old 6:6:6 split, too dense for a senior "차분한" set.
      expect(counts).toEqual({ sparse: 6, medium: 8, full: 4 });
      let run = 1;
      for (let i = 1; i < density.length; i++) {
        run = density[i] === density[i - 1] ? run + 1 : 1;
        expect(run, `run at index ${i}`).toBeLessThanOrEqual(2);
      }
    });
  }

  it('rotates the flagship vocal-type order across 3 consecutive sets, never repeating the immediately prior order', () => {
    const first = realPack('senior nostalgia flagship rotation A');
    const order1 = first.slots.slice(0, 3).map(s => s.vocalType) as ('male' | 'female' | 'mixed')[];
    const second = realPack('senior nostalgia flagship rotation B', order1);
    const order2 = second.slots.slice(0, 3).map(s => s.vocalType) as ('male' | 'female' | 'mixed')[];
    expect(order2).not.toEqual(order1);
    const third = realPack('senior nostalgia flagship rotation C', order2);
    const order3 = third.slots.slice(0, 3).map(s => s.vocalType) as ('male' | 'female' | 'mixed')[];
    expect(order3).not.toEqual(order2);
  });
});

describe('[v3.80 TASK B] flagship proximity override — real generateLocalBlueprint stylePrompt', () => {
  it('track 1 is never "dry and forward"; tracks 2-3 are plate or chamber ambience', () => {
    const plan = directSetLocal('60~70년대 향수가 느껴지는 올드팝', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    const genreAllocation = plan.allocations.find(a => a.axis === 'genre')!;
    const genreIds = Object.keys(genreAllocation.counts);
    const genres = genreIds.map(id => getGenreById(id)).filter(Boolean) as any[];
    const opts = makeOptions({
      channel: seniorChannel,
      songCount: 18,
      genreIds,
      moodIds: seniorChannel.preferredMoods,
      vocalTone: seniorChannel.defaultVocal,
      customConcept: 'proximity check',
      diversityAllocations: plan.allocations
    });
    const bp = generateLocalBlueprint(opts, genres, testMoods, testSeason);
    expect(bp.songs[0].stylePrompt).not.toContain('dry and forward');
    for (const idx of [1, 2]) {
      const hasPlateOrChamber = bp.songs[idx].stylePrompt.includes('soft plate ambience') || bp.songs[idx].stylePrompt.includes('chamber ambience');
      expect(hasPlateOrChamber, bp.songs[idx].stylePrompt).toBe(true);
    }
  });
});
