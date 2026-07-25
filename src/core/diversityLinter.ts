import { moneyChordPresets } from '../data/moneyChords';
import { vocalPresets } from '../data/vocalPresets';
import { genrePacks } from '../data/presets';
import { getCoreGenreIdsForArchetype } from '../data/genreLibrary';
import { compactGenreKeyword, compactVocalAtom } from './soundSignature';
import type { SavedPack } from '../types';

export type DiversityDimension = 'genre' | 'vocal' | 'moneyChord';

export interface DiversityReport {
  dimension: DiversityDimension;
  totalPresets: number;
  duplicateGroups: string[][];
  genericFallbackCount: number;
  passed: boolean;
}

/**
 * TASK H4 (v3.14) — the exact content-free strings a broken compact*
 * function has historically fallen back to when it failed to extract
 * anything meaningful from a preset (see compactMoneyChord's pre-v3.14
 * regex bug). A preset landing on one of these is a red flag even if it
 * doesn't collide with another preset's output.
 */
const GENERIC_FALLBACKS: Record<DiversityDimension, string[]> = {
  moneyChord: ['money chord progression'],
  vocal: ['soft close-mic vocal', 'soft vocal'],
  genre: ['warm original pop']
};

function presetOutputs(dimension: DiversityDimension): { id: string; output: string }[] {
  if (dimension === 'moneyChord') {
    return Object.values(moneyChordPresets).map(preset => ({ id: preset.id, output: preset.compactProgression }));
  }
  if (dimension === 'vocal') {
    return vocalPresets.map(preset => ({ id: preset.id, output: compactVocalAtom(preset.prompt) }));
  }
  // 'genre' — core-tier genres across both real production archetypes,
  // deduped by id (a genre shared between archetypes' core lists is only
  // checked once).
  const coreIds = new Set([...getCoreGenreIdsForArchetype('senior-morning'), ...getCoreGenreIdsForArchetype('showa-cafe')]);
  const seen = new Set<string>();
  const out: { id: string; output: string }[] = [];
  for (const id of coreIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const genre = genrePacks.find(g => g.id === id);
    if (!genre) continue;
    out.push({ id, output: compactGenreKeyword([genre]) });
  }
  return out;
}

/**
 * TASK H4 (v3.14) — the systemic regression guard this whole file exists
 * for: "changed the preset, but the compacted Suno-facing text is identical
 * (or empty) to another preset" is exactly the bug class that let the
 * moneyChord regression (and, before it, v3.13's instruments/mood drop)
 * ship undetected across multiple releases. This one check catches any
 * future preset addition/edit that collapses this way, without needing a
 * bespoke test per dimension per preset.
 */
export function lintPresetDiversity(dimension: DiversityDimension): DiversityReport {
  const entries = presetOutputs(dimension);
  const byOutput = new Map<string, string[]>();
  for (const entry of entries) {
    const group = byOutput.get(entry.output) ?? [];
    group.push(entry.id);
    byOutput.set(entry.output, group);
  }

  const duplicateGroups = [...byOutput.values()].filter(group => group.length > 1);
  const fallbacks = new Set(GENERIC_FALLBACKS[dimension]);
  const genericFallbackCount = entries.filter(entry => fallbacks.has(entry.output)).length;

  return {
    dimension,
    totalPresets: entries.length,
    duplicateGroups,
    genericFallbackCount,
    passed: duplicateGroups.length === 0 && genericFallbackCount === 0
  };
}

// ---------------------------------------------------------------------------
// TASK v3.39.1 Part B2 — channel-level diversity linter.
//
// Everything above this line checks *static preset data* for accidental
// collisions (the v3.14 regression class). This section checks *actual saved
// output across a channel's real pack history* for a different failure mode
// entirely: real songs/thumbnails that are each individually fine, but whose
// concept/thumbnail-color/title-shape reads as the same repeated template
// pack after pack — precisely the "inauthentic content" pattern the 2026
// enforcement wave is described as targeting (see the strategy review this
// task landed alongside). Deliberately a *reader*, not a generator: nothing
// here rewrites a pack, it only scores/warns so a human can vary the next
// one.
// ---------------------------------------------------------------------------

export interface ChannelDiversitySample {
  packId: string;
  songTitles: string[];
  oneLineConcept: string;
  thumbnailBackground?: string;
  thumbnailComposition?: string;
}

/** Pulls just the fields lintChannelDiversity needs out of a full SavedPack, so the linter itself stays a pure function testable without IndexedDB (same split as core/videoLedger.ts's computeInsights). */
export function sampleFromSavedPack(pack: SavedPack): ChannelDiversitySample {
  return {
    packId: pack.id,
    songTitles: pack.blueprint.songs.map(song => song.title),
    oneLineConcept: pack.blueprint.oneLineConcept,
    thumbnailBackground: pack.thumbnailSpec?.colorScheme.background,
    thumbnailComposition: pack.thumbnailSpec?.composition
  };
}

