import type { GenrePack, GenreTraits } from '../types';
import { ERA_FORBIDDEN_DESCRIPTORS, eraBucketForGenreId } from '../data/eraExclusions';

/**
 * v3.65 (TASK C) — "샹송 느낌이 나는 올드팝" is a genre CROSSOVER, not a
 * choice between two genres: the anchor supplies the structural bones
 * (structure, rhythm, era) users don't consciously notice, and the flavor
 * supplies the audible color (instrumentation, harmony) users describe when
 * they say "like X". Concatenating two genres' whole descriptions instead
 * produces exactly the "accordion and 12-string guitar both present"
 * mismatch this module exists to avoid — traits are recombined per axis
 * (see the axis-assignment table in this task's own spec), not merged.
 */
export interface GenreBlend {
  /** Structural bones — structure, rhythm, era. */
  anchorGenreId: string;
  /** Audible color — instrumentation, harmony. */
  flavorGenreId: string;
  flavorStrength: 'light' | 'medium' | 'strong';
}

const FLAVOR_INSTRUMENT_COUNT: Record<GenreBlend['flavorStrength'], number> = {
  light: 1,
  medium: 2,
  strong: 3
};

const DYNAMIC_RANGE_ORDER: GenreTraits['dynamicRange'][] = ['low', 'medium', 'wide'];

function lowerDynamicRange(a: GenreTraits['dynamicRange'], b: GenreTraits['dynamicRange']): GenreTraits['dynamicRange'] {
  return DYNAMIC_RANGE_ORDER[Math.min(DYNAMIC_RANGE_ORDER.indexOf(a), DYNAMIC_RANGE_ORDER.indexOf(b))];
}

function extractEraYear(eraTag: string): number | undefined {
  const match = eraTag.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : undefined;
}

/**
 * TASK C-4 — a 20+ year gap between anchor and flavor eras risks an
 * audible mismatch (1960s anchor + 1980s flavor pulling in synth-pad
 * color that didn't exist yet for the anchor's own era). Returns undefined
 * when either era can't be resolved to an approximate year (e.g. a
 * "timeless" anchor) — nothing to compare, so no warning either way.
 */
export function eraDriftWarning(anchorEraTag: string, flavorEraTag: string): string | undefined {
  const anchorYear = extractEraYear(anchorEraTag);
  const flavorYear = extractEraYear(flavorEraTag);
  if (anchorYear === undefined || flavorYear === undefined) return undefined;
  const diff = Math.abs(anchorYear - flavorYear);
  if (diff < 20) return undefined;
  return `시대 충돌 경고: 앵커(${anchorEraTag})와 플레이버(${flavorEraTag})가 약 ${diff}년 차이입니다 — 시대에 맞지 않는 악기/프로덕션이 섞일 수 있습니다.`;
}

/**
 * TASK C-2/C-4 — recombines two genres' traits per this task's own axis
 * table: structureTraits/rhythmFeel/vocalTraits/eraTag stay anchor
 * (structure strong only mixes in one flavor rhythm item); instrumentation
 * is flavor-first (1/2/3 items by strength, backfilled with anchor);
 * harmonyTraits is flavor; productionTraits follows the anchor except at
 * `strong`, where it becomes flavor too; dynamicRange takes whichever
 * genre is calmer. Any flavor instrumentation item that's anachronistic
 * for the anchor's own era bucket (v3.62's eraExclusions table) is dropped
 * and backfilled from the anchor instead — reusing the detection table
 * already shared by the bridge instruction and compositionScorer.ts,
 * rather than a new, separately-maintained era-safety list.
 *
 * Throws if either genre has no `.traits` — blending needs real
 * axis-separated data on both sides; there's nothing meaningful to
 * recombine from a flat styleCore string on either end.
 */
export function blendGenreTraits(anchor: GenrePack, flavor: GenrePack, strength: GenreBlend['flavorStrength']): GenreTraits {
  const a = anchor.traits;
  const f = flavor.traits;
  if (!a) throw new Error(`blendGenreTraits: anchor genre "${anchor.id}" has no .traits`);
  if (!f) throw new Error(`blendGenreTraits: flavor genre "${flavor.id}" has no .traits`);

  const flavorCount = FLAVOR_INSTRUMENT_COUNT[strength];
  const rawFlavorInstruments = f.instrumentation.slice(0, flavorCount);

  // Era-safety filter (TASK C-4): drop any flavor instrument anachronistic for the anchor's own era bucket.
  const anchorEraBucket = eraBucketForGenreId(anchor.id);
  const forbidden = anchorEraBucket ? ERA_FORBIDDEN_DESCRIPTORS[anchorEraBucket] : [];
  const flavorInstruments = rawFlavorInstruments.filter(item => !forbidden.some(term => item.toLowerCase().includes(term)));
  const droppedCount = rawFlavorInstruments.length - flavorInstruments.length;

  const anchorInstrumentPool = a.instrumentation.filter(item => !flavorInstruments.includes(item));
  const anchorFillCount = Math.max(0, a.instrumentation.length - flavorInstruments.length) + droppedCount;
  const instrumentation = [...flavorInstruments, ...anchorInstrumentPool.slice(0, anchorFillCount)].slice(0, 5);

  const rhythmFeel = strength === 'strong' && f.rhythmFeel.length
    ? [...a.rhythmFeel, f.rhythmFeel[0]].slice(0, 5)
    : [...a.rhythmFeel];

  const productionTraits = strength === 'strong' ? [...f.productionTraits] : [...a.productionTraits];

  return {
    eraTag: a.eraTag,
    instrumentation,
    rhythmFeel,
    harmonyTraits: [...f.harmonyTraits],
    productionTraits,
    vocalTraits: [...a.vocalTraits],
    dynamicRange: lowerDynamicRange(a.dynamicRange, f.dynamicRange),
    structureTraits: [...a.structureTraits]
  };
}
