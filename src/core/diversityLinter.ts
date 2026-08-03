import { moneyChordPresets } from '../data/moneyChords';
import { vocalPresets } from '../data/vocalPresets';
import { genrePacks } from '../data/presets';
import { getCoreGenreIdsForArchetype } from '../data/genreLibrary';
import { compactGenreKeyword, compactVocalAtom } from './soundSignature';
import { CHANNEL_SOUND_FLOORS } from '../data/channelSoundFloor';
import type { SavedPack } from '../types';

// TASK v4.7 (TASK A, §1-4) — "공유 원자 검사(<= 5개)에서 이 3개는 예외 처리
//하십시오." channelSoundFloor.requiredAtoms are DELIBERATELY identical in
// every song (that's the whole point — a floor the concept can't remove),
// so counting them as "suspicious cross-song similarity" would be exactly
// the same false positive this file's own doc comment above already
// describes for BPM/vocal/progression/hook boilerplate.
const SOUND_FLOOR_REQUIRED_ATOMS = new Set(CHANNEL_SOUND_FLOORS.flatMap(floor => floor.requiredAtoms.map(atom => atom.toLowerCase())));

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
  const trimmed = (title || '').trim();
  if (!trimmed) return '';
  const hasAmpersand = trimmed.includes(' & ') ? 'amp' : 'plain';
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
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
      // Required identity/control atoms are checked separately. Counting them
      // as musical similarity made every senior-morning song look alike even
      // when genre, arrangement, concept, and delivery cues differed.
      .filter(clause => !/^\d{2,3} bpm$/.test(clause))
      .filter(clause => !/repeats chorus|repeated chorus hook|same channel vocal signature/.test(clause))
      .filter(clause => !/\b(vocal|voice|tenor|alto|soprano|choir|singer)\b/.test(clause))
      .filter(clause => !/progression|3:10-3:35|short intro|radio edit|complete song/.test(clause))
      .filter(clause => !/^concept (cue|emphasis):/.test(clause))
      .filter(clause => !/hook heard immediately|intro only|arrangement with strings pad|nostalgic$/.test(clause))
      .filter(clause => !SOUND_FLOOR_REQUIRED_ATOMS.has(clause))
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

/**
 * TASK v3.58 (TASK 7-6) — lowered 0.75 -> 0.35. The original 0.75/0.90 pair
 * was calibrated against the reported 90.3%-average bug and never fired
 * again once that bug was fixed, even while a real measured 37-53% shared-
 * atom ratio (see sharedAtomRatio below) sat comfortably under both
 * thresholds with zero warnings. A pack-level genre signature/audience
 * identity being shared is expected (see commonClauses' own comment above),
 * but the remaining, non-common musical material still reading 35%+ similar
 * pairwise is worth a warning, not silence.
 */
const IN_PACK_AVG_SIMILARITY_WARN = 0.35;
/**
 * TASK v3.43 Step 2 (Part A4) — the average metric had a warn tier but no
 * error tier of its own (only the per-pair max did); a pack whose average
 * climbs past "reads as near-duplicates" (the warn threshold above) into
 * "every song is basically the same pack-wide" deserves a hard error, not
 * just a warning, independent of whether any single pair also crosses the
 * max-pair threshold below.
 */
// TASK v3.58 (TASK 7-6) — lowered 0.90 -> 0.50, same reasoning as the warn
// threshold above.
const IN_PACK_AVG_SIMILARITY_ERROR = 0.50;
/** Any single pair above this is effectively the same style prompt — real measurement had a pair at 100%. */
const IN_PACK_MAX_SIMILARITY_ERROR = 0.95;

/**
 * TASK v3.58 (TASK 7-6) — commonClauses (the pack-wide shared-identity
 * boilerplate excluded before measuring per-song similarity) used to be
 * returned with no threshold of its own: the more boilerplate a pack had,
 * the more got excluded from the similarity measurement, and the *better*
 * the reported similarity score looked — a real measured 37-53% shared-atom
 * ratio produced zero warnings under the old thresholds. sharedAtomRatio
 * makes the exclusion itself an inspectable, threshold-checked number
 * instead of a silent side effect.
 */
