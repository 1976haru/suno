import { describe, expect, it } from 'vitest';
import {
  perceivedEnergyIntensityMismatches,
  perceivedEnergyAdjacentJumps,
  chorusStyleDistribution,
  hookWordCountDistribution,
  eraColorTrackCount,
  buildPerceivedEnergyObservations
} from '../src/core/perceivedEnergyObservations';
import type { SongIdea } from '../src/types';

function song(overrides: Partial<SongIdea> & { trackNo: number }): SongIdea {
  return {
    title: 'Song',
    seasonMoment: 'x',
    listenerSituation: 'x',
    emotionArc: 'x',
    hookPhrase: 'Hold On',
    stylePrompt: 'warm pop',
    lyrics: '[verse 1]\nline\n[end]',
    youtube: { title: 'yt', description: 'desc', tags: ['tag'] },
    qualityScore: 0,
    warnings: [],
    effectiveMoneyChordId: 'default',
    effectiveGenreIds: [],
    ...overrides
  };
}

describe('지시문 23 TASK A-5 — 체감 에너지 vs intensity 불일치 (차단 없음)', () => {
  it('차이가 2 이상인 곡만 목록에 포함한다', () => {
    const songs = [
      song({ trackNo: 1, perceivedEnergy: 5, intensity: 1 }),
      song({ trackNo: 2, perceivedEnergy: 3, intensity: 2 }),
      song({ trackNo: 3, perceivedEnergy: 2, intensity: 4 })
    ];
    const result = perceivedEnergyIntensityMismatches(songs);
    expect(result.map(r => r.trackNo)).toEqual([1, 3]);
    expect(result[0].diff).toBe(4);
    expect(result[1].diff).toBe(-2);
  });

  it('둘 중 하나라도 없으면 건너뛴다', () => {
    const songs = [song({ trackNo: 1, perceivedEnergy: 5 }), song({ trackNo: 2, intensity: 1 })];
    expect(perceivedEnergyIntensityMismatches(songs)).toEqual([]);
  });
});

describe('지시문 23 TASK C — 세트 에너지 급변 (차단 없음)', () => {
  it('trackNo 순서상 인접 곡 차이가 3 이상이면 급변으로 표시한다', () => {
    const songs = [
      song({ trackNo: 1, perceivedEnergy: 2 }),
      song({ trackNo: 2, perceivedEnergy: 2 }),
      song({ trackNo: 3, perceivedEnergy: 5 }),
      song({ trackNo: 4, perceivedEnergy: 4 })
    ];
    const jumps = perceivedEnergyAdjacentJumps(songs);
    expect(jumps).toEqual([{ fromTrackNo: 2, toTrackNo: 3, fromValue: 2, toValue: 5, diff: 3 }]);
  });

  it('차이가 1~2인 파동은 급변으로 표시하지 않는다', () => {
    const songs = [song({ trackNo: 1, perceivedEnergy: 2 }), song({ trackNo: 2, perceivedEnergy: 4 })];
    expect(perceivedEnergyAdjacentJumps(songs)).toEqual([]);
  });

  it('입력 배열 순서가 뒤섞여도 trackNo 순으로 정렬해 비교한다', () => {
    const songs = [song({ trackNo: 2, perceivedEnergy: 5 }), song({ trackNo: 1, perceivedEnergy: 1 })];
    const jumps = perceivedEnergyAdjacentJumps(songs);
    expect(jumps).toEqual([{ fromTrackNo: 1, toTrackNo: 2, fromValue: 1, toValue: 5, diff: 4 }]);
  });
});

describe('지시문 23 TASK D — 관찰 항목 4종 (규칙화 금지, 표시만)', () => {
  it('chorusStyle 분포를 센다', () => {
    const songs = [song({ trackNo: 1, chorusStyle: 'hookRepeat' }), song({ trackNo: 2, chorusStyle: 'hookRepeat' }), song({ trackNo: 3, chorusStyle: 'image' })];
    expect(chorusStyleDistribution(songs)).toEqual({ hookRepeat: 2, image: 1 });
  });

  it('훅 단어 수 분포를 센다', () => {
    const songs = [song({ trackNo: 1, hookPhrase: 'Hold On' }), song({ trackNo: 2, hookPhrase: 'I Won\'t Forget' }), song({ trackNo: 3, hookPhrase: 'Hold On Tight' })];
    expect(hookWordCountDistribution(songs)).toEqual({ 2: 1, 3: 2 });
  });

  it('eraTag 보유 곡 수를 센다', () => {
    const songs = [song({ trackNo: 1, eraTag: '1960s' }), song({ trackNo: 2 }), song({ trackNo: 3, eraTag: '1970s' })];
    expect(eraColorTrackCount(songs)).toBe(2);
  });

  it('buildPerceivedEnergyObservations가 4종 전부를 한 번에 담는다', () => {
    const songs = [
      song({ trackNo: 1, perceivedEnergy: 5, intensity: 1, chorusStyle: 'hookRepeat', hookPhrase: 'Hold On', eraTag: '1960s' }),
      song({ trackNo: 2, perceivedEnergy: 1, intensity: 1, chorusStyle: 'image', hookPhrase: 'I Know' })
    ];
    const obs = buildPerceivedEnergyObservations(songs);
    expect(obs.intensityMismatches.length).toBe(1);
    expect(obs.adjacentJumps.length).toBe(1);
    expect(obs.chorusStyleDistribution).toEqual({ hookRepeat: 1, image: 1 });
    expect(obs.hookWordCountDistribution).toEqual({ 2: 2 });
    expect(obs.eraColorTrackCount).toBe(1);
  });
});
