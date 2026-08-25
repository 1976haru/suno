import { describe, expect, it } from 'vitest';
import { KILLING_POINTS, assignKillingPoints } from '../src/data/killingPoints';
import { KIDS_KILLING_POINTS } from '../src/data/killingPointsKids';
import { KR_2030_KILLING_POINTS } from '../src/data/killingPointsKr2030';
import { JP_2030_KILLING_POINTS } from '../src/data/killingPointsJp2030';
import { KPOP_KILLING_POINTS, kpopKillingPointsForGender } from '../src/data/killingPointsKpop';
import { killingPointSetForNonKidsArchetype } from '../src/data/killingPointWorkspaceSets';

/**
 * 지시문 30 TASK C — 실측 재현: killingPointSetId(kr-2030-emotional-default
 * 등)는 문서화만 됐고, assignKillingPoints를 부르는 모든 실경로가 kids 분기
 * 하나만 빼면 전부 undefined를 넘겨 senior용 KILLING_POINTS로 조용히
 * 떨어졌다(core/verifiedSettingContract.ts의 killing-point-assignment
 * 설정 계약이 12채널을 SETTING LOST로 잡았던 바로 그 결함). 이 파일은 그
 * 수정 — killingPointSetForNonKidsArchetype이 kr-2030-pop/jp-2030-pop/
 * kr-idol-male/kr-idol-female을 각자의 실제 풀로 연결하는지 확인한다.
 */
describe('지시문 30 TASK C — killingPointSetForNonKidsArchetype', () => {
  it('kr-2030-pop resolves to KR_2030_KILLING_POINTS, not the senior pool', () => {
    const set = killingPointSetForNonKidsArchetype('kr-2030-pop');
    expect(set).toBe(KR_2030_KILLING_POINTS);
    expect(set).not.toBe(KILLING_POINTS);
  });

  it('jp-2030-pop resolves to JP_2030_KILLING_POINTS, not the senior pool', () => {
    const set = killingPointSetForNonKidsArchetype('jp-2030-pop');
    expect(set).toBe(JP_2030_KILLING_POINTS);
    expect(set).not.toBe(KILLING_POINTS);
  });

  it('kr-idol-male/kr-idol-female both resolve to the K-pop pool, not the senior pool', () => {
    expect(killingPointSetForNonKidsArchetype('kr-idol-male')).toBe(KPOP_KILLING_POINTS);
    expect(killingPointSetForNonKidsArchetype('kr-idol-female')).toBe(KPOP_KILLING_POINTS);
    expect(killingPointSetForNonKidsArchetype('kr-idol-male')).not.toBe(KILLING_POINTS);
  });

  it('every other archetype (senior-oldpop family, and unknown values) resolves to undefined — assignKillingPoints falls back to its own senior default, unchanged', () => {
    expect(killingPointSetForNonKidsArchetype('senior-morning')).toBeUndefined();
    expect(killingPointSetForNonKidsArchetype('showa-cafe')).toBeUndefined();
    expect(killingPointSetForNonKidsArchetype(undefined)).toBeUndefined();
  });

  it('kids archetypes are deliberately NOT handled by this function — the caller must keep using isKidsArchetype/kidsKillingPointsForTier first (§하지 말 것: 동요 분리를 되돌리지 말 것)', () => {
    expect(killingPointSetForNonKidsArchetype('kr-kids-song')).toBeUndefined();
    expect(killingPointSetForNonKidsArchetype('jp-kids-song')).toBeUndefined();
  });
});

describe('지시문 30 TASK C — new pool content', () => {
  const pools = [
    ['KR_2030_KILLING_POINTS', KR_2030_KILLING_POINTS],
    ['JP_2030_KILLING_POINTS', JP_2030_KILLING_POINTS],
    ['KPOP_KILLING_POINTS', KPOP_KILLING_POINTS]
  ] as const;

  for (const [name, pool] of pools) {
    it(`${name}: every entry is verified:false (실측 0세트, §C-4)`, () => {
      expect(pool.length).toBeGreaterThan(0);
      for (const kp of pool) expect(kp.verified).toBe(false);
    });

    it(`${name}: ids don't collide with senior KILLING_POINTS or KIDS_KILLING_POINTS`, () => {
      const seniorIds = new Set(KILLING_POINTS.map(kp => kp.id));
      const kidsIds = new Set(KIDS_KILLING_POINTS.map(kp => kp.id));
      for (const kp of pool) {
        expect(seniorIds.has(kp.id)).toBe(false);
        expect(kidsIds.has(kp.id)).toBe(false);
      }
    });

    it(`${name}: no octave-lift/key-change device (§C-4 "옥타브 상승·전조는 최소화")`, () => {
      for (const kp of pool) {
        expect(kp.descriptor.toLowerCase()).not.toMatch(/semitone|key change|modulat|octave/);
      }
    });
  }

  it('KPOP_KILLING_POINTS: no descriptor names a specific vocal type/gender (§C-4 "성별 쿼터를 깨지 않는다")', () => {
    for (const kp of KPOP_KILLING_POINTS) {
      expect(kp.descriptor.toLowerCase()).not.toMatch(/\bmale\b|\bfemale\b/);
    }
  });

  it('kpopKillingPointsForGender returns the same shared pool for both genders and undefined (documented — no real gendered distinction has been measured yet)', () => {
    expect(kpopKillingPointsForGender('male')).toBe(KPOP_KILLING_POINTS);
    expect(kpopKillingPointsForGender('female')).toBe(KPOP_KILLING_POINTS);
    expect(kpopKillingPointsForGender(undefined)).toBe(KPOP_KILLING_POINTS);
  });
});

describe('지시문 30 TASK C — senior/kids pools untouched (§하지 말 것)', () => {
  it('KILLING_POINTS keeps its original 12 entries', () => {
    expect(KILLING_POINTS.length).toBe(12);
  });

  it('assignKillingPoints still defaults to KILLING_POINTS when no set is passed (senior behavior byte-identical)', () => {
    const assigned = assignKillingPoints([{ peakStrength: 'strong' }], 0);
    expect(KILLING_POINTS.some(kp => kp.id === assigned[0]?.id)).toBe(true);
  });
});

describe('지시문 30 TASK C — assignKillingPoints actually uses the new pools end to end', () => {
  it('kr-2030 pool assignment only ever returns ids from KR_2030_KILLING_POINTS', () => {
    const inputs = Array.from({ length: 18 }, () => ({ peakStrength: 'strong' as const }));
    const assigned = assignKillingPoints(inputs, 7, {}, killingPointSetForNonKidsArchetype('kr-2030-pop'));
    const kr2030Ids = new Set(KR_2030_KILLING_POINTS.map(kp => kp.id));
    for (const kp of assigned) {
      expect(kp).toBeDefined();
      expect(kr2030Ids.has(kp!.id)).toBe(true);
    }
  });

  it('kr-idol-male pool assignment only ever returns ids from KPOP_KILLING_POINTS, never the senior pool', () => {
    const inputs = Array.from({ length: 18 }, () => ({ peakStrength: 'strong' as const }));
    const assigned = assignKillingPoints(inputs, 3, {}, killingPointSetForNonKidsArchetype('kr-idol-male'));
    const kpopIds = new Set(KPOP_KILLING_POINTS.map(kp => kp.id));
    const seniorIds = new Set(KILLING_POINTS.map(kp => kp.id));
    for (const kp of assigned) {
      expect(kp).toBeDefined();
      expect(kpopIds.has(kp!.id)).toBe(true);
      expect(seniorIds.has(kp!.id)).toBe(false);
    }
  });
});