const SHARED_ATOM_RATIO_WARN = 0.30;
const SHARED_ATOM_RATIO_ERROR = 0.45;

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
  /** TASK v3.58 (TASK 7-6) — commonClauses.length. */
  sharedAtomCount: number;
  /** TASK v3.58 (TASK 7-6) — total character length of commonClauses (comma-joined). */
  sharedAtomChars: number;
  /** TASK v3.58 (TASK 7-6) — sharedAtomChars / average stylePrompt length across the pack; the fraction of an average song's prompt that's pack-wide boilerplate rather than per-song musical material. */
  sharedAtomRatio: number;
  /** Vocal-description openings repeated three or more times in one pack. */
  repeatedVocalStarts: { start: string; count: number; trackNos: number[] }[];
  warnings: string[];
  errors: string[];
  /** No errors (an average above the warn threshold alone doesn't fail — same warn-vs-error split the spec calls for). */
  passed: boolean;
}

export function lintInPackStyleSimilarity(songs: { trackNo: number; stylePrompt: string }[]): InPackSimilarityReport {
  if (songs.length < 2) {
    return { songCount: songs.length, averageSimilarity: 0, maxSimilarity: 0, worstPair: null, commonClauses: [], sharedAtomCount: 0, sharedAtomChars: 0, sharedAtomRatio: 0, repeatedVocalStarts: [], warnings: [], errors: [], passed: true };
  }

  const rawEntries = songs.map(song => ({ trackNo: song.trackNo, clauses: stylePromptClauseSet(song.stylePrompt) }));
  const commonClauses = [...rawEntries[0].clauses].filter(clause => rawEntries.every(entry => entry.clauses.has(clause)));
  // A pack-level genre signature is intentionally shared identity, not
  // evidence that two individual arrangements are the same. Remove clauses
  // common to every track before measuring the varying musical material.
  const commonSet = new Set(commonClauses);
  const entries = rawEntries.map(entry => ({
    trackNo: entry.trackNo,
    clauses: new Set([...entry.clauses].filter(clause => !commonSet.has(clause)))
  }));
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

  // TASK v3.58 (TASK 7-6) — the exclusion above (commonSet) is itself now a
  // measured, threshold-checked quantity: the more pack-wide boilerplate a
  // song's stylePrompt carries, the less of it is actually per-song musical
  // material, regardless of how similar that remaining material measures.
  const sharedAtomCount = commonClauses.length;
  const sharedAtomChars = commonClauses.join(', ').length;
  const avgPromptLength = songs.reduce((sum, song) => sum + song.stylePrompt.length, 0) / songs.length;
  const sharedAtomRatio = avgPromptLength > 0 ? sharedAtomChars / avgPromptLength : 0;

  const vocalStartBuckets = new Map<string, number[]>();
  songs.forEach(song => {
    const start = song.stylePrompt.split(',').slice(0, 3).map(clause => clause.trim()).find(clause => /\b(vocal|voice|tenor|alto|soprano|choir|singer)\b/i.test(clause));
    if (!start) return;
    const key = start.toLowerCase().replace(/\s+/g, ' ').trim();
    vocalStartBuckets.set(key, [...(vocalStartBuckets.get(key) || []), song.trackNo]);
  });
  const repeatedVocalStarts = [...vocalStartBuckets.entries()]
    .filter(([, trackNos]) => trackNos.length >= 3)
    .map(([start, trackNos]) => ({ start, count: trackNos.length, trackNos }));

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
  repeatedVocalStarts.forEach(entry => {
    warnings.push(`Vocal description starts with "${entry.start}" on ${entry.count} tracks (${entry.trackNos.join(', ')}); vary delivery wording while keeping the channel identity.`);
  });

  // TASK v3.58 (TASK 7-6) — same warn/error split as the average-similarity
  // metric above, plus the 5 longest shared clauses so a reviewer sees
  // exactly what to vary without having to dig through commonClauses itself.
  if (sharedAtomRatio > SHARED_ATOM_RATIO_WARN || sharedAtomRatio > SHARED_ATOM_RATIO_ERROR) {
    const longestShared = [...commonClauses].sort((a, b) => b.length - a.length).slice(0, 5);
    const detail = longestShared.length
      ? ` Longest shared clauses: ${longestShared.map(clause => `"${clause}" (${clause.length} chars)`).join(', ')}.`
      : '';
    const message = `Shared (pack-wide, non-varying) prompt content is ${Math.round(sharedAtomRatio * 100)}% of an average song's style prompt.${detail}`;
    if (sharedAtomRatio > SHARED_ATOM_RATIO_ERROR) {
      errors.push(`${message} (error threshold ${Math.round(SHARED_ATOM_RATIO_ERROR * 100)}%)`);
    } else {
      warnings.push(`${message} (warn threshold ${Math.round(SHARED_ATOM_RATIO_WARN * 100)}%)`);
    }
  }

  return {
    songCount: songs.length,
    averageSimilarity,
    maxSimilarity,
    worstPair,
    commonClauses,
    sharedAtomCount,
    sharedAtomChars,
    sharedAtomRatio,
    repeatedVocalStarts,
    warnings,
    errors,
    passed: errors.length === 0
  };
}

