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

describe('지시문 38 (TASK D2-6, 선택) — 장르별 음색 적합성 (advisory)', () => {
  it('genrePlan을 안 주면(기존 호출부와 같은 시그니처) 결과가 그대로다 — 회귀 없음', () => {
    const withoutGenre = recommendVocalPlan({ channelArchetype: 'senior-morning', songCount: 15, vocalQuota: DEFAULT_ADULT_VOCAL_QUOTA, seed: 11 });
    const withUndefinedGenrePlan = recommendVocalPlan({ channelArchetype: 'senior-morning', songCount: 15, vocalQuota: DEFAULT_ADULT_VOCAL_QUOTA, seed: 11, genrePlan: undefined });
    expect(withoutGenre).toEqual(withUndefinedGenrePlan);
  });

  it('장르가 명확히 선호하는 프리셋이 채널 후보 풀에도 있으면 그 트랙 1순위로 우대한다(advisory, 첫 등장에서 결정적)', () => {
    // senior-morning의 후보 풀에는 soulful-female이 있다(oldpop-lounge에는 없다 —
    // 두 아키타입이 서로 다른 프리셋을 갖도록 지시문 38 D2가 재배정했기 때문).
    // 첫 트랙은 다양성 페널티(-uses*0.5)도 연속 방지 페널티도 아직 안 걸린
    // 상태라, 장르 가산점(+1.2, rng() 최댓값 1.0보다 크다)이 항상 이긴다.
    const result = recommendVocalPlan({
      channelArchetype: 'senior-morning',
      songCount: 5,
      vocalQuota: { male: 0, female: 5, mixed: 0 },
      seed: 77,
      genrePlan: Array(5).fill('oldpop-motown-pop-soul')
    });
    expect(result[0].presetId).toBe('soulful-female');
    expect(result[0].reasonKo).toContain('장르');
  });

  it('장르 선호 프리셋이 이 채널 후보 풀에 없으면 조용히 아무 효과가 없다(채널 필터를 우회하지 않는다)', () => {
    // oldpop-british-beat의 1순위 'clear-light-male'은 oldpop-lounge 후보에
    // 없다(data/vocalPresets.ts 매트릭스) — 결과가 여전히 oldpop-lounge
    // 자신의 채널-적합 후보 안에서만 나와야 한다.
    const suitedIds = new Set(suitablePresetsForArchetype('oldpop-lounge').map(p => p.id));
    const result = recommendVocalPlan({
      channelArchetype: 'oldpop-lounge',
      songCount: 6,
      vocalQuota: { male: 6, female: 0, mixed: 0 },
      seed: 5,
      genrePlan: Array(6).fill('oldpop-british-beat')
    });
    expect(result.every(rec => suitedIds.has(rec.presetId))).toBe(true);
    expect(result.every(rec => rec.presetId !== 'clear-light-male' && rec.presetId !== 'bright-young-male')).toBe(true);
  });

  it('알 수 없거나 대응 없는 장르 id는 그냥 무시된다', () => {
    const result = recommendVocalPlan({
      channelArchetype: 'senior-morning',
      songCount: 5,
      vocalQuota: DEFAULT_ADULT_VOCAL_QUOTA,
      seed: 1,
      genrePlan: Array(5).fill('does-not-exist-genre-id')
    });
    expect(result).toHaveLength(5);
  });
});
