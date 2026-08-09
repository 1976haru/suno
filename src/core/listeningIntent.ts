import type { GenrePack, PerceivedEnergy } from '../types';
import { computePerceivedEnergy } from './perceivedEnergy';
import type { PerceivedEnergyPolicy } from '../data/perceivedEnergyPolicy';
import type { ListeningIntentPolicy } from '../data/listeningIntentPolicy';
import { MAX_SELECTED_GENRES } from './genreSelection';
import { eraBucketForGenreId, type EraBucket } from '../data/eraExclusions';

/**
 * "시대색이 뚜렷한" 장르 — §0-1 "60~70년대의 따뜻한 기억"의 실제 기준.
 * eraTag 자유 문자열(§A-2가 경고하는 바로 그 문제 유형)을 다시 파싱하지
 * 않는다 — 지시문 12가 이미 만든 구조화된 EraBucket(core/eraExclusions.ts)을
 * 그대로 읽는다. 1950s-60s/1970s만 "시대색"으로 센다 — 1980s는 §0-1이
 * 명시한 "60~70년대"보다 늦고, 'timeless'/null(jazz-lounge류·adult
 * contemporary 등)은 애초에 시대를 특정하지 않는 장르다.
 */
const ERA_COLOR_BUCKETS: readonly EraBucket[] = ['1950s-60s', '1970s'];

export function isEraColorGenreId(genreId: string | undefined): boolean {
  const bucket = eraBucketForGenreId(genreId);
  return bucket !== null && ERA_COLOR_BUCKETS.includes(bucket);
}

/**
 * 지시문 23 (TASK B) — "청취 목적" preset을 실제 장르 배분(genreIds +
 * diversityAllocations의 manual 'genre' 축)으로 옮긴다. Step2Concept.tsx의
 * "적용" 버튼이 이 함수의 결과를 handleApplyConceptRecommendation과 같은
 * 방식으로 setOpts에 반영한다 — 그래서 이 preset의 효과는 사용자의 명시적
 * 클릭 행동으로만 일어나고(§B-5), 그 뒤 genreIds/diversityAllocations를
 * 손으로 다시 고치면 그 수동 선택이 그대로 남는다(diversityAllocations의
 * manual-always-wins 보장).
 */

/** 이 장르의 "대표" 체감 에너지 — 특정 곡의 실제 tempo/density가 아니라 tempoRange 중앙값 + arrangementDensity 'medium'으로 계산한, 장르 자체의 전형적인 값. 배분 설계(사전 단계)에서만 쓰인다 — 실제 생성 시 각 곡은 core/perceivedEnergy.ts가 그 곡의 진짜 슬롯 값으로 다시 계산한다. */
export function representativePerceivedEnergy(genre: GenrePack, policy: PerceivedEnergyPolicy): PerceivedEnergy {
  const [low, high] = genre.tempoRange;
  const midTempo = Math.round((low + high) / 2);
  return computePerceivedEnergy({ tempo: midTempo, arrangementDensity: 'medium', instrumentSet: undefined, vocalText: undefined }, genre, policy).value;
}

/** songCount=18 기준 energyDistribution을 실제 songCount로 비례 스케일 — largest-remainder 방식(총합이 정확히 songCount가 되도록). */
export function scaleEnergyDistribution(distribution: Record<PerceivedEnergy, number>, songCount: number): Record<PerceivedEnergy, number> {
  const baseTotal = Object.values(distribution).reduce((a, b) => a + b, 0) || 1;
  const levels: PerceivedEnergy[] = [1, 2, 3, 4, 5];
  const raw = levels.map(level => (distribution[level] / baseTotal) * songCount);
  const floored = raw.map(Math.floor);
  let remainder = songCount - floored.reduce((a, b) => a + b, 0);
  const order = levels.map((level, i) => ({ level, frac: raw[i] - floored[i], i })).sort((a, b) => b.frac - a.frac);
  const result = [...floored];
  for (let k = 0; k < order.length && remainder > 0; k++, remainder--) result[order[k].i]++;
  const scaled = {} as Record<PerceivedEnergy, number>;
  levels.forEach((level, i) => { scaled[level] = result[i]; });
  return scaled;
}

export interface ListeningIntentAllocation {
  /** genreIds용 — 최대 MAX_SELECTED_GENRES개. */
  genreIds: string[];
  /** diversityAllocations의 manual 'genre' 축 counts. */
  counts: Record<string, number>;
  /** 실제 배정된, 시대색(1950s-60s/1970s) 장르에 들어간 곡 수 — minEraColorTracks 하한과 비교용. */
  eraColorTrackCount: number;
}

/**
 * candidateGenres(보통 channel.preferredGenres를 GenrePack으로 resolve한
 * 것) 중에서 policy.energyDistribution에 맞춰 최대 MAX_SELECTED_GENRES개
 * 장르를 골라 곡 수를 배분한다. minEraColorTracks 하한(시대색 장르에
 * 배정된 곡 수)을 만족시키지 못하면 마지막에 스왑해서라도 채운다 — 채널
 * 풀에 시대색 장르가 아예 없으면 채우지 못한 채 그대로 반환한다(차단하지
 * 않는다, §B "verified:false가 blocking 0건"과 같은 원칙 — 이 함수도
 * 실패를 조용히 삼키지 않고 eraColorTrackCount로 실측값을 그대로 보고한다).
 */