// ---------------------------------------------------------------------------
// v3.47 Step 2: lyric-side in-pack diversity linter.
// ---------------------------------------------------------------------------

export interface RepeatedLyricPattern {
  pattern: string;
  count: number;
  trackNos: number[];
}

export interface InPackLyricDiversityReport {
  songCount: number;
  averageVocabularyOverlap: number;
  maxVocabularyOverlap: number;
  worstPair: InPackSimilarityPair | null;
  repeatedFirstLinePatterns: RepeatedLyricPattern[];
  repeatedChorusStructures: RepeatedLyricPattern[];
  /** TASK v3.60 (TASK D-1) — which chorus lines are the hookPhrase (H) vs not (x), e.g. "HxHxxxH", repeated across the pack. */
  repeatedChorusHookPatterns: RepeatedLyricPattern[];
  /** TASK v3.60 (TASK D-2) — lintChannelDiversity's own titleShape fingerprint, repeated within this one pack. */
  repeatedTitleShapes: RepeatedLyricPattern[];
  warnings: string[];
  errors: string[];
  passed: boolean;
}

const LYRIC_VOCAB_OVERLAP_WARN = 0.68;
const LYRIC_VOCAB_OVERLAP_ERROR = 0.86;
const LYRIC_PATTERN_REPEAT_WARN_RATIO = 0.45;

const LYRIC_STOPWORDS = new Set([
  'the', 'and', 'you', 'your', 'with', 'that', 'this', 'from', 'into', 'for',
  'are', 'was', 'were', 'have', 'has', 'had', 'but', 'not', 'all', 'our',
  'my', 'me', 'we', 'us', 'it', 'in', 'on', 'to', 'of', 'a', 'an', 'i'
]);

function lyricContentLines(lyrics: string): string[] {
  return String(lyrics || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !/^\[[^\]]+\]$/.test(line));
}

function lyricTokenSet(lyrics: string): Set<string> {
  const tokens = String(lyrics || '')
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, ' ')
    .match(/[\p{L}\p{N}']+/gu) || [];
  return new Set(tokens.filter(token => token.length > 2 && !LYRIC_STOPWORDS.has(token)));
}

function lineShape(line: string): string {
  const tokens = line.toLowerCase().match(/[\p{L}\p{N}']+/gu) || [];
  const bucket = tokens.length <= 4 ? 'short' : tokens.length <= 8 ? 'mid' : 'long';
  const endings = /[?!]$/.test(line.trim()) ? 'marked' : 'plain';
  const sizes = tokens.slice(0, 4).map(token => token.length <= 3 ? 's' : token.length <= 6 ? 'm' : 'l').join('-');
  return `${bucket}:${endings}:${sizes}`;
}

function firstLyricLinePattern(lyrics: string): string {
  const first = lyricContentLines(lyrics)[0];
  return first ? lineShape(first) : '';
}

function firstChorusStructure(lyrics: string): string {
  const lines = String(lyrics || '').split(/\r?\n/);
  const start = lines.findIndex(line => /^\[(?:final\s+)?chorus[^\]]*\]/i.test(line.trim()));
  if (start < 0) return '';
  const chorusLines: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^\[[^\]]+\]$/.test(line)) break;
    if (line) chorusLines.push(line);
    if (chorusLines.length >= 3) break;
  }
  return chorusLines.map(lineShape).join('|');
}

