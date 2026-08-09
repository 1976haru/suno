import { describe, expect, it } from 'vitest';
import { computePerceivedEnergy } from '../src/core/perceivedEnergy';
import { getGenreById } from '../src/data/genreLibrary';
import { PERCEIVED_ENERGY_POLICY } from '../src/data/perceivedEnergyPolicy';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { preallocateSongSlots, reconcileWithPreassignedSlot } from '../src/core/batchPreallocation';
import { perceivedEnergyAdjacentJumps } from '../src/core/perceivedEnergyObservations';
import { channelPresets, makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import pack from './fixtures/distinctChoice20260808Pack.json';
import type { SongIdea } from '../src/types';

const policy = PERCEIVED_ENERGY_POLICY['senior-oldpop'];

function baseSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Song',
    seasonMoment: 'x',
    listenerSituation: 'x',
    emotionArc: 'x',
    hookPhrase: 'Hold On',
    stylePrompt: 'warm pop, soft vocal',
    lyrics: '[verse 1]\nline one\nline two\n[chorus]\nHold On\nHold On\n[end]',
    youtube: { title: 'yt', description: 'desc', tags: ['tag'] },
    qualityScore: 0,
    warnings: [],
    effectiveMoneyChordId: 'default',
    effectiveGenreIds: [],
    ...overrides
  };
}

describe('지시문 23 TASK A — computePerceivedEnergy 단위 동작', () => {
  it('같은 장르에서 템포가 높을수록(다른 축 고정) 값이 낮아지지 않는다', () => {
    const genre = getGenreById('oldpop-british-beat')!;
    const low = computePerceivedEnergy({ tempo: 70, arrangementDensity: 'medium', instrumentSet: undefined, vocalText: undefined }, genre, policy);
    const high = computePerceivedEnergy({ tempo: 130, arrangementDensity: 'medium', instrumentSet: undefined, vocalText: undefined }, genre, policy);
    expect(high.value).toBeGreaterThanOrEqual(low.value);
  });

  it('같은 템포에서 두왑(계산상 하향 어휘)과 브리티시비트(상향 어휘)는 다른 값을 낸다', () => {
    const doowop = getGenreById('oldpop-doowop-harmony')!;
    const britishBeat = getGenreById('oldpop-british-beat')!;
    const a = computePerceivedEnergy({ tempo: 95, arrangementDensity: 'medium', instrumentSet: undefined, vocalText: undefined }, doowop, policy);
    const b = computePerceivedEnergy({ tempo: 95, arrangementDensity: 'medium', instrumentSet: undefined, vocalText: undefined }, britishBeat, policy);
    expect(a.value).toBeLessThan(b.value);
  });

  it('arrangementDensity sparse->full 방향으로 density 기여도가 오른다', () => {
    const genre = getGenreById('oldpop-brill-building')!;
    const sparse = computePerceivedEnergy({ tempo: 90, arrangementDensity: 'sparse', instrumentSet: undefined, vocalText: undefined }, genre, policy);
    const full = computePerceivedEnergy({ tempo: 90, arrangementDensity: 'full', instrumentSet: undefined, vocalText: undefined }, genre, policy);
    expect(full.breakdown.density).toBeGreaterThan(sparse.breakdown.density);
  });

  it('breakdown 6축이 전부 숫자로 채워진다', () => {
    const genre = getGenreById('oldpop-sunshine-pop')!;
    const result = computePerceivedEnergy({ tempo: 88, arrangementDensity: 'medium', instrumentSet: ['harpsichord'], vocalText: 'bright soprano lead' }, genre, policy);
    for (const key of ['tempo', 'rhythm', 'instrumentation', 'density', 'vocal', 'production'] as const) {
      expect(typeof result.breakdown[key]).toBe('number');
      expect(Number.isFinite(result.breakdown[key])).toBe(true);
    }
  });

  it('reasonKo는 BPM과 매치된 어휘를 담은 사람이 읽는 문장이다 (판정에는 쓰이지 않음 — 반환값 자체가 이미 value로 확정돼 있다)', () => {
    const genre = getGenreById('oldpop-british-beat')!;
    const result = computePerceivedEnergy({ tempo: 109, arrangementDensity: 'medium', instrumentSet: undefined, vocalText: undefined }, genre, policy);
    expect(result.reasonKo).toContain('109 BPM');
  });
});

