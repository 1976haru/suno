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
import { lintInPackStyleSimilarity } from '../src/core/diversityLinter';
import { channelPresets } from '../src/data/presets';
import { genreLibrary } from '../src/data/genreLibrary';
import { GENRE_TRAIT_OVERRIDES } from '../src/data/genreTraits';
import { adultLyricThemes } from '../src/data/lyricThemes';
import { thumbnailArchetypes } from '../src/data/thumbnailArchetypes';
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

  it('최대 쌍별 유사도 — 0.655 기준, 증가 금지(허용 상한 0.665)', () => {
    let max = 0;
    for (let i = 0; i < bp.songs.length; i++) {
      for (let j = i + 1; j < bp.songs.length; j++) {
        max = Math.max(max, jaccard(bp.songs[i].stylePrompt, bp.songs[j].stylePrompt));
      }
    }
    expect(max).toBeLessThanOrEqual(0.665);
  });

  // v4.16 (TASK A) — 13.42 -> ~11.63 (실측): tempoCeiling 112 -> 100 +
  // SENIOR_TEMPO_BANDS re-centered onto the new 7080-referenced range
  // (audienceProfiles.ts). A narrower absolute BPM span (62~100 = 38, was
  // 62~112 = 50) naturally lowers stddev even though the distribution is
  // still well-spread across all 4 bands — still comfortably above the
  // design-gate's own stddevFloor (see core/designGate.ts's BREADTH_THRESHOLDS).
  it('BPM 표준편차 — 11.63 허용 ±0.5', () => {
    const bpms = bp.songs.map(s => s.bpm).filter((b): b is number => typeof b === 'number');
    expect(stddev(bpms)).toBeGreaterThanOrEqual(11.13);
    expect(stddev(bpms)).toBeLessThanOrEqual(12.13);
  });

  it('프롬프트 길이 min/avg/max — 715/786/898 허용 ±20', () => {
    const lengths = bp.songs.map(s => s.stylePrompt.length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    expect(Math.min(...lengths)).toBeGreaterThanOrEqual(695);
    expect(Math.min(...lengths)).toBeLessThanOrEqual(735);
    expect(avg).toBeGreaterThanOrEqual(766);
    expect(avg).toBeLessThanOrEqual(806);
    expect(Math.max(...lengths)).toBeGreaterThanOrEqual(878);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(918);
  });

  it('고유 제목 18/18', () => {
    expect(new Set(bp.songs.map(s => s.title)).size).toBe(18);
  });

  it('senior-morning 코어 장르 40개', () => {
    expect(getCoreGenreIdsForArchetype('senior-morning').length).toBe(40);
  });

  it('oldpop-lounge 코어 장르 63개', () => {
    expect(getCoreGenreIdsForArchetype('oldpop-lounge').length).toBe(63);
  });

  it('showa-cafe / showa-70s / j2000s / city-night 코어 장르 12/4/4/7', () => {
    expect(getCoreGenreIdsForArchetype('showa-cafe').length).toBe(12);
    expect(getCoreGenreIdsForArchetype('showa-70s').length).toBe(4);
    expect(getCoreGenreIdsForArchetype('j2000s').length).toBe(4);
    expect(getCoreGenreIdsForArchetype('city-night').length).toBe(7);
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

  it(`thumbnailArchetypes 기존 ${snapshot.thumbnailArchetypeIds.length}개 id 전부 존재`, () => {
    const currentIds = new Set(thumbnailArchetypes.map(a => a.id));
    const missing = snapshot.thumbnailArchetypeIds.filter(id => !currentIds.has(id));
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