/**
 * TASK v3.60 (TASK D-1) — firstChorusStructure above buckets chorus lines by
 * a coarse length/punctuation/word-size fingerprint; a real 17-song bridge
 * pack measured 0 repeats under that metric even though every single chorus
 * actually shared the identical hook-repetition shape (hook/line/hook/line/
 * line/line/hook, i.e. "HxHxxxH") — T1-T5's structure templates only fix
 * section ORDER, never how many times the hook repeats within a chorus or
 * where. This is a different, more specific signal: which chorus lines
 * literally are the hookPhrase versus not, symbolized H/x per line.
 */
function chorusHookPattern(lyrics: string, hookPhrase: string | undefined): string {
  if (!hookPhrase) return '';
  const lines = String(lyrics || '').split(/\r?\n/);
  const start = lines.findIndex(line => /^\[(?:final\s+)?chorus[^\]]*\]/i.test(line.trim()));
  if (start < 0) return '';
  const hook = hookPhrase.trim().toLowerCase();
  const chorusLines: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^\[[^\]]+\]$/.test(line)) break;
    if (line) chorusLines.push(line);
  }
  if (!chorusLines.length) return '';
  return chorusLines.map(line => (line.toLowerCase() === hook ? 'H' : 'x')).join('');
}

/**
 * TASK v3.60 (TASK D-2) — reuses lintChannelDiversity's own titleShape
 * fingerprint (word-count bucket + ampersand-contrast shape) at in-pack
 * scope instead of only cross-pack scope: a real 17-song bridge pack had
 * every single title land in the same "plain-short" bucket (bare 1-2 word
 * noun pairs — "Tableglow", "Steam Radio", "Porch Ember", ...) despite the
 * bridge instruction already saying "never the same shape for every song".
 */
function repeatedPatterns(entries: { trackNo: number; pattern: string }[], songCount: number): RepeatedLyricPattern[] {
  const byPattern = new Map<string, number[]>();
  for (const entry of entries) {
    if (!entry.pattern) continue;
    byPattern.set(entry.pattern, [...(byPattern.get(entry.pattern) || []), entry.trackNo]);
  }
  return [...byPattern.entries()]
    .filter(([, trackNos]) => trackNos.length > 1 && trackNos.length / Math.max(1, songCount) >= LYRIC_PATTERN_REPEAT_WARN_RATIO)
    .map(([pattern, trackNos]) => ({ pattern, count: trackNos.length, trackNos }));
}

