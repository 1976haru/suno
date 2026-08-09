import type { AxisAllocation, ChannelProfile, GenrePack, PerceivedEnergy } from '../types';
import { representativePerceivedEnergy, isEraColorGenreId } from './listeningIntent';
import { PERCEIVED_ENERGY_POLICY } from '../data/perceivedEnergyPolicy';
import { workspaceForArchetype } from '../data/workspaces';
import { ERA_BUCKETS_BY_GENRE_ID, type EraBucket } from '../data/eraBuckets';

/**
 * 지시문 25 (TASK B) — 하루가 고른 장르 "조합"을 한눈에 보여주는 요약.
 * §B-2 원칙대로 전부 기존 데이터 + 지시문 23의 계산에서 나온다 — 체감
 * 에너지는 representativePerceivedEnergy(computePerceivedEnergy 재사용),
 * 시대색은 listeningIntent.ts의 isEraColorGenreId(지시문 23이 이미 만든
 * 판정)와 eraBuckets.ts의 ERA_BUCKETS_BY_GENRE_ID를 그대로 읽는다 — 새 계산
 * 로직 0개.
 *
 * 조언(§C)은 이 파일이 만들지 않는다 — genreComboAdvisor.ts가 이 요약을
 * 입력으로 받아 별도로 만든다(요약과 조언을 분리한 지시문의 TASK 구조를
 * 그대로 따름).
 */

export interface GenreComboRow {
  genreId: string;
  labelKo: string;
  songCount: number;
  perceivedEnergy: PerceivedEnergy;
  eraBuckets: EraBucket[];
}

export interface GenreComboSummary {
  rows: GenreComboRow[];
  totalSongCount: number;
  /** eraBuckets 값별 곡 수 — 한 장르가 여러 버킷에 걸치면 각 버킷에 그 장르의 songCount를 더한다(버킷이 상호 배타적이지 않으므로 합이 totalSongCount를 넘을 수 있다). */
  eraBucketCounts: Partial<Record<EraBucket, number>>;
  /** isEraColorGenreId(지시문 23) 기준 "시대색이 뚜렷한" 장르에 배정된 곡 수. */
  eraColorSongCount: number;
  eraNoteKo: string;
  energyAvg: number;
  energyMax: PerceivedEnergy;
  energyNoteKo: string;
  tempoMin: number;
  tempoMax: number;
  /** 장르별 tempoRange 중앙값을 songCount만큼 늘어놓은 값의 중앙값 — 실제 개별 곡 BPM이 아니라 장르 대표값 기반 근사치. */
  tempoMedian: number;
  vocalNoteKo?: string;
}

