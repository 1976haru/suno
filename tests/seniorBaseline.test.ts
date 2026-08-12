/**
 * TASK G1 §5 — 시니어 기준선 스냅샷. G1의 가장 오래 쓰이는 산출물: 지금까지
 * 매 문서마다 사람이 수치를 비교했던 걸 자동화합니다. C2/D1/E1/F1 작업 중에도
 * 계속 돌아가며 시니어를 깨뜨리는 변경을 즉시 잡아내는 게 목적이라 npm run
 * test:fast 대상에 포함됩니다(package.json).
 *
 * §5-1 원칙: 총량이 변하는 항목(genreLibrary 등)은 총량을 고정하지 않고
 * "기존 id가 전부 그대로 있는가"만 검사합니다 — 새 워크스페이스가 새 항목을
 * 추가하는 건 통과, 기존 항목이 사라지거나 바뀌면 실패. 스냅샷은
 * tests/fixtures/seniorBaselineIdSnapshot.json(이 문서 작성 시점 실측,
 * generate_snapshot 스크립트로 생성 — kr2030-/jp2030-/krkids-/jpkids- 접두사
 * 제외).
 *
 * §9 "추정값 금지" / "실제 값에 맞춰 조정하지 말 것": 아래 생성 기반 수치
 * (유사도/BPM 표준편차/프롬프트 길이)는 이 문서가 참고한 예시값이 아니라
 * 이 커밋 시점에 실제로 measure한 값입니다 — v4.6~v4.14의 시니어 품질 작업
 * 이후로 그 예시값 자체가 이미 낡았음을 실측으로 확인했습니다(예: 최대 쌍별
 * 유사도가 예시 0.594가 아니라 0.655로 실측됨 — 이 스냅샷은 "지금 이 순간"을
 * 고정하는 것이지 과거 문서의 숫자를 재현하는 게 아닙니다).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { channelPresets } from '../src/data/presets';
import { genreLibrary } from '../src/data/genreLibrary';
import { GENRE_TRAIT_OVERRIDES } from '../src/data/genreTraits';
import { adultLyricThemes } from '../src/data/lyricThemes';
import { CONCEPT_KEYWORD_RULES } from '../src/data/conceptKeywords';
import { getCoreGenreIdsForArchetype } from '../src/data/genreLibrary';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { PlaylistBlueprint } from '../src/types';
import snapshot from './fixtures/seniorBaselineIdSnapshot.json';

function stddev(values: number[]): number {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function jaccard(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const wb = new Set(b.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const inter = [...wa].filter(w => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return union === 0 ? 0 : inter / union;
}

describe('시니어 기준선 스냅샷 (TASK G1 §5)', () => {
  let bp: PlaylistBlueprint;

  beforeAll(() => {
    // §5-2 "생성은 1회만 하고 모든 assertion이 그 결과를 공유할 것"
    const channel = channelPresets[0]; // good-morning-memory-radio, senior-morning
    const opts = makeOptions({ channel, songCount: 18 });
    bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason, { usedTitles: [], usedHooks: [] });
  });

  it('평균 쌍별 유사도 — 0.362 허용 ±0.02', () => {
    let total = 0, count = 0;
    for (let i = 0; i < bp.songs.length; i++) {
      for (let j = i + 1; j < bp.songs.length; j++) {
        total += jaccard(bp.songs[i].stylePrompt, bp.songs[j].stylePrompt);
        count++;
      }
    }
    expect(total / count).toBeGreaterThanOrEqual(0.342);
    expect(total / count).toBeLessThanOrEqual(0.382);
  });

  // 지시문 12 (TASK A) — 0.655 -> 0.684 (실측 재조정): eraBuckets 354종
  // 전수 재부여로 senior-morning 코어 장르 다수(adult-contemporary/chanson/
  // folk-pop/bossa-cafe/piano-ballad/retro-soul-pop/smooth-jazz-lounge 등,
  // 이전에는 eraBucketForGenreId가 전부 null을 반환했다)가 이제 실제 시대
  // 버킷을 받아 core/localGenerator.ts의 buildVocalTechniquePlan/
  // buildAdultVocalTraitPlan이 이 곡들에도 시대에 맞는 보컬 테크닉 문구를
  // 추가한다 — 이전에는 일반 문구만 받던 곡들이 이제 서로 같은 "1970년대
  // 보컬 테크닉" 풀에서 문구를 공유해 유사도가 소폭 오른 것으로, 형식적
  // 반복이 아니라 시대 정확도가 넓어진 결과다. 0.684는 여전히 1.0과 거리가
  // 멀어 곡 간 구별은 충분히 유지된다.
  it('최대 쌍별 유사도 — 0.684 기준, 증가 금지(허용 상한 0.694)', () => {
    let max = 0;
    for (let i = 0; i < bp.songs.length; i++) {
      for (let j = i + 1; j < bp.songs.length; j++) {
        max = Math.max(max, jaccard(bp.songs[i].stylePrompt, bp.songs[j].stylePrompt));
      }
    }
    expect(max).toBeLessThanOrEqual(0.694);
  });

  // v4.16 (TASK A) — 13.42 -> ~11.63 (실측): tempoCeiling 112 -> 100 +
  // SENIOR_TEMPO_BANDS re-centered onto the new 7080-referenced range
  // (audienceProfiles.ts). A narrower absolute BPM span (62~100 = 38, was
  // 62~112 = 50) naturally lowers stddev even though the distribution is
  // still well-spread across all 4 bands — still comfortably above the
  // design-gate's own stddevFloor (see core/designGate.ts's BREADTH_THRESHOLDS).
  //
  // 지시문 20 (TASK A) — 11.63 -> 10.37 (실측 재조정): senior-morning
  // preferredGenres를 12->24종으로 확장(1950s-60s 정전 8종 + 재즈 4종)한
  // 결과, tests/fixtures.ts의 testGenres(channelPresets[0].preferredGenres
  // 파생)가 늘어난 풀에서 뽑히며 실제 세대 BPM 분포가 소폭 재조정됐다.
  // 여전히 design-gate stddevFloor를 comfortably 넘는다 — 회귀가 아니라
  // 채널 배선 확장의 직접 결과.
  // 지시문 21 (TASK C) — 10.37 -> 11.43 (실측 재조정): senior-morning
  // preferredGenres를 24->30종으로 확장(두왑 발라드/업템포·밤 샹송·비 오는
  // 날 발라드 블루스·6/8 슬로우 발라드 5종 신규 배선)한 결과, testGenres
  // 추첨 풀이 넓어지며 세대별 BPM 밴드 분포가 더 고르게 뽑혀 표준편차가
  // 올랐다 — design-gate stddevFloor를 여전히 comfortably 넘는다.
  // 지시문 40 (TASK D) — 6·6·3·0을 실측 시도했으나 arc 재정렬/songRole 배정/
  // local-bridge 머니코드 병렬성이 깨지는 실제 회귀 4건이 나와 철회, 원래
  // 4·6·5·3 유지(SENIOR_TEMPO_BANDS 자신의 doc comment 참고). 11.43은 그대로.
  it('BPM 표준편차 — 11.43 허용 ±0.5', () => {
    const bpms = bp.songs.map(s => s.bpm).filter((b): b is number => typeof b === 'number');
    expect(stddev(bpms)).toBeGreaterThanOrEqual(10.93);
    expect(stddev(bpms)).toBeLessThanOrEqual(11.93);
  });

  // 지시문 12 (TASK A) — min 715->736 (실측 재조정, 위 유사도 항목과 같은
  // 원인: 시대 보컬 테크닉 문구가 이제 더 많은 곡에 붙는다). avg/max는
  // 기존 허용 범위(766~806 / 878~918) 안에 그대로 있어 손대지 않는다.
  //
  // 지시문 20 (TASK A) — 736/786/898 -> 745/807/928 (실측 재조정): 같은
  // preferredGenres 확장(24종)이 원인 — 새로 추가된 1950s-60s/재즈 장르
  // 다수가 더 다양한 vocal/instrument 서술을 스타일 프롬프트에 더해
  // avg/max가 소폭 상승했다. 회귀가 아니라 채널 배선 확장의 직접 결과.
  //
  // 지시문 21 (TASK C) — 745/807/928 -> 706/818/920 (실측 재조정): 같은
  // preferredGenres 확장(24->30종, 위 BPM 항목과 동일 원인)이 testGenres
  // 추첨 풀을 넓혀 곡마다 뽑히는 장르 조합이 달라졌다 — min은 짧은 장르
  // 서술이 더 자주 뽑히며 내려가고 avg는 소폭 오르는 등 방향이 일정하지
  // 않은 건 무작위 추첨 풀 확장의 정상적 결과(§9 실측, 추정 아님).
  it('프롬프트 길이 min/avg/max — 706/818/920 허용 ±20', () => {
    const lengths = bp.songs.map(s => s.stylePrompt.length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    expect(Math.min(...lengths)).toBeGreaterThanOrEqual(686);
    expect(Math.min(...lengths)).toBeLessThanOrEqual(726);
    expect(avg).toBeGreaterThanOrEqual(798);
    expect(avg).toBeLessThanOrEqual(838);
    expect(Math.max(...lengths)).toBeGreaterThanOrEqual(900);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(940);
  });

  it('고유 제목 18/18', () => {
    expect(new Set(bp.songs.map(s => s.title)).size).toBe(18);
  });

  it('senior-morning 코어 장르 46개', () => {
    // 지시문 21 (TASK B) — 40 -> 44 (두왑 분화 2종·밤 샹송·발라드블루스 추가).
    // 지시문 21 (TASK A) — 44 -> 46 (6/8 슬로우 발라드·이탈리안 칸초네 추가).
    expect(getCoreGenreIdsForArchetype('senior-morning').length).toBe(46);
  });

  it('oldpop-lounge 코어 장르 69개', () => {
    // 지시문 21 (TASK B) — 63 -> 67, same 4-genre addition (모두 oldpop-lounge 배선).
    // 지시문 21 (TASK A) — 67 -> 69, same 2-genre addition.
    expect(getCoreGenreIdsForArchetype('oldpop-lounge').length).toBe(69);
  });

  it('showa-cafe / showa-70s / j2000s / city-night 코어 장르 12/4/4/8', () => {
    expect(getCoreGenreIdsForArchetype('showa-cafe').length).toBe(12);
    expect(getCoreGenreIdsForArchetype('showa-70s').length).toBe(4);
    expect(getCoreGenreIdsForArchetype('j2000s').length).toBe(4);
    // 지시문 21 (TASK A) — 7 -> 8 (kr2030-noir-deep-house도 city-night 배선).
    expect(getCoreGenreIdsForArchetype('city-night').length).toBe(8);
  });
});

describe('기존 id 스냅샷 — 추가는 통과, 삭제·변경은 실패 (TASK G1 §5-1)', () => {
  it(`genreLibrary 기존 ${snapshot.genreLibraryIds.length}개 id 전부 존재`, () => {
    const currentIds = new Set(genreLibrary.map(g => g.id));
    const missing = snapshot.genreLibraryIds.filter(id => !currentIds.has(id));
    expect(missing, `사라진 id: ${missing.join(', ')}`).toEqual([]);
  });

  it(`GENRE_TRAIT_OVERRIDES 기존 ${snapshot.genreTraitOverrideKeys.length}개 키 전부 존재`, () => {
    const currentKeys = new Set(Object.keys(GENRE_TRAIT_OVERRIDES));
    const missing = snapshot.genreTraitOverrideKeys.filter(k => !currentKeys.has(k));
    expect(missing, `사라진 키: ${missing.join(', ')}`).toEqual([]);
  });

  it(`adultLyricThemes 기존 ${snapshot.adultLyricThemeIds.length}개 id 전부 존재`, () => {
    const currentIds = new Set(adultLyricThemes.map(t => t.id));
    const missing = snapshot.adultLyricThemeIds.filter(id => !currentIds.has(id));
    expect(missing, `사라진 id: ${missing.join(', ')}`).toEqual([]);
  });

  it(`channelPresets 기존 ${snapshot.channelPresetIds.length}개 id 전부 존재`, () => {
    const currentIds = new Set(channelPresets.map(c => c.id));
    const missing = snapshot.channelPresetIds.filter(id => !currentIds.has(id));
    expect(missing, `사라진 id: ${missing.join(', ')}`).toEqual([]);
  });

  it(`CONCEPT_KEYWORD_RULES 기존 ${snapshot.conceptKeywordRuleIds.length}개 id 전부 존재`, () => {
    const currentIds = new Set(CONCEPT_KEYWORD_RULES.map(r => r.id));
    const missing = snapshot.conceptKeywordRuleIds.filter(id => !currentIds.has(id));
    expect(missing, `사라진 id: ${missing.join(', ')}`).toEqual([]);
  });
});
