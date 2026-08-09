import { describe, expect, it } from 'vitest';
import { buildGenreAllocationForListeningIntent, isEraColorGenreId, representativePerceivedEnergy, scaleEnergyDistribution } from '../src/core/listeningIntent';
import { LISTENING_INTENT_POLICY, DEFAULT_LISTENING_INTENT } from '../src/data/listeningIntentPolicy';
import { PERCEIVED_ENERGY_POLICY } from '../src/data/perceivedEnergyPolicy';
import { getGenreById } from '../src/data/genreLibrary';
import { channelPresets } from '../src/data/presets';
import { MAX_SELECTED_GENRES } from '../src/core/genreSelection';

const energyPolicy = PERCEIVED_ENERGY_POLICY['senior-oldpop'];

describe('지시문 23 TASK B — isEraColorGenreId', () => {
  it('1950s-60s/1970s 장르는 시대색으로 판정한다', () => {
    expect(isEraColorGenreId('oldpop-doowop-harmony')).toBe(true);
    expect(isEraColorGenreId('oldpop-piano-ballad-70s')).toBe(true);
  });

  it('1980s·timeless·era 무관 장르는 시대색이 아니다', () => {
    expect(isEraColorGenreId('smooth-jazz-lounge')).toBe(false);
    expect(isEraColorGenreId('oldpop-evening-lamp-ballad')).toBe(false);
    expect(isEraColorGenreId('jazz-classic-vocal-lounge')).toBe(false);
  });
});

describe('지시문 23 TASK B — scaleEnergyDistribution', () => {
  it('songCount=18이면 원본 분포를 그대로 유지한다', () => {
    const dist = { 1: 3, 2: 8, 3: 4, 4: 3, 5: 0 } as const;
    expect(scaleEnergyDistribution(dist, 18)).toEqual(dist);
  });

  it('다른 songCount로도 합이 정확히 songCount가 되도록 비례 스케일한다', () => {
    const dist = { 1: 3, 2: 8, 3: 4, 4: 3, 5: 0 } as const;
    const scaled = scaleEnergyDistribution(dist, 12);
    const total = Object.values(scaled).reduce((a, b) => a + b, 0);
    expect(total).toBe(12);
  });
});

describe('지시문 23 TASK B — representativePerceivedEnergy', () => {
  it('british-beat(상향 어휘)가 doowop-harmony(하향 어휘)보다 대표값이 높다', () => {
    const britishBeat = getGenreById('oldpop-british-beat')!;
    const doowop = getGenreById('oldpop-doowop-harmony')!;
    expect(representativePerceivedEnergy(britishBeat, energyPolicy)).toBeGreaterThan(representativePerceivedEnergy(doowop, energyPolicy));
  });
});

describe('지시문 23 TASK B — buildGenreAllocationForListeningIntent (실제 oldpop-lounge-main 채널)', () => {
  const channel = channelPresets.find(c => c.id === 'oldpop-lounge-main')!;
  const candidates = channel.preferredGenres.map(getGenreById).filter((g): g is NonNullable<typeof g> => Boolean(g));

  it('기본값은 감성 장시간형이다', () => {
    expect(DEFAULT_LISTENING_INTENT).toBe('long-listen-comfort');
  });

  for (const intentId of ['long-listen-comfort', 'balanced', 'era-authentic'] as const) {
    it(`${intentId}: 18곡 전부 배정되고 장르 종수가 ${MAX_SELECTED_GENRES}개를 넘지 않으며 minEraColorTracks 하한을 만족한다`, () => {
      const policy = LISTENING_INTENT_POLICY[intentId];
      const alloc = buildGenreAllocationForListeningIntent(candidates, policy, 18, energyPolicy);
      const total = Object.values(alloc.counts).reduce((a, b) => a + b, 0);
      expect(total).toBe(18);
      expect(alloc.genreIds.length).toBeLessThanOrEqual(MAX_SELECTED_GENRES);
      expect(alloc.eraColorTrackCount).toBeGreaterThanOrEqual(policy.minEraColorTracks);
    });
  }

  it('감성 장시간형의 minEraColorTracks는 3 이상, maxEnergy는 4다 (하지 말 것: 0으로 만들지 말 것 / 3으로 낮추지 말 것)', () => {
    const policy = LISTENING_INTENT_POLICY['long-listen-comfort'];
    expect(policy.minEraColorTracks).toBeGreaterThanOrEqual(3);
    expect(policy.maxEnergy).toBe(4);
  });

  it('정통 올드팝형(되돌릴 길) preset이 존재하고 verified는 전부 false다', () => {
    expect(LISTENING_INTENT_POLICY['era-authentic']).toBeDefined();
    for (const intent of Object.values(LISTENING_INTENT_POLICY)) {
      expect(intent.verified).toBe(false);
      expect(intent.sourceKo).toBeTruthy();
    }
  });
});