describe('지시문 23 TASK A — 20260808 팩 재현 (인수 기준)', () => {
  // §A-6 완료 판정의 마지막 항목: "하루가 좋아한 세 곡이 서로 다른 에너지
  // 값으로 나와야 한다. 셋이 같은 값으로 뭉치면 계산이 틀린 것이다." 실제
  // 저장된 20260808 팩 fixture(senior-oldpop, oldpoplounge 채널)의 genreId·
  // stylePrompt 속 BPM만 읽는다 — 손으로 만든 입력이 아니다. arrangementDensity
  // 는 이 구형 fixture에 구조화된 슬롯 데이터가 없어 'medium' 고정(§1-5 원칙
  // 상 genre+tempo만으로도 T2/T6/T13 분리가 되는지가 이 테스트의 핵심 — 실제
  // 배선(batchPreallocation.ts/localGenerator.ts)은 real arrangementDensity를
  // 추가로 반영해 더 정밀하다).
  function perceivedEnergyForTrack(trackNo: number) {
    const song = pack.songs.find(s => s.trackNo === trackNo)!;
    const bpmMatch = song.stylePrompt.match(/(\d{2,3})\s*BPM/);
    const tempo = bpmMatch ? Number(bpmMatch[1]) : 90;
    const genre = getGenreById(song.genreId)!;
    return computePerceivedEnergy({ tempo, arrangementDensity: 'medium', instrumentSet: undefined, vocalText: undefined }, genre, policy);
  }

  it('T13(Suitcase, 109 BPM, british-beat)이 상위권(4 이상)으로 나온다', () => {
    expect(perceivedEnergyForTrack(13).value).toBeGreaterThanOrEqual(4);
  });

  it('T3(Hush Now My Love)·T18(The House Breathes Again, 둘 다 doowop-harmony)이 하위권(2 이하)으로 나온다', () => {
    expect(perceivedEnergyForTrack(3).value).toBeLessThanOrEqual(2);
    expect(perceivedEnergyForTrack(18).value).toBeLessThanOrEqual(2);
  });

  it('하루가 좋았다고 한 T2·T6·T13이 서로 다른 값으로 나온다 — 셋이 뭉치면 계산이 틀린 것', () => {
    const t2 = perceivedEnergyForTrack(2).value;
    const t6 = perceivedEnergyForTrack(6).value;
    const t13 = perceivedEnergyForTrack(13).value;
    expect(new Set([t2, t6, t13]).size).toBe(3);
  });
});

describe('지시문 23 TASK C — 20260808 팩 재현: 인접 곡 급변이 실제로 검출되는가', () => {
  // §1-2 "T3(-7) 바로 뒤 T4(+2)... 작은 파동이 아니라 매 곡 요동이다"의
  // 실제 재현 — 이 fixture의 실제 trackNo 순서로 perceivedEnergy를 계산해
  // TASK C의 인접 곡 급변(차이 ≥3) 감지기에 넣는다.
  it('실제 20260808 순서에서 인접 곡 차이 3 이상인 급변이 검출된다', () => {
    const songs = pack.songs.map(song => {
      const bpmMatch = song.stylePrompt.match(/(\d{2,3})\s*BPM/);
      const tempo = bpmMatch ? Number(bpmMatch[1]) : 90;
      const genre = getGenreById(song.genreId)!;
      const result = computePerceivedEnergy({ tempo, arrangementDensity: 'medium', instrumentSet: undefined, vocalText: undefined }, genre, policy);
      return { trackNo: song.trackNo, perceivedEnergy: result.value } as SongIdea;
    });
    const jumps = perceivedEnergyAdjacentJumps(songs);
    expect(jumps.length).toBeGreaterThan(0);
    // §1-2가 명시한 두 지점 — T3->T4(원문 -7->+2), T13 바로 뒤(원문 T14 -2) —
    // 근처에서 실제로 급변이 잡히는지 확인.
    expect(jumps.some(j => j.fromTrackNo === 3 && j.toTrackNo === 4)).toBe(true);
    expect(jumps.some(j => j.fromTrackNo === 13 && j.toTrackNo === 14)).toBe(true);
  });
});

describe('지시문 23 TASK A — 실제 생성 파이프라인 배선 (새 입력 필드 없음)', () => {
  it('로컬 생성 경로: 18곡 전부 perceivedEnergy가 부여된다', () => {
    const channel = channelPresets.find(c => c.id === 'oldpoplounge') ?? channelPresets[0];
    const opts = makeOptions({ channel, songCount: 18 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason, { usedTitles: [], usedHooks: [] });
    const withEnergy = bp.songs.filter(s => s.perceivedEnergy !== undefined);
    expect(withEnergy.length).toBe(18);
    for (const song of bp.songs) {
      expect(song.perceivedEnergy).toBeGreaterThanOrEqual(1);
      expect(song.perceivedEnergy).toBeLessThanOrEqual(5);
      expect(song.perceivedEnergyReasonKo).toBeTruthy();
    }
  });

  it('18곡 안에서 perceivedEnergy 값이 최소 2종 이상 나온다 (전부 같은 값으로 뭉치지 않음)', () => {
    const channel = channelPresets.find(c => c.id === 'oldpoplounge') ?? channelPresets[0];
    const opts = makeOptions({ channel, songCount: 18 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason, { usedTitles: [], usedHooks: [] });
    const distinctValues = new Set(bp.songs.map(s => s.perceivedEnergy));
    expect(distinctValues.size).toBeGreaterThanOrEqual(2);
  });

  it('realtime/Batch/bridge 경로(preallocateSongSlots)도 슬롯마다 perceivedEnergy를 부여한다', () => {
    const opts = makeOptions({ songCount: 15 });
    const slots = preallocateSongSlots(opts, testGenres);
    expect(slots.every(s => s.perceivedEnergy !== undefined)).toBe(true);
    expect(slots.every(s => Boolean(s.perceivedEnergyReasonKo))).toBe(true);
  });

  it('reconcileWithPreassignedSlot이 슬롯의 perceivedEnergy를 최종 SongIdea로 옮긴다', () => {
    const opts = makeOptions({ songCount: 1 });
    const [slot] = preallocateSongSlots(opts, testGenres);
    const song = reconcileWithPreassignedSlot(baseSong({ trackNo: slot.trackNo }), slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(song.perceivedEnergy).toBe(slot.perceivedEnergy);
    expect(song.perceivedEnergyReasonKo).toBe(slot.perceivedEnergyReasonKo);
  });
});