function songCountsForGenres(genres: readonly GenrePack[], songCount: number, diversityAllocations: AxisAllocation[] | undefined): Record<string, number> {
  const manual = diversityAllocations?.find(a => a.axis === 'genre' && a.mode === 'manual');
  if (manual) {
    const counts: Record<string, number> = {};
    for (const genre of genres) counts[genre.id] = manual.counts[genre.id] ?? 0;
    return counts;
  }
  // 수동 배분이 없으면 균등 분배 근사(largest-remainder) — 새 배분 로직을
  // 만들지 않는다, 요약 표시용 근사치일 뿐 실제 생성에는 쓰이지 않는다.
  const counts: Record<string, number> = {};
  if (!genres.length) return counts;
  const base = Math.floor(songCount / genres.length);
  let remainder = songCount - base * genres.length;
  genres.forEach((genre, i) => {
    counts[genre.id] = base + (i < remainder ? 1 : 0);
  });
  return counts;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function energyLevelKo(value: number): string {
  if (value <= 1.5) return '차분한 편';
  if (value <= 2.5) return '잔잔한 편';
  if (value <= 3.5) return '보통';
  if (value <= 4.5) return '활발한 편';
  return '역동적인 편';
}

export function computeGenreComboSummary(
  genres: readonly GenrePack[],
  channel: ChannelProfile,
  songCount: number,
  diversityAllocations: AxisAllocation[] | undefined
): GenreComboSummary {
  const workspaceId = workspaceForArchetype(channel.archetype)?.id ?? 'senior-oldpop';
  const energyPolicy = PERCEIVED_ENERGY_POLICY[workspaceId];
  const counts = songCountsForGenres(genres, songCount, diversityAllocations);

  const rows: GenreComboRow[] = genres.map(genre => ({
    genreId: genre.id,
    labelKo: genre.labelKo ?? genre.label,
    songCount: counts[genre.id] ?? 0,
    perceivedEnergy: representativePerceivedEnergy(genre, energyPolicy),
    eraBuckets: ERA_BUCKETS_BY_GENRE_ID[genre.id] ?? ['era-neutral']
  }));

  const totalSongCount = rows.reduce((sum, r) => sum + r.songCount, 0);

  const eraBucketCounts: Partial<Record<EraBucket, number>> = {};
  let eraColorSongCount = 0;
  for (const row of rows) {
    for (const bucket of row.eraBuckets) {
      eraBucketCounts[bucket] = (eraBucketCounts[bucket] ?? 0) + row.songCount;
    }
    if (isEraColorGenreId(row.genreId)) eraColorSongCount += row.songCount;
  }
  const eraEntries = Object.entries(eraBucketCounts)
    .filter(([bucket]) => bucket !== 'era-neutral')
    .sort((a, b) => a[0].localeCompare(b[0]));
  const eraNoteKo = eraEntries.length
    ? `${eraEntries.map(([bucket, count]) => `${bucket} ${count}곡`).join(' · ')} — ${eraColorSongCount > 0 ? '시대색이 뚜렷합니다' : '시대색이 약합니다'}`
    : '시대색이 뚜렷한 장르가 없습니다';

  const energyAvg = totalSongCount > 0
    ? rows.reduce((sum, r) => sum + r.perceivedEnergy * r.songCount, 0) / totalSongCount
    : 0;
  const energyMax = rows.reduce((max, r) => (r.songCount > 0 && r.perceivedEnergy > max ? r.perceivedEnergy : max), 1 as PerceivedEnergy);
  const energyNoteKo = totalSongCount > 0
    ? `평균 ${energyAvg.toFixed(1)} · 최대 ${energyMax} — 이 채널 기준으로는 ${energyLevelKo(energyAvg)}입니다`
    : '선택된 장르가 없습니다';

  const tempoLows = genres.map(g => g.tempoRange[0]);
  const tempoHighs = genres.map(g => g.tempoRange[1]);
  const tempoMin = tempoLows.length ? Math.min(...tempoLows) : 0;
  const tempoMax = tempoHighs.length ? Math.max(...tempoHighs) : 0;
  const tempoSamples: number[] = [];
  rows.forEach(row => {
    const genre = genres.find(g => g.id === row.genreId);
    if (!genre || row.songCount <= 0) return;
    const mid = (genre.tempoRange[0] + genre.tempoRange[1]) / 2;
    for (let i = 0; i < row.songCount; i++) tempoSamples.push(mid);
  });
  const tempoMedian = Math.round(median(tempoSamples));

  const withVocalPref = genres.filter(g => g.vocalPreference);
  let vocalNoteKo: string | undefined;
  if (withVocalPref.length) {
    let femaleWeight = 0;
    let maleWeight = 0;
    let totalWeight = 0;
    const femaleLeaning: string[] = [];
    const maleLeaning: string[] = [];
    for (const genre of withVocalPref) {
      const pref = genre.vocalPreference!;
      const weight = counts[genre.id] ?? 0;
      femaleWeight += pref.female * weight;
      maleWeight += pref.male * weight;
      totalWeight += weight;
      if (pref.female > pref.male + 0.15) femaleLeaning.push(genre.labelKo ?? genre.label);
      else if (pref.male > pref.female + 0.15) maleLeaning.push(genre.labelKo ?? genre.label);
    }
    if (totalWeight > 0) {
      const leaningNames = femaleWeight >= maleWeight ? femaleLeaning : maleLeaning;
      const leaningLabel = femaleWeight >= maleWeight ? '여성 우세' : '남성 우세';
      vocalNoteKo = leaningNames.length ? `${leaningLabel} (${leaningNames.join('·')})` : `${leaningLabel}`;
    }
  }

  return { rows, totalSongCount, eraBucketCounts, eraColorSongCount, eraNoteKo, energyAvg, energyMax, energyNoteKo, tempoMin, tempoMax, tempoMedian, vocalNoteKo };
}
