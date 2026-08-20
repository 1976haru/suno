import type { SongIdea } from '../types';
import { isEraColorGenreId } from './listeningIntent';
import { ALL_VOCAL_TECHNIQUE_PHRASES, hasVocalTechniqueWord } from '../data/vocalTechniqueByGenre';
import { VOCAL_TECHNIQUE_FAMILIES } from '../data/vocalTechniqueFamilies';

/**
 * 지시문 23 TASK A-5 · TASK C · TASK D — "차단 없음. 감사에 표시만 한다."
 * 이 파일의 모든 함수는 core/fullAudit.ts의 `items: AuditItem[]`(pass/fail이
 * scripts/audit.ts의 회귀 판정·exit code에 반영됨)에 절대 섞이지 않는다 —
 * FullAuditReport.observations라는 별도 필드로만 존재한다. qualityScore에도
 * 반영하지 않는다(§D 완료 판정 "관찰 항목이 blocking하는 건수 0건").
 */

export interface IntensityMismatchEntry {
  trackNo: number;
  perceivedEnergy: number;
  intensity: number;
  diff: number;
}

/** TASK A-5 — |perceivedEnergy - intensity| >= 2인 곡 목록. 차단하지 않는다 — 하루가 듣고 어느 쪽이 맞는지 판정하면 가중치를 조정하는 첫 보정 데이터. */
export function perceivedEnergyIntensityMismatches(songs: SongIdea[]): IntensityMismatchEntry[] {
  const mismatches: IntensityMismatchEntry[] = [];
  for (const song of songs) {
    if (song.perceivedEnergy === undefined || song.intensity === undefined) continue;
    const diff = song.perceivedEnergy - song.intensity;
    if (Math.abs(diff) >= 2) mismatches.push({ trackNo: song.trackNo, perceivedEnergy: song.perceivedEnergy, intensity: song.intensity, diff });
  }
  return mismatches;
}

export interface EnergyJumpEntry {
  fromTrackNo: number;
  toTrackNo: number;
  fromValue: number;
  toValue: number;
  diff: number;
}

/** TASK C-2 — 인접 곡(trackNo 순서) perceivedEnergy 차이 3 이상 = "급변" advisory. */
export function perceivedEnergyAdjacentJumps(songs: SongIdea[]): EnergyJumpEntry[] {
  const ordered = [...songs].filter(s => s.perceivedEnergy !== undefined).sort((a, b) => a.trackNo - b.trackNo);
  const jumps: EnergyJumpEntry[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const cur = ordered[i];
    const diff = (cur.perceivedEnergy as number) - (prev.perceivedEnergy as number);
    if (Math.abs(diff) >= 3) {
      jumps.push({ fromTrackNo: prev.trackNo, toTrackNo: cur.trackNo, fromValue: prev.perceivedEnergy as number, toValue: cur.perceivedEnergy as number, diff });
    }
  }
  return jumps;
}

/** TASK D — chorusStyle(hookRepeat/image/narrative/dialogue) 분포. 하루가 좋아한 3곡이 전부 hookRepeat였다는 관찰(§1-3)의 표본을 세트마다 넓히기 위한 것 — 규칙화하지 않는다. */
export function chorusStyleDistribution(songs: SongIdea[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const song of songs) {
    const key = song.chorusStyle ?? '(미지정)';
    dist[key] = (dist[key] ?? 0) + 1;
  }
  return dist;
}

/** TASK D — 훅 단어 수 분포(하루가 좋아한 3곡의 훅이 3~5단어였다는 관찰, §1-3). */
export function hookWordCountDistribution(songs: SongIdea[]): Record<number, number> {
  const dist: Record<number, number> = {};
  for (const song of songs) {
    if (!song.hookPhrase) continue;
    const count = song.hookPhrase.trim().split(/\s+/).filter(Boolean).length;
    dist[count] = (dist[count] ?? 0) + 1;
  }
  return dist;
}

/** TASK D — 시대색(1950s-60s/1970s, core/listeningIntent.ts's isEraColorGenreId) 장르로 배정된 곡 수. TASK B의 minEraColorTracks 하한이 실제로 채워지는지 세트마다 확인하는 관찰치 — 여기서는 정책과 비교하지 않고 실측 개수만 낸다. */
export function eraColorTrackCount(songs: SongIdea[]): number {
  return songs.filter(s => isEraColorGenreId(s.genreId)).length;
}

/**
 * 지시문 29 (TASK A) — killingPointText/arcPhase는 지시문 26이 reconcileWithPreassignedSlot에
 * 복원한 이후 scripts/audit.ts의 --pack 로딩(loadPackBlueprint가 buildShadowSlotsFromRawSongs로
 * 만든 shadow slot을 거쳐 importSongsJson을 부른다) 경로에서는 실제로 채워지고
 * 있었다 — 그런데 이 수치를 감사 출력 어디에도 인쇄하지 않아서, 26이 정말
 * 효과가 있는지 확인할 방법이 매번 새 디버그 스크립트를 짜는 것뿐이었다.
 * 이미 계산되는 값을 노출하는 것뿐이라 새 관문이 아니다 — pass/fail 판정에
 * 관여하지 않는 관찰 항목으로만 추가한다(§하지 말 것 "새 관문을 추가하지
 * 말 것"). 실측(20260810 세 팩, lyrics/*.json 원본 그대로): 원본 파일 자체에는
 * 이 필드가 아예 없다(사전 임포트 원문이라 당연함) — 이 관찰치는 그 파일을
 * --pack이 실제로 불러올 때 슬롯 재구성을 거친 blueprint.songs 기준이다.
 */
