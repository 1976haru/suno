import type { SongIdea } from '../types';
import { isEraColorGenreId } from './listeningIntent';

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

export interface PerceivedEnergyObservations {
  intensityMismatches: IntensityMismatchEntry[];
  adjacentJumps: EnergyJumpEntry[];
  chorusStyleDistribution: Record<string, number>;
  hookWordCountDistribution: Record<number, number>;
  eraColorTrackCount: number;
}

export function buildPerceivedEnergyObservations(songs: SongIdea[]): PerceivedEnergyObservations {
  return {
    intensityMismatches: perceivedEnergyIntensityMismatches(songs),
    adjacentJumps: perceivedEnergyAdjacentJumps(songs),
    chorusStyleDistribution: chorusStyleDistribution(songs),
    hookWordCountDistribution: hookWordCountDistribution(songs),
    eraColorTrackCount: eraColorTrackCount(songs)
  };
}
