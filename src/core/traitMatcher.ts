import type { GenrePack, GenreTraits } from '../types';

/**
 * v3.65 (TASK B) — matches an LLM-derived trait profile (a natural-language
 * interpretation of "sounds like Simon & Garfunkel", "chanson-flavored
 * oldpop", etc — built by whatever calls this, e.g. a future v3.63
 * SetDirector integration) against the genre library's own decomposed
 * traits (src/data/genreTraits.ts), so an arbitrary description finds the
 * right genre without needing a fixed artist-name lookup table
 * (src/data/artistReferenceSeeds.ts's 29-entry table can't scale to
 * arbitrary input; this can, because it matches on SOUND, not on
 * recognizing a name).
 */
export interface TraitProfile extends Partial<GenreTraits> {
  /** Per-axis importance override; missing axes fall back to DEFAULT_AXIS_WEIGHTS. */
  weights?: Partial<Record<AxisKey, number>>;
}

export type AxisKey = Exclude<keyof GenreTraits, 'eraTag' | 'dynamicRange'>;

export interface GenreMatch {
  genreId: string;
  score: number;
  axisScores: Partial<Record<AxisKey, number>>;
  /** Korean explanation naming the top 1-2 matching axes' concrete matched terms. */
  whyKo: string;
}

/** TASK B-3's own stated defaults; sums to 1.0. */
export const DEFAULT_AXIS_WEIGHTS: Record<AxisKey, number> = {
  instrumentation: 0.25,
  rhythmFeel: 0.20,
  harmonyTraits: 0.20,
  vocalTraits: 0.15,
  productionTraits: 0.10,
  structureTraits: 0.10
};

const AXIS_LABEL_KO: Record<AxisKey, string> = {
  instrumentation: '악기 편성',
  rhythmFeel: '리듬',
  harmonyTraits: '화성',
  vocalTraits: '보컬',
  productionTraits: '프로덕션',
  structureTraits: '곡 구조'
};

/** TASK B-3 — traits missing entirely from a genre get an estimate from styleCore/instruments/tempoRange, at a 0.8x penalty (see estimateTraitsFromLegacyFields). */
const FALLBACK_ESTIMATE_PENALTY = 0.8;

/** TASK B-3 — era mismatch is a soft penalty, not a hard filter, despite the task's own "필터로 쓰십시오" wording (its own parenthetical clarifies "불일치 시 0.7배 감점"). */
const ERA_MISMATCH_PENALTY = 0.7;

function tokenize(items: readonly string[] | undefined): Set<string> {
  if (!items?.length) return new Set();
  return new Set(items.flatMap(item => item.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)));
}

/**
 * TASK B-3 — plain token-overlap (Jaccard over word sets), not embeddings:
 * "12-string acoustic guitar" vs "12-string guitar" shares {12-string,
 * guitar} out of the union {12-string, acoustic, guitar} = 2/3, a high
 * score despite not being an exact string match. Deliberately simple per
 * this task's own "임베딩 불필요" instruction.
 */
export function tokenOverlap(a: readonly string[] | undefined, b: readonly string[] | undefined): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (!setA.size || !setB.size) return 0;
  const intersection = [...setA].filter(word => setB.has(word)).length;
  const union = new Set([...setA, ...setB]).size;
  return union ? intersection / union : 0;
}

function eraOverlap(profileEra: string | undefined, genreEra: string | undefined): boolean {
  if (!profileEra || !genreEra) return true; // nothing to contradict
  return tokenOverlap([profileEra], [genreEra]) > 0;
}

/**
 * TASK B-3 — a genre with no `.traits` (the other ~260 of 320) still needs
 * to be matchable, just less precisely: styleCore's free text stands in for
 * every text axis at once (it can't really be un-mixed after the fact,
 * which is exactly why TASK A's decomposition is valuable for the genres
 * that do have it), instruments/tempoRange give a real instrumentation/
 * tempo-adjacent signal.
 */
function estimateTraitsFromLegacyFields(genre: GenrePack): GenreTraits {
  const styleCoreAtoms = genre.styleCore.split(',').map(atom => atom.trim()).filter(Boolean);
  return {
    eraTag: genre.eraTag ?? 'timeless',
    instrumentation: genre.instruments,
    rhythmFeel: styleCoreAtoms,
    harmonyTraits: styleCoreAtoms,
    productionTraits: styleCoreAtoms,
    vocalTraits: genre.vocal?.length ? genre.vocal : styleCoreAtoms,
    dynamicRange: 'medium',
    structureTraits: styleCoreAtoms
  };
}

/**
 * TASK B-2/B-3 — scores every candidate against `profile`, returning the
 * top `limit` matches sorted descending. A candidate with no matching axis
 * data anywhere in `profile` scores 0 (never inflated) — see this task's
 * own validation case 5 (an unrelated profile must score low, honestly).
 */
export function matchGenresByTraits(profile: TraitProfile, candidates: GenrePack[], limit = 5): GenreMatch[] {
  const weights = { ...DEFAULT_AXIS_WEIGHTS, ...profile.weights };
  const weightTotal = (Object.values(weights) as number[]).reduce((sum, w) => sum + w, 0) || 1;

  const results: GenreMatch[] = candidates.map(genre => {
    const isEstimated = !genre.traits;
    const traits = genre.traits ?? estimateTraitsFromLegacyFields(genre);

    const axisScores: Partial<Record<AxisKey, number>> = {};
    let weightedSum = 0;
    for (const axis of Object.keys(weights) as AxisKey[]) {
      const profileAxisValue = profile[axis] as string[] | undefined;
      if (!profileAxisValue?.length) continue;
      const score = tokenOverlap(profileAxisValue, traits[axis] as string[]);
      axisScores[axis] = score;
      weightedSum += score * weights[axis];
    }
    let score = weightedSum / weightTotal;

    if (!eraOverlap(profile.eraTag, traits.eraTag)) score *= ERA_MISMATCH_PENALTY;
    if (isEstimated) score *= FALLBACK_ESTIMATE_PENALTY;

    const topAxes = (Object.entries(axisScores) as [AxisKey, number][])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .filter(([, value]) => value > 0);
    const whyKo = topAxes.length
      ? topAxes.map(([axis]) => `${(traits[axis] as string[]).slice(0, 2).join('·')} 등의 ${AXIS_LABEL_KO[axis]}`).join('과(와) ') + '이(가) 일치합니다'
      : '뚜렷하게 일치하는 축이 없습니다';

    return { genreId: genre.id, score: Math.max(0, Math.min(1, score)), axisScores, whyKo };
  });

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
