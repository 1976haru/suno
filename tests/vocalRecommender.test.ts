import { describe, expect, it } from 'vitest';
import { recommendVocalPlan, suitablePresetsForArchetype } from '../src/core/vocalRecommender';
import { DEFAULT_ADULT_VOCAL_QUOTA, DEFAULT_KIDS_VOCAL_QUOTA } from '../src/core/vocalPlan';
import { vocalPresets } from '../src/data/vocalPresets';
import type { ChannelArchetype } from '../src/types';

const NON_KIDS_ARCHETYPES: ChannelArchetype[] = [
  'senior-morning', 'showa-cafe', 'christmas', 'lofi-study', 'showa-70s', 'j2000s',
  'modern-chill', 'city-night', 'oldpop-lounge', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-male', 'kr-idol-female'
];

describe('지시문 38 (TASK D2) — suitablePresetsForArchetype 하드 필터', () => {
  it('every non-kids archetype has at least one suited preset covering each vocal type it actually needs', () => {
    for (const archetype of NON_KIDS_ARCHETYPES) {
      const pool = suitablePresetsForArchetype(archetype);
      expect(pool.length).toBeGreaterThan(0);
      expect(pool.every(preset => !preset.forKids)).toBe(true);
    }
  });

  it('never returns a forKids preset for a non-kids archetype, and only forKids presets for a kids archetype', () => {
    expect(suitablePresetsForArchetype('oldpop-lounge').some(p => p.forKids)).toBe(false);
    expect(suitablePresetsForArchetype('kids').every(p => p.forKids)).toBe(true);
  });

  it('실측 회귀 — oldpop-lounge(하루의 실제 채널)는 젊고 밝은 성인 프리셋을 포함하지 않는다', () => {
    // 지시문 38 (TASK D2)의 실제 버그: suitedArchetypes가 하드 필터가 아니었고
    // 태그도 전부 'senior-morning'만 가리켜, 하루의 실제 채널(oldpop-lounge)엔
    // bright-young-*, airy-falsetto-male 같은 앳된 음색이 무방비로 노출됐다.
    const ids = suitablePresetsForArchetype('oldpop-lounge').map(p => p.id);
    expect(ids).not.toContain('bright-young-female');
    expect(ids).not.toContain('bright-young-male');
    expect(ids).not.toContain('airy-falsetto-male');
    expect(ids).not.toContain('husky-jazz-female');
    expect(ids).toContain('warm-mature-male');
    expect(ids).toContain('soft-female');
  });
});

describe('지시문 38 (TASK D) — recommendVocalPlan', () => {
  it('returns exactly songCount recommendations, each with a valid non-kids presetId for oldpop-lounge', () => {
    const result = recommendVocalPlan({ channelArchetype: 'oldpop-lounge', songCount: 15, vocalQuota: DEFAULT_ADULT_VOCAL_QUOTA, seed: 1 });
    expect(result).toHaveLength(15);
    const suitedIds = new Set(suitablePresetsForArchetype('oldpop-lounge').map(p => p.id));
    for (const rec of result) {
      expect(rec.presetId).not.toBe('');
      expect(suitedIds.has(rec.presetId)).toBe(true);
      expect(rec.reasonKo.length).toBeGreaterThan(0);
    }
  });

  it('시니어 채널 추천에 아이 목소리(kids 프리셋)가 절대 나오지 않는다 (인수 기준)', () => {
    const kidsIds = new Set(vocalPresets.filter(p => p.forKids).map(p => p.id));
    for (const archetype of ['senior-morning', 'oldpop-lounge', 'showa-70s', 'christmas'] as ChannelArchetype[]) {
      const result = recommendVocalPlan({ channelArchetype: archetype, songCount: 18, vocalQuota: DEFAULT_ADULT_VOCAL_QUOTA, seed: 7 });
      expect(result.every(rec => !kidsIds.has(rec.presetId))).toBe(true);
    }
  });

  it('never recommends the same preset 3 times in a row', () => {
    const result = recommendVocalPlan({ channelArchetype: 'kr-2030-pop', songCount: 30, vocalQuota: DEFAULT_ADULT_VOCAL_QUOTA, seed: 42 });
    let run = 1;
    for (let i = 1; i < result.length; i++) {
      run = result[i].presetId === result[i - 1].presetId ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(2);
    }
  });

  it('지시문 38 (TASK D-4 ③) — 같은 프리셋이 15곡 기준 4곡을 넘지 않는다(추정치, songCount 비례)', () => {
    const result = recommendVocalPlan({ channelArchetype: 'senior-morning', songCount: 15, vocalQuota: DEFAULT_ADULT_VOCAL_QUOTA, seed: 5 });
    const counts = new Map<string, number>();
    for (const rec of result) counts.set(rec.presetId, (counts.get(rec.presetId) ?? 0) + 1);
    for (const [presetId, count] of counts) {
      expect(count, `${presetId} used ${count} times`).toBeLessThanOrEqual(4);
    }
  });

  it('respects the same per-preset diversity cap scaled up at a larger songCount', () => {
    const result = recommendVocalPlan({ channelArchetype: 'senior-morning', songCount: 40, vocalQuota: DEFAULT_ADULT_VOCAL_QUOTA, seed: 5 });
    const counts = new Map<string, number>();
    for (const rec of result) counts.set(rec.presetId, (counts.get(rec.presetId) ?? 0) + 1);
    const expectedCap = Math.max(1, Math.ceil(40 * (4 / 15)));
    for (const [presetId, count] of counts) {
      expect(count, `${presetId} used ${count} times`).toBeLessThanOrEqual(expectedCap);
    }
  });

  it('kr-idol-male의 고정 쿼터(여성 0)를 그대로 받으면 여성 전용 프리셋을 절대 추천하지 않는다', () => {
    const femaleOnlyIds = new Set(['bright-clear-female', 'husky-jazz-female', 'airy-whisper-female', 'bright-young-female', 'soft-female', 'mature-female', 'soulful-female']);
    const result = recommendVocalPlan({ channelArchetype: 'kr-idol-male', songCount: 18, vocalQuota: { male: 15, female: 0, mixed: 3 }, seed: 9 });
    expect(result).toHaveLength(18);
    expect(result.every(rec => !femaleOnlyIds.has(rec.presetId))).toBe(true);
  });

  it('is deterministic for the same seed', () => {
    const a = recommendVocalPlan({ channelArchetype: 'showa-cafe', songCount: 12, vocalQuota: DEFAULT_ADULT_VOCAL_QUOTA, seed: 123 });
    const b = recommendVocalPlan({ channelArchetype: 'showa-cafe', songCount: 12, vocalQuota: DEFAULT_ADULT_VOCAL_QUOTA, seed: 123 });
    expect(a).toEqual(b);
  });

  it('kids 채널(kids archetype)도 forKids 프리셋만 추천한다', () => {
    const result = recommendVocalPlan({ channelArchetype: 'kids', songCount: 15, vocalQuota: DEFAULT_KIDS_VOCAL_QUOTA, seed: 3 });
    const kidsIds = new Set(vocalPresets.filter(p => p.forKids).map(p => p.id));
    expect(result).toHaveLength(15);
    expect(result.every(rec => kidsIds.has(rec.presetId))).toBe(true);
  });

  it('returns an empty array for songCount 0', () => {
    expect(recommendVocalPlan({ channelArchetype: 'oldpop-lounge', songCount: 0, vocalQuota: DEFAULT_ADULT_VOCAL_QUOTA, seed: 1 })).toEqual([]);
  });
});