export type ChannelDiversityCategory = 'thumbnailColor' | 'thumbnailComposition' | 'concept' | 'titleShape';

export interface ChannelDiversityFinding {
  category: ChannelDiversityCategory;
  value: string;
  count: number;
  sampleSize: number;
  ratio: number;
}

export interface ChannelDiversityReport {
  packsChecked: number;
  findings: ChannelDiversityFinding[];
  warnings: string[];
  passed: boolean;
}

/** TASK v3.39.1 Part B2 — a single value repeating in 60%+ of a channel's packs reads as "the same template" to a human reviewer, not coincidence. */
const REPETITION_WARN_RATIO = 0.6;
/** Below this many packs, any repeated value is just as likely to be "the channel only has 2 packs so far" as an actual pattern — never warns on too small a sample. */
const MIN_PACKS_FOR_CHECK = 4;

function mostCommon(values: string[]): { value: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  let best: { value: string; count: number } | null = null;
  for (const [value, count] of counts) {
    if (!best || count > best.count) best = { value, count };
  }
  return best;
}

/**
 * Coarse title "shape" fingerprint — whether it uses the "<Image> & <Word>"
 * contrast shape (see lyricEngine.ts's titleFromHook) and a rough word-count
 * bucket. Not real NLP; just enough to catch "every title in this channel
 * reads the same way" the same way a viewer scrolling the channel would
 * notice it.
 */
function titleShape(title: string): string {
  const hasAmpersand = title.includes(' & ') ? 'amp' : 'plain';
  const wordCount = title.trim().split(/\s+/).filter(Boolean).length;
  const bucket = wordCount <= 2 ? 'short' : wordCount <= 4 ? 'mid' : 'long';
  return `${hasAmpersand}-${bucket}`;
}

const CATEGORY_LABEL: Record<ChannelDiversityCategory, string> = {
  thumbnailColor: 'thumbnail background color',
  thumbnailComposition: 'thumbnail composition',
  concept: 'pack concept line',
  titleShape: 'song title shape'
};

export function lintChannelDiversity(samples: ChannelDiversitySample[]): ChannelDiversityReport {
  const packsChecked = samples.length;
  const findings: ChannelDiversityFinding[] = [];
  const warnings: string[] = [];

  if (packsChecked < MIN_PACKS_FOR_CHECK) {
    return { packsChecked, findings, warnings, passed: true };
  }

  function checkDimension(category: ChannelDiversityCategory, values: string[]) {
    const filled = values.filter(Boolean);
    const top = mostCommon(filled);
    if (!top || !filled.length) return;
    const ratio = top.count / filled.length;
    if (ratio < REPETITION_WARN_RATIO) return;
    findings.push({ category, value: top.value, count: top.count, sampleSize: filled.length, ratio });
    warnings.push(
      `${CATEGORY_LABEL[category]} "${top.value}" repeats in ${top.count}/${filled.length} packs (${Math.round(ratio * 100)}%) — this reads as the same template to a reviewer; vary it more.`
    );
  }

  checkDimension('thumbnailColor', samples.map(s => s.thumbnailBackground || ''));
  checkDimension('thumbnailComposition', samples.map(s => s.thumbnailComposition || ''));
  checkDimension('concept', samples.map(s => s.oneLineConcept));
  // Title shape is scored across every song in every pack (not per-pack),
  // since the point is "does this channel's whole catalog read as one shape".
  checkDimension('titleShape', samples.flatMap(s => s.songTitles.map(titleShape)));

  return { packsChecked, findings, warnings, passed: findings.length === 0 };
}

// ---------------------------------------------------------------------------
// TASK v3.42 Part D — in-pack pairwise style-prompt similarity linter.
//
// Part B2 (v3.40) checks a channel's *cross-pack* history (thumbnail color,
// concept line, title shape) for repeated templates. This checks the
// opposite scope — every song's stylePrompt *within one pack* — for the
// specific failure a real measurement caught: 15 songs in one showa-cafe
// pack averaged 90.3% pairwise style-prompt similarity (one pair hit 100%),
// because only the money-chord roman-numeral tag actually varied between
// songs; genre/mood/instruments/vocal/hook/duration were byte-identical
// across the whole pack. Parts A-C of this same task (instrument/BPM/
// arrangement-density/hook-device/lyric-structure rotation) are the fix;
// this is the regression guard, mirroring the existing preset-diversity
// linter's own "catch it automatically so it never ships silently again"
// purpose (see TASK H4/v3.14's comment above).
// ---------------------------------------------------------------------------