export function buildGenreAllocationForListeningIntent(
  candidateGenres: readonly GenrePack[],
  policy: ListeningIntentPolicy,
  songCount: number,
  energyPolicy: PerceivedEnergyPolicy
): ListeningIntentAllocation {
  if (!candidateGenres.length || songCount <= 0) return { genreIds: [], counts: {}, eraColorTrackCount: 0 };

  const scored = candidateGenres.map(genre => ({ genre, pe: representativePerceivedEnergy(genre, energyPolicy) }));
  const distribution = scaleEnergyDistribution(policy.energyDistribution, songCount);
  // core/designGate.ts's "같은 장르 최대 곡수" 관문(BREADTH_THRESHOLDS)의
  // 실측 최솟값(variety 등급 4곡)에 맞춘 안전한 상한 — 실제 브라우저 생성으로
  // 확인: 0.28 비율 어림값(반올림 시 6)은 이 관문을 실제로 위반했다
  // (5종 장르·18곡에서 한 장르에 6곡 몰림, 관문 상한은 5). songCount /
  // MAX_SELECTED_GENRES 기반이면 balanced(5)·focused(12) 등급에서도
  // 항상 안전하다.
  const perGenreCap = Math.max(1, Math.ceil(songCount / MAX_SELECTED_GENRES));

  const counts: Record<string, number> = {};
  const usedGenreIds = new Set<string>();

  function pickForBucket(level: PerceivedEnergy): GenrePack | undefined {
    const exact = scored.filter(s => s.pe === level && !usedGenreIds.has(s.genre.id));
    if (exact.length) return exact[0].genre;
    // 정확히 일치하는 후보가 없으면 가장 가까운 레벨로.
    const byDistance = scored
      .filter(s => !usedGenreIds.has(s.genre.id))
      .sort((a, b) => Math.abs(a.pe - level) - Math.abs(b.pe - level));
    return byDistance[0]?.genre;
  }

  /** 이미 고른 장르들에 나머지를 나눠 담는다 — perGenreCap을 절대 넘기지 않는다(장르 하나에 몰리면 designGate의 "같은 장르 최대 곡수" 관문을 실제로 위반한다, 실측 확인). 그래도 남으면(전 장르가 cap 도달) 어쩔 수 없이 가장 가까운 장르에 초과 배정 — MAX_SELECTED_GENRES 상한 안에서 songCount를 다 담아야 하는 마지막 안전판. */
  function spreadRemaining(remaining: number, level: PerceivedEnergy) {
    const byDistance = () => [...usedGenreIds]
      .map(id => scored.find(s => s.genre.id === id)!)
      .sort((a, b) => Math.abs(a.pe - level) - Math.abs(b.pe - level));
    for (const entry of byDistance()) {
      if (remaining <= 0) break;
      const room = perGenreCap - (counts[entry.genre.id] ?? 0);
      if (room <= 0) continue;
      const assign = Math.min(remaining, room);
      counts[entry.genre.id] = (counts[entry.genre.id] ?? 0) + assign;
      remaining -= assign;
    }
    if (remaining > 0) {
      const fallback = byDistance()[0];
      if (fallback) counts[fallback.genre.id] = (counts[fallback.genre.id] ?? 0) + remaining;
    }
  }

  const levels: PerceivedEnergy[] = [1, 2, 3, 4, 5];
  for (const level of levels) {
    let remaining = distribution[level];
    while (remaining > 0 && usedGenreIds.size < MAX_SELECTED_GENRES) {
      const genre = pickForBucket(level);
      if (!genre) break;
      usedGenreIds.add(genre.id);
      const assign = Math.min(remaining, perGenreCap);
      counts[genre.id] = (counts[genre.id] ?? 0) + assign;
      remaining -= assign;
    }
    if (remaining > 0) spreadRemaining(remaining, level);
  }

  // minEraColorTracks 보정 — 시대색 장르에 배정된 곡 수가 하한 미달이면,
  // 시대색 아닌 장르 중 배정량이 가장 큰 것부터 시대색 있는 미사용 후보로
  // 교체(스왑)한다. 채널 풀에 시대색 장르가 없으면 그대로 둔다(§B-4는 하한을
  // "가능하면" 채우라는 것이지, 존재하지 않는 장르를 만들어내라는 게 아니다).
  const eraColorCount = () => Object.entries(counts).reduce((sum, [id, n]) => {
    const g = scored.find(s => s.genre.id === id)?.genre;
    return sum + (isEraColorGenreId(g?.id) ? n : 0);
  }, 0);
  const eraCandidates = scored.filter(s => isEraColorGenreId(s.genre.id) && !usedGenreIds.has(s.genre.id)).sort((a, b) => a.pe - b.pe);
  let guard = 0;
  while (eraColorCount() < policy.minEraColorTracks && eraCandidates.length && guard < MAX_SELECTED_GENRES) {
    const nonEraEntries = Object.entries(counts)
      .filter(([id]) => !isEraColorGenreId(id))
      .sort(([, a], [, b]) => b - a);
    const swapTarget = eraCandidates.shift();
    if (!swapTarget) break;
    if (nonEraEntries.length) {
      const [outId, outCount] = nonEraEntries[0];
      delete counts[outId];
      usedGenreIds.delete(outId);
      counts[swapTarget.genre.id] = outCount;
      usedGenreIds.add(swapTarget.genre.id);
    } else if (usedGenreIds.size < MAX_SELECTED_GENRES) {
      // 전부 이미 era 장르뿐이면(교체 대상 없음) 여유가 있을 때만 추가.
      counts[swapTarget.genre.id] = (counts[swapTarget.genre.id] ?? 0) + 1;
      usedGenreIds.add(swapTarget.genre.id);
      const anyOther = Object.keys(counts).find(id => id !== swapTarget.genre.id && counts[id] > 1);
      if (anyOther) counts[anyOther] -= 1;
    }
    guard++;
  }

  return { genreIds: Object.keys(counts), counts, eraColorTrackCount: eraColorCount() };
}