export function lintInPackLyricDiversity(songs: { trackNo: number; lyrics: string; hookPhrase?: string; title?: string }[]): InPackLyricDiversityReport {
  if (songs.length < 2) {
    return {
      songCount: songs.length,
      averageVocabularyOverlap: 0,
      maxVocabularyOverlap: 0,
      worstPair: null,
      repeatedFirstLinePatterns: [],
      repeatedChorusStructures: [],
      repeatedChorusHookPatterns: [],
      repeatedTitleShapes: [],
      warnings: [],
      errors: [],
      passed: true
    };
  }

  const entries = songs.map(song => ({
    trackNo: song.trackNo,
    vocabulary: lyricTokenSet(song.lyrics),
    firstLinePattern: firstLyricLinePattern(song.lyrics),
    chorusStructure: firstChorusStructure(song.lyrics),
    chorusHookPattern: chorusHookPattern(song.lyrics, song.hookPhrase),
    titleShapePattern: titleShape(song.title || '')
  }));

  let total = 0;
  let pairCount = 0;
  let worstPair: InPackSimilarityPair | null = null;
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const similarity = jaccardSimilarity(entries[i].vocabulary, entries[j].vocabulary);
      total += similarity;
      pairCount += 1;
      if (!worstPair || similarity > worstPair.similarity) {
        worstPair = { trackNoA: entries[i].trackNo, trackNoB: entries[j].trackNo, similarity };
      }
    }
  }

  const averageVocabularyOverlap = pairCount ? total / pairCount : 0;
  const maxVocabularyOverlap = worstPair?.similarity ?? 0;
  const repeatedFirstLinePatterns = repeatedPatterns(entries.map(entry => ({ trackNo: entry.trackNo, pattern: entry.firstLinePattern })), songs.length);
  const repeatedChorusStructures = repeatedPatterns(entries.map(entry => ({ trackNo: entry.trackNo, pattern: entry.chorusStructure })), songs.length);
  const repeatedChorusHookPatterns = repeatedPatterns(entries.map(entry => ({ trackNo: entry.trackNo, pattern: entry.chorusHookPattern })), songs.length);
  const repeatedTitleShapes = repeatedPatterns(entries.map(entry => ({ trackNo: entry.trackNo, pattern: entry.titleShapePattern })), songs.length);

  const warnings: string[] = [];
  const errors: string[] = [];
  if (averageVocabularyOverlap > LYRIC_VOCAB_OVERLAP_ERROR) {
    errors.push(`Average pairwise lyric vocabulary overlap is ${Math.round(averageVocabularyOverlap * 100)}% (threshold ${Math.round(LYRIC_VOCAB_OVERLAP_ERROR * 100)}%) - this pack's lyrics are essentially repeating one vocabulary set.`);
  } else if (averageVocabularyOverlap > LYRIC_VOCAB_OVERLAP_WARN) {
    warnings.push(`Average pairwise lyric vocabulary overlap is ${Math.round(averageVocabularyOverlap * 100)}% (threshold ${Math.round(LYRIC_VOCAB_OVERLAP_WARN * 100)}%) - vary scenes, objects, and verbs more.`);
  }
  if (repeatedFirstLinePatterns.length) {
    warnings.push(`First-line lyric patterns repeat across ${repeatedFirstLinePatterns[0].count}/${songs.length} songs (tracks ${repeatedFirstLinePatterns[0].trackNos.join(', ')}) - vary the opening sentence shape.`);
  }
  if (repeatedChorusStructures.length) {
    warnings.push(`Chorus sentence structures repeat across ${repeatedChorusStructures[0].count}/${songs.length} songs (tracks ${repeatedChorusStructures[0].trackNos.join(', ')}) - vary the chorus support lines around the hook.`);
  }
  // TASK v3.60 (TASK D-1) — same class of check as repeatedChorusStructures
  // just above, but on the hook-repetition shape (which chorus lines are the
  // hookPhrase itself) rather than a generic line-length fingerprint; a real
  // pack shared the identical "HxHxxxH" shape on every single track.
  if (repeatedChorusHookPatterns.length) {
    warnings.push(`Chorus hook-repetition shape "${repeatedChorusHookPatterns[0].pattern}" (H = hook line, x = other line) repeats across ${repeatedChorusHookPatterns[0].count}/${songs.length} songs (tracks ${repeatedChorusHookPatterns[0].trackNos.join(', ')}) - vary how many times and where the hook repeats within the chorus.`);
  }
  // TASK v3.60 (TASK D-2) — a real pack's titles were all "Tableglow"/"Steam
  // Radio"-style bare 1-2 word noun pairs, despite the bridge instruction
  // already saying titles must "never [be] the same shape for every song".
  if (repeatedTitleShapes.length) {
    warnings.push(`Title shape repeats across ${repeatedTitleShapes[0].count}/${songs.length} songs (tracks ${repeatedTitleShapes[0].trackNos.join(', ')}) - vary title length/structure, not just the words.`);
  }

  return {
    songCount: songs.length,
    averageVocabularyOverlap,
    maxVocabularyOverlap,
    worstPair,
    repeatedFirstLinePatterns,
    repeatedChorusStructures,
    repeatedChorusHookPatterns,
    repeatedTitleShapes,
    warnings,
    errors,
    passed: errors.length === 0
  };
}