/** Comma-separated clause set, case-insensitive — same atom granularity core/promptBudget.ts's composeStylePrompt itself operates on. */
function stylePromptClauseSet(stylePrompt: string): Set<string> {
  return new Set(
    stylePrompt
      .split(',')
      .map(clause => clause.trim().toLowerCase())
      .filter(Boolean)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let intersection = 0;
  for (const clause of a) if (b.has(clause)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** A pack-wide average above this reads as "every song sounds the same" to a listener — real measurement of the reported bug was 90.3%. */
const IN_PACK_AVG_SIMILARITY_WARN = 0.75;
/**
 * TASK v3.43 Step 2 (Part A4) — the average metric had a warn tier but no
 * error tier of its own (only the per-pair max did); a pack whose average
 * climbs past "reads as near-duplicates" (the warn threshold above) into
 * "every song is basically the same pack-wide" deserves a hard error, not
 * just a warning, independent of whether any single pair also crosses the
 * max-pair threshold below.
 */
const IN_PACK_AVG_SIMILARITY_ERROR = 0.90;
/** Any single pair above this is effectively the same style prompt — real measurement had a pair at 100%. */
const IN_PACK_MAX_SIMILARITY_ERROR = 0.95;

export interface InPackSimilarityPair {
  trackNoA: number;
  trackNoB: number;
  similarity: number;
}

export interface InPackSimilarityReport {
  songCount: number;
  averageSimilarity: number;
  maxSimilarity: number;
  worstPair: InPackSimilarityPair | null;
  /** Clauses present in every single song's stylePrompt — "what's actually fixed across the whole pack", surfaced so a reviewer can see exactly what to vary. */
  commonClauses: string[];
  warnings: string[];
  errors: string[];
  /** No errors (an average above the warn threshold alone doesn't fail — same warn-vs-error split the spec calls for). */
  passed: boolean;
}

export function lintInPackStyleSimilarity(songs: { trackNo: number; stylePrompt: string }[]): InPackSimilarityReport {
  if (songs.length < 2) {
    return { songCount: songs.length, averageSimilarity: 0, maxSimilarity: 0, worstPair: null, commonClauses: [], warnings: [], errors: [], passed: true };
  }

  const entries = songs.map(song => ({ trackNo: song.trackNo, clauses: stylePromptClauseSet(song.stylePrompt) }));
  let total = 0;
  let pairCount = 0;
  let worstPair: InPackSimilarityPair | null = null;

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const similarity = jaccardSimilarity(entries[i].clauses, entries[j].clauses);
      total += similarity;
      pairCount += 1;
      if (!worstPair || similarity > worstPair.similarity) {
        worstPair = { trackNoA: entries[i].trackNo, trackNoB: entries[j].trackNo, similarity };
      }
    }
  }

  const averageSimilarity = pairCount ? total / pairCount : 0;
  const maxSimilarity = worstPair?.similarity ?? 0;
  const commonClauses = [...entries[0].clauses].filter(clause => entries.every(entry => entry.clauses.has(clause)));

  const warnings: string[] = [];
  const errors: string[] = [];
  // TASK v3.43 Step 2 (Part A4) — error and warn are mutually exclusive on
  // the average metric (an average past the error threshold is necessarily
  // also past the warn one, so only the more severe message is shown).
  if (averageSimilarity > IN_PACK_AVG_SIMILARITY_ERROR) {
    errors.push(
      `Average pairwise style-prompt similarity is ${Math.round(averageSimilarity * 100)}% (threshold ${Math.round(IN_PACK_AVG_SIMILARITY_ERROR * 100)}%) — this pack's songs are essentially indistinguishable from each other.`
    );
  } else if (averageSimilarity > IN_PACK_AVG_SIMILARITY_WARN) {
    warnings.push(
      `Average pairwise style-prompt similarity is ${Math.round(averageSimilarity * 100)}% (threshold ${Math.round(IN_PACK_AVG_SIMILARITY_WARN * 100)}%) — this pack's songs read as near-duplicates of each other.`
    );
  }
  if (worstPair && worstPair.similarity > IN_PACK_MAX_SIMILARITY_ERROR) {
    errors.push(
      `Tracks ${worstPair.trackNoA} and ${worstPair.trackNoB} are ${Math.round(worstPair.similarity * 100)}% similar (threshold ${Math.round(IN_PACK_MAX_SIMILARITY_ERROR * 100)}%) — effectively the same style prompt.`
    );
  }

  return { songCount: songs.length, averageSimilarity, maxSimilarity, worstPair, commonClauses, warnings, errors, passed: errors.length === 0 };
}