export interface KillingPointCoverage {
  withKillingPointText: number;
  withArcPhase: number;
  total: number;
}

export function killingPointCoverage(songs: SongIdea[]): KillingPointCoverage {
  return {
    withKillingPointText: songs.filter(s => s.killingPointText).length,
    withArcPhase: songs.filter(s => s.arcPhase).length,
    total: songs.length
  };
}

/**
 * 지시문 29 (TASK C-4) — 챗지피티가 제안한 "genreId가 음악 스타일과 주제를
 * 겸한다"는 진단은 옳지만, musicStyleId/contentThemeId로 스키마를 분리하는
 * 건 이 지시문 범위 밖(§하지 말 것)이다. 여기서는 genreId와 lyricTheme을
 * 자동으로 "어긋난다"고 판정하지 않는다 — 둘 사이에 의미 카테고리를 잇는
 * 데이터가 이 코드베이스에 없고, 억지로 키워드 유사도 같은 걸 지어내면
 * 허구 판정이 나온다(예: T7 "터널 콩콩딩동" 가사 vs krkids-dinosaur-parade
 * 테마 — LLM이 배정된 테마와 다른 내용을 쓰고도 테마 메타데이터는 그대로
 * 돌려보낸 것으로 보이는데, 이건 문자열 비교로 잡을 수 없다). 대신 전수
 * 목록만 그대로 내놓아 하루가 직접 판단하게 한다(§C-4 "전수 목록을 보고에
 * 남긴다") — 판정 없는 관찰 항목.
 */
export interface GenreThemePair {
  trackNo: number;
  genreId?: string;
  lyricTheme?: string;
}

export function genreThemePairs(songs: SongIdea[]): GenreThemePair[] {
  return songs
    .filter(s => s.genreId || s.lyricTheme)
    .map(s => ({ trackNo: s.trackNo, genreId: s.genreId, lyricTheme: s.lyricTheme }));
}

/**
 * 지시문 66 (TASK D-2) — "세트 내 창법 중복"(2종 이하 기준)·"창법이 있는
 * 곡"(14/15 기준) 감사 관찰. killingPointCoverage와 같은 원칙: pass/fail에
 * 관여하지 않는 관찰 항목이다(§위 파일 doc comment). withVocalTechniqueWord는
 * VOCAL_TECHNIQUE_VOCAB 어휘 하나라도 포함하면 세는 느슨한 판정
 * (checkVocalTechnique.ts와 동일 함수 재사용, §공통규약 "같은 판정 로직을
 * 두 곳에 두지 않는다"), duplicatedPhraseCount는 이 파일이 아는 전체
 * phrase 코퍼스(65 FAMILY_POOLS ∪ 66 VOCAL_TECHNIQUE_FAMILIES) 중 이 세트의
 * stylePrompt에 정확히 2회 이상 등장한 phrase의 종수 — LLM이 부여받은
 * vocalTechniqueText를 실제로 얼마나 그대로 썼는지(TASK C 효과)의 사후
 * 측정치다.
 */
const ALL_KNOWN_TECHNIQUE_PHRASES: readonly string[] = Array.from(new Set([
  ...ALL_VOCAL_TECHNIQUE_PHRASES,
  ...VOCAL_TECHNIQUE_FAMILIES.flatMap(family => family.techniques)
]));

export interface VocalTechniqueSetObservation {
  withVocalTechniqueWord: number;
  total: number;
  duplicatedPhraseCount: number;
  duplicatedPhrases: string[];
}

export function vocalTechniqueSetObservation(songs: SongIdea[]): VocalTechniqueSetObservation {
  const phraseUsage = new Map<string, number>();
  for (const song of songs) {
    const text = (song.stylePrompt ?? '').toLowerCase();
    if (!text) continue;
    for (const phrase of ALL_KNOWN_TECHNIQUE_PHRASES) {
      if (text.includes(phrase.toLowerCase())) {
        phraseUsage.set(phrase, (phraseUsage.get(phrase) ?? 0) + 1);
      }
    }
  }
  const duplicatedPhrases = [...phraseUsage.entries()].filter(([, count]) => count > 1).map(([phrase]) => phrase);
  return {
    withVocalTechniqueWord: songs.filter(s => hasVocalTechniqueWord(s.stylePrompt ?? '')).length,
    total: songs.length,
    duplicatedPhraseCount: duplicatedPhrases.length,
    duplicatedPhrases
  };
}

export interface PerceivedEnergyObservations {
  intensityMismatches: IntensityMismatchEntry[];
  adjacentJumps: EnergyJumpEntry[];
  chorusStyleDistribution: Record<string, number>;
  hookWordCountDistribution: Record<number, number>;
  eraColorTrackCount: number;
  killingPointCoverage: KillingPointCoverage;
  genreThemePairs: GenreThemePair[];
  vocalTechniqueSetObservation: VocalTechniqueSetObservation;
}

export function buildPerceivedEnergyObservations(songs: SongIdea[]): PerceivedEnergyObservations {
  return {
    intensityMismatches: perceivedEnergyIntensityMismatches(songs),
    adjacentJumps: perceivedEnergyAdjacentJumps(songs),
    chorusStyleDistribution: chorusStyleDistribution(songs),
    hookWordCountDistribution: hookWordCountDistribution(songs),
    eraColorTrackCount: eraColorTrackCount(songs),
    killingPointCoverage: killingPointCoverage(songs),
    genreThemePairs: genreThemePairs(songs),
    vocalTechniqueSetObservation: vocalTechniqueSetObservation(songs)
  };
}
