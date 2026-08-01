import type { AudioTake } from './audioTakes';

/**
 * TASK v3.74 (TASK G) — "이 문서에서 가장 가치 있는 부분": which take a
 * user adopted vs discarded, across every trackNo that had a real choice, is
 * itself training data — no rating button required. A sign test (count
 * which side is bigger, not by how much) rather than regression/correlation:
 * this task's own "표본이 작을 때 훨씬 정직합니다" — with 18-90 pairs, a
 * regression coefficient would be noise dressed up as precision.
 */

export interface AdoptionInsight {
  metric: string;
  labelKo: string;
  adoptedHigherCount: number;
  totalPairs: number;
  winRate: number;
  meanDelta: number;
  confidence: 'insufficient' | 'weak' | 'moderate' | 'strong';
}

/** TASK v3.74 §7-5 — thresholds specific to pairwise adoption comparisons, deliberately different from ratingAnalysis.ts's rating-count thresholds (5/11/29/30) and audioDirectiveAnalysis.ts's execution-rate thresholds (also 5/11/29/30) — a pair here is a stronger, more direct signal (an actual side-by-side choice) than one rating, so the spec calls for a coarser scale (10/29/59) rather than reusing either. */
const INSUFFICIENT_MAX_PAIRS = 9;
const WEAK_MAX_PAIRS = 29;
const MODERATE_MAX_PAIRS = 59;

export function confidenceForPairCount(n: number): AdoptionInsight['confidence'] {
  if (n <= INSUFFICIENT_MAX_PAIRS) return 'insufficient';
  if (n <= WEAK_MAX_PAIRS) return 'weak';
  if (n <= MODERATE_MAX_PAIRS) return 'moderate';
  return 'strong';
}

/** TASK v3.74 §7-5 — "승률 45~55%는 중립으로 표시하십시오. 유의미하지 않습니다." A display-time rule (not baked into AdoptionInsight itself), exported so every consumer (UI, report) applies the exact same band. */
export const NEUTRAL_WIN_RATE_RANGE: [number, number] = [0.45, 0.55];
export function isNeutralWinRate(winRate: number): boolean {
  return winRate >= NEUTRAL_WIN_RATE_RANGE[0] && winRate <= NEUTRAL_WIN_RATE_RANGE[1];
}

interface AdoptionMetricDef {
  metric: string;
  labelKo: string;
  get: (take: AudioTake) => number;
}

const ADOPTION_METRICS: AdoptionMetricDef[] = [
  { metric: 'dynamicRange', labelKo: '진폭', get: take => take.metrics.dynamicRange },
  { metric: 'peakPosition', labelKo: '후반 상승', get: take => take.metrics.peakPosition },
  { metric: 'durationSec', labelKo: '길이', get: take => take.metrics.durationSec },
  { metric: 'vocalCentroid', labelKo: '보컬 중심', get: take => take.vocalMetrics.vocalCentroid },
  { metric: 'spectralCentroid', labelKo: '전체 밝기', get: take => take.metrics.spectralCentroid },
  { metric: 'overallLevel', labelKo: '음량', get: take => take.metrics.overallLevel }
];

/**
 * Only songs with exactly one adopted take AND at least one non-adopted
 * take count (TASK B's own "채택 표시가 없으면 미결정으로 두고... 선택
 * 기준 분석에만 채택 정보가 필요합니다" — a song with no decision yet
 * contributes nothing here). Each non-adopted take forms its own pair
 * against the adopted one, so a 3-take song (1 adopted + 2 discarded)
 * contributes 2 pairs, not 1.
 */
export function analyzeAdoption(takes: readonly AudioTake[]): AdoptionInsight[] {
  const bySong = new Map<string, AudioTake[]>();
  for (const take of takes) {
    const list = bySong.get(take.songId) ?? [];
    list.push(take);
    bySong.set(take.songId, list);
  }

  const pairsBySong: Array<{ adopted: AudioTake; discarded: AudioTake[] }> = [];
  for (const group of bySong.values()) {
    const adopted = group.filter(take => take.adopted);
    const discarded = group.filter(take => !take.adopted);
    if (adopted.length !== 1 || !discarded.length) continue;
    pairsBySong.push({ adopted: adopted[0], discarded });
  }

  return ADOPTION_METRICS.map(({ metric, labelKo, get }) => {
    let adoptedHigherCount = 0;
    let totalPairs = 0;
    let deltaSum = 0;
    for (const { adopted, discarded } of pairsBySong) {
      for (const other of discarded) {
        const delta = get(adopted) - get(other);
        if (delta === 0) continue; // sign test: exact ties carry no directional signal, excluded from both numerator and denominator
        totalPairs += 1;
        deltaSum += delta;
        if (delta > 0) adoptedHigherCount += 1;
      }
    }
    return {
      metric,
      labelKo,
      adoptedHigherCount,
      totalPairs,
      winRate: totalPairs > 0 ? adoptedHigherCount / totalPairs : 0,
      meanDelta: totalPairs > 0 ? deltaSum / totalPairs : 0,
      confidence: confidenceForPairCount(totalPairs)
    };
  });
}
