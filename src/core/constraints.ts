import type { AudienceProfile, ConceptBreadth, GenrePack, KidsAgeTierId, WorkspaceId } from '../types';
import { genreLibrary, getGenreById } from '../data/genreLibrary';
import { ERA_BUCKET_BY_GENRE_ID, ERA_LABEL, eraBucketForGenreId, type EraBucket } from '../data/eraExclusions';
import { TITLE_PATTERNS } from '../data/titlePatterns';
import { VOCABULARY_BANKS, vocabularyBanksForEra } from '../data/vocabularyBanks';
import { CHANNEL_IDENTITY_WORDS, CHANNEL_IDENTITY_WORD_CAP, GENERIC_WORD_CAP } from './lyricVocabularyRepetition';
import { qualityPolicyForWorkspace } from '../data/workspaceQualityPolicies';

/**
 * v4.2 (TASK A3) — the structural fix for the problem this task exists to
 * solve: a concept ("비틀즈 느낌의 밝은 60년대 팝") used to reach only genre
 * selection (core/setDirector.ts's scoreGenre/chooseGenreIds) — title
 * generation, vocabulary, and era filtering never saw it at all, which is
 * why a real 18-song pack came back with the right genre *tags* but the
 * wrong decade's genres, 18/18 identical title shapes, and "every"
 * repeated 55x. ResolvedConstraints is the one object every downstream
 * generator (genre, title, vocabulary, era) is meant to read from instead
 * of re-deriving its own narrow slice of "what does this concept mean" —
 * see this file's own resolveConstraints() for how it's assembled, and
 * data/titlePatterns.ts / data/vocabularyBanks.ts for the two new data
 * files this pulls from.
 *
 * Honesty note (see docs/v4.2-a3-report.md for the full accounting): not
 * every consumer this task's spec lists is threaded through the *same*
 * ResolvedConstraints instance end-to-end yet. Genre era-quota
 * (applyEraQuota) is called directly from core/setDirector.ts with just the
 * era slice, and title generation resolves its own lightweight constraints
 * from GenerationOptions (resolveConstraintsFromOptions below) rather than
 * receiving the exact object setDirector.ts built — because GenerationOptions
 * itself has no field to carry a whole ResolvedConstraints through
 * serialization/save-load/UI yet. Both paths re-derive the same era/title/
 * vocabulary decision from the same concept text via the same functions
 * here, so behavior is consistent even though the object identity isn't
 * shared — a real gap, documented rather than silently glossed over.
 */

export interface EraConstraint {
  /** Reuses data/eraExclusions.ts's own EraBucket vocabulary (this app's real era granularity — 1950s and 60s are already one bucket for the oldpop family) instead of inventing a finer-grained vocabulary the genre data can't actually back. */
  primary: EraBucket;
  /**
   * v3.77 (TASK D) — set when the concept names a COMPOUND decade range
   * ("60~70년대 향수", "7080", "60s-70s") whose two decades map to
   * DIFFERENT EraBuckets: both `primary` and `coPrimary` are then co-equal
   * (each needs >= 40%, not one >= 50% + the other merely 25%-capped
   * adjacent — see applyEraQuota). Real measurement: a real "60~70년대"
   * concept landed 0/18 songs in the 1960s bucket because the old
   * single-primary-only regex layer only ever matched the "70년대" half of
   * that phrase (see extractEraConstraint's own detectCompoundDecades doc
   * comment for why "60년" as a literal substring never appears in
   * "60~70년대" at all).
   */
  coPrimary?: EraBucket;
  adjacent: { era: EraBucket; maxShare: number }[];
  forbidden: EraBucket[];
  /** true when the concept text had no era/decade/artist-era signal at all — callers MUST NOT filter by era when this is true (see this task's own §10 "억지로 시대를 정하지 말 것"). */
  unspecified: boolean;
}

export interface TitleConstraint {
  patternWeights: Record<string, number>;
  maxPerPattern: number;
  forbiddenPatterns: string[];
}

export interface VocabularyConstraint {
  preferredBanks: string[];
  forbidden: string[];
  maxRepeatPerWord: number;
  identityWords: string[];
  identityMaxRepeat: number;
}

export interface ResolvedConstraints {
  workspaceId: WorkspaceId;
  audienceProfileId: string;
  conceptLabel: string;

  /** v4.1 (TASK A) — see types.ts's ConceptBreadth doc comment. */
  breadth: ConceptBreadth;
  /** 'user' when opts.breadthOverride was set, 'auto' when detectConceptBreadth decided it. */
  breadthSource: 'auto' | 'user';

  era: EraConstraint;
  title: TitleConstraint;
  vocabulary: VocabularyConstraint;

  genreCandidates: string[];
  killingPointSetId: string;
  arcModelId: 'five-phase' | 'repetition-cycle';
  structureTemplateSetId: string;
  songLengthRange: [number, number];
  lyricWordRange: [number, number];
  tempoRange: [number, number];
  /**
   * P1 fix (정합성 점검 §1) — resolved verbatim from AudienceProfile.genreBoundedTempo
   * (types.ts). designGate.ts's bpmIssues reads this to stop holding a
   * genre-bounded audience (kr-kids/jp-kids — see tempoPlan.ts's
   * resolveTempoWithBand doc comment) to the workspace-wide variety/range
   * floor that per-genre tempo fidelity structurally can't satisfy: with
   * genreBoundedTempo on, a track's BPM is deliberately anchored to ITS OWN
   * genre's real tempoRange (a calm genre stays calm) instead of a
   * genre-blind workspace-wide draw, so pack-wide stddev/width now reflects
   * which genres a channel selected, not track-level jitter. Undefined
   * (every non-kids audience profile) is a strict no-op.
   */
  genreBoundedTempo?: boolean;
  /** See AudienceProfile.arrangementDensityLimits's own doc comment (types.ts) — resolved verbatim from the audience profile, same pass-through pattern as tempoRange/songLengthRange just above. */
  arrangementDensityLimits: { sparseMin: number; fullMax: number };

  requiredAtoms: string[];
  hardExclusions: string[];
  relaxableAtPeak: string[];

  /**
   * v5.13 (TASK: kidsAgeTierId wiring) — the real resolved tier (see
   * types.ts's GenerationOptions.kidsAgeTierId/KidsAgeTierId doc comments),
   * threaded through here so any downstream consumer that already receives
   * a `ResolvedConstraints` instance (not every caller has the original
   * GenerationOptions in scope) can read it without re-deriving. Undefined
   * for every non-kids resolution and for a kids resolution where the
   * caller didn't pass one (resolveConstraintsFromOptions still resolves a
   * real default via core/localGenerator.ts's resolveKidsAgeTierId at its
   * own real call sites — this field is a pass-through, not a re-decision).
   */
  kidsAgeTierId?: KidsAgeTierId;

  warnings: string[];
}

// ---------------------------------------------------------------------------
// TASK B — era extraction
// ---------------------------------------------------------------------------

// v3.77 (TASK D) — '6070'/'7080' bare-digit literals removed from here: a
// real "60~70년대" concept only ever matched "70년대" against the old
// ERA_1970_PATTERN (its own separate '7080' literal never matches
// "60~70년대" either — the text is "60", "~", "70년대", never the
// contiguous digits "7080"), landing 0/18 songs in 1960s. Bare/ranged
// compound-decade phrases are now handled uniformly by
// detectCompoundDecades below, which maps BOTH decades explicitly instead
// of leaving one entirely undetected.
const ERA_1950_60_PATTERN = /(1950|1950s|50년대|1960|1960s|\b60s\b|60년|60년대|비틀|beatles?|beat ?pop|doo-?wop|두왑|british beat)/i;
const ERA_1970_PATTERN = /(1970|1970s|\b70s\b|70년|70년대|카펜터스?|carpenters?|abba|아바|모타운|motown|soul train|양키|yacht)/i;
const ERA_1980_PATTERN = /(1980|1980s|\b80s\b|80년대|80년|신스팝|synth-?pop|시티팝|city ?pop|어덜트\s*컨템포러리|adult contemporary)/i;
// codex 지시문 02 (TASK J) — real, bounded gap: data/eraExclusions.ts's own
// EraBucket already has a '2000s' member with real genre data behind it
// (kr2030-y2k-retro, jp2030-heisei-nostalgia — see those entries' own
// goodFor/label text for the exact keywords used here), but no regex here
// ever tested for it, so an explicit "Y2K"/"2000년대"/"헤이세이" concept could
// never actually narrow toward its own matching genre via applyEraQuota —
// the same mechanism that already works for "60년대"/"70년대"/"80년대" simply
// never fired for the one other decade this app's genre data models.
// Deliberately literal keywords straight from those two genre packs' own
// text, not an invented broader vocabulary — see this file's own "don't
// force an era" principle in extractEraConstraint's doc comment.
const ERA_2000_PATTERN = /(2000년대|2000s|\by2k\b|밀레니엄|헤이세이|heisei)/i;

const DECADE_TO_BUCKET: Record<string, EraBucket> = { '50': '1950s-60s', '60': '1950s-60s', '70': '1970s', '80': '1980s' };

/**
 * v3.77 (TASK D) — recognizes "60~70년대"/"60-70년대"/"6070"/"60s-70s"/
 * "60s~70s" as naming TWO decades, mapping each to its own EraBucket.
 * Returns undefined when no compound pattern matches, or when both decades
 * resolve to the SAME bucket (e.g. "50~60년대" — both '1950s-60s' already,
 * not actually compound given this app's real era-bucket granularity).
 */
function detectCompoundDecades(text: string): [EraBucket, EraBucket] | undefined {
  const rangeMatch =
    text.match(/(\d{2})\s*[~\-–]\s*(\d{2})\s*년대/)
    ?? text.match(/(\d{2})s\s*[~\-–]\s*(\d{2})s\b/i)
    ?? text.match(/\b(50|60|70|80)(50|60|70|80)\b/);
  if (!rangeMatch) return undefined;
  const bucketA = DECADE_TO_BUCKET[rangeMatch[1]];
  const bucketB = DECADE_TO_BUCKET[rangeMatch[2]];
  if (!bucketA || !bucketB || bucketA === bucketB) return undefined;
  return [bucketA, bucketB];
}

const ERA_ADJACENCY: Record<EraBucket, EraBucket[]> = {
  '1950s-60s': ['1970s'],
  '1970s': ['1950s-60s', '1980s'],
  '1980s': ['1970s'],
  timeless: [],
  // TASK B1 — kr2030-y2k-retro is the only '2000s'-tagged genre and doesn't
  // participate in the oldpop-era-quota system this table drives; no
  // adjacency needed.
  '2000s': []
};

const REAL_ERA_BUCKETS: EraBucket[] = ['1950s-60s', '1970s', '1980s'];

/**
 * TASK B (3-1) — decade/artist-era detection. Deliberately narrow (explicit
 * decade numerals/known artist-era words only) — generic old-pop words like
 * "올드팝"/"추억"/"옛날" must NEVER trigger this (see this task's own §10 and
 * §9-2's 3rd verification concept, "비 오는 날 창가에서 듣는 올드팝", which has
 * no decade word and must resolve unspecified:true).
 */
export function extractEraConstraint(freeText: string, artistReferenceEraTags: string[] = []): EraConstraint {
  const haystack = [freeText, ...artistReferenceEraTags].join(' ');

  // v3.77 (TASK D) — checked BEFORE the single-bucket regexes below: a
  // compound decade phrase must resolve to two co-equal primaries, not
  // silently collapse to whichever single-bucket regex happens to match a
  // substring of it (see detectCompoundDecades's own doc comment for the
  // real "60~70년대" -> 0/18 1960s bug this closes).
  const compound = detectCompoundDecades(haystack);
  if (compound) {
    const [primary, coPrimary] = compound;
    const pairSet = new Set([primary, coPrimary]);
    const forbidden = REAL_ERA_BUCKETS.filter(bucket => !pairSet.has(bucket));
    return { primary, coPrimary, adjacent: [], forbidden, unspecified: false };
  }

  const hits: EraBucket[] = [];
  if (ERA_1950_60_PATTERN.test(haystack)) hits.push('1950s-60s');
  if (ERA_1970_PATTERN.test(haystack)) hits.push('1970s');
  if (ERA_1980_PATTERN.test(haystack)) hits.push('1980s');
  if (ERA_2000_PATTERN.test(haystack)) hits.push('2000s');
  const uniqueHits = [...new Set(hits)];

  if (!uniqueHits.length) {
    return { primary: 'timeless', adjacent: [], forbidden: [], unspecified: true };
  }

  const [primary, ...rest] = uniqueHits;

  // v3.79 (TASK A 1-4) — detectCompoundDecades only fires for its own
  // narrow regex shapes (a separator char, or bare contiguous digits like
  // "6070"). A concept like "60년대70년대" (both decade words present, no
  // separator between them) or "1960~1970년대" (4-digit years, which
  // detectCompoundDecades's 2-digit-only regex can't span) never matches
  // that regex, but DOES independently trip two of the single-bucket
  // regexes above — so if two-plus REAL era buckets were hit at all, treat
  // it the same as a compound concept (each >= 40% via era.coPrimary in
  // applyEraQuota) rather than demoting the second bucket to a 25%-capped
  // "adjacent" bucket. Real measurement: "60년대70년대 감성을 느낄수 있는
  // 올드팝" landed 0/18 in 1950s-60s under the old primary+adjacent
  // treatment path even though both decades were plainly named.
  if (rest.length >= 1) {
    const coPrimary = rest[0];
    const extraHits = rest.slice(1);
    const pairSet = new Set<EraBucket>([primary, coPrimary]);
    const adjacent = extraHits.map(era => ({ era, maxShare: 0.25 }));
    const forbidden = REAL_ERA_BUCKETS.filter(bucket => !pairSet.has(bucket) && !extraHits.includes(bucket));
    return { primary, coPrimary, adjacent, forbidden, unspecified: false };
  }

  const adjacentSet = new Set(ERA_ADJACENCY[primary]);
  const adjacent = [...adjacentSet].map(era => ({ era, maxShare: 0.25 }));
  const forbidden = REAL_ERA_BUCKETS.filter(bucket => bucket !== primary && !adjacentSet.has(bucket));

  return { primary, adjacent, forbidden, unspecified: false };
}

/**
 * 지시문 10 (TASK A-2) — decade-granularity refinement of an already-resolved
 * EraBucket, for core/eraIntent.ts's EraIntent (which needs to distinguish
 * "1960s" from "1970s" as literal prose strings, finer than EraBucket's own
 * '1950s-60s' genre-data grouping). Deliberately does NOT re-run Korean-text
 * detection — it only re-tests the exact same 1950-vs-1960 split within a
 * bucket ExtractEraConstraint already decided is '1950s-60s', so this stays a
 * refinement of that function's own result, not a second parser.
 */
export function decadeLabelForBucket(bucket: EraBucket, freeText: string): EraIntentDecade {
  if (bucket !== '1950s-60s') return BUCKET_TO_DECADE[bucket];
  return /1950|50년대/i.test(freeText) && !/1960|1960s|60년대|\b60s\b/i.test(freeText) ? '1950s' : '1960s';
}

export type EraIntentDecade = '1950s' | '1960s' | '1970s' | '1980s' | '1990s' | '2000s' | '2010s' | '2020s';

// 'timeless' never actually reaches decadeLabelForBucket in practice —
// extractEraConstraint only ever returns primary:'timeless' paired with
// unspecified:true, and every real caller (core/eraIntent.ts's
// deriveEraIntent) skips building an EraIntent at all when unspecified is
// true. Kept as a defensive, harmless default so this Record stays
// exhaustive over EraBucket rather than needing an `as` cast.
const BUCKET_TO_DECADE: Record<EraBucket, EraIntentDecade> = {
  '1950s-60s': '1960s',
  '1970s': '1970s',
  '1980s': '1980s',
  timeless: '1960s',
  '2000s': '2000s'
};

// ---------------------------------------------------------------------------
// v5.7 (TASK v5.7, TASK C §3-3) — mood/atmosphere axis extraction
// ---------------------------------------------------------------------------

/**
 * Real gap this closes: a concept like "60년대 감미로운 올드팝" only ever had
 * "60년대" (era) and "올드팝" (workspace) reach genre selection —
 * "감미로운" (sweet/mellow) was detected nowhere at all, so a set asking for
 * a tender, sweet 60s sound came back with only the brightest/loudest 60s
 * genres (doowop/girl-group/sunshine-pop), because nothing in the pipeline
 * ever weighed "sweet" against "bright" when picking a genre family. This
 * dictionary is deliberately the task's own explicit 6-cluster list — not
 * expanded past it, so an untested cluster never silently mismatches.
 */
export interface MoodConstraint {
  /** English descriptors carried into genre scoring / prompt composition. */
  descriptors: string[];
  preferredTraits: {
    dynamicRange?: 'low' | 'medium';
    tempoLean?: 'slow' | 'mid' | 'fast';
    harmonyLean?: string[];
  };
  /** The Korean word(s) from the concept text that triggered this — e.g. '감미로운'. */
  sourceText: string;
}

interface MoodCluster {
  pattern: RegExp;
  descriptors: string[];
  preferredTraits: MoodConstraint['preferredTraits'];
}

/** TASK v5.7 (TASK C §3-3) — the task's own literal 6-cluster Korean mood-adjective dictionary. Order matters only as a tie-break when a concept happens to trip two clusters at once (rare) — the first cluster tested wins, matching this file's other extract* functions' own "first hit wins" convention. */
const MOOD_CLUSTERS: MoodCluster[] = [
  {
    pattern: /감미로운|달콤한|부드러운/,
    descriptors: ['sweet', 'tender', 'mellow'],
    preferredTraits: { tempoLean: 'slow', harmonyLean: ['lush chords', 'extended harmony'] }
  },
  {
    pattern: /잔잔한|차분한|조용한/,
    descriptors: ['calm', 'quiet', 'hushed'],
    preferredTraits: { dynamicRange: 'low', tempoLean: 'slow' }
  },
  {
    pattern: /밝은|경쾌한|신나는/,
    descriptors: ['bright', 'upbeat', 'lively'],
    preferredTraits: { tempoLean: 'mid' }
  },
  {
    pattern: /쓸쓸한|애잔한|그리운/,
    descriptors: ['wistful', 'tender-sad'],
    preferredTraits: { tempoLean: 'slow', harmonyLean: ['minor-leaning harmony'] }
  },
  {
    pattern: /따뜻한|포근한/,
    descriptors: ['warm', 'cozy'],
    preferredTraits: { dynamicRange: 'low', tempoLean: 'mid' }
  },
  {
    pattern: /서정적인|애틋한/,
    descriptors: ['lyrical', 'poignant'],
    preferredTraits: { tempoLean: 'slow' }
  }
];

/**
 * TASK v5.7 (TASK C §3-3) — returns undefined (not a "neutral" MoodConstraint)
 * when no cluster matched, so callers (setDirector.ts's ConceptAxisCoverage)
 * can tell "no mood expressed" apart from "mood expressed but the dictionary
 * doesn't cover this word" — per this task's own explicit "감지 못 하면
 * unapplied 로 표시하십시오, 억지로 매칭하지 말 것".
 */
export function extractMoodConstraint(freeText: string): MoodConstraint | undefined {
  for (const cluster of MOOD_CLUSTERS) {
    const match = freeText.match(cluster.pattern);
    if (match) {
      return { descriptors: [...cluster.descriptors], preferredTraits: { ...cluster.preferredTraits }, sourceText: match[0] };
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// v5.7 (TASK v5.7, TASK C §3-5) — concept axis coverage
// ---------------------------------------------------------------------------

export type ConceptAxisId = 'era' | 'mood' | 'genre' | 'situation' | 'reference' | 'season';

export interface ConceptAxisCoverage {
  axis: ConceptAxisId;
  detected: boolean;
  /** The part of the concept text this axis was read from, e.g. '60년대', '감미로운'. Undefined when detected is false. */
  sourceText?: string;
  /** Where this axis actually landed — e.g. ['genre selection', 'era quota']. Empty when unapplied. */
  appliedTo: string[];
  /** true only when detected && appliedTo.length === 0 — a real "the app silently ignored this" case Step2Plan.tsx should warn about. */
  unapplied: boolean;
}

// ---------------------------------------------------------------------------
// v4.1 (TASK A) — concept breadth detection
// ---------------------------------------------------------------------------

/**
 * A small, explicit set of single-genre Korean/English names this app's
 * concept text actually uses (matches data/genreLibrary.ts's real genre
 * vocabulary at a coarse level) — not a full NLP genre classifier. Counting
 * how many of these appear distinguishes "정확히 한 장르가 명시됨" (focused)
 * from "여러 장르가 나열됨" (variety) without needing to parse every one of
 * the ~320 genre labels in genreLibrary.ts against free Korean text.
 */
const SINGLE_GENRE_HINT_WORDS = [
  '샹송', '보사노바', '재즈', '발라드', '시티팝', '어쿠스틱', 'r&b', '알앤비',
  '소울', '트로트', '포크', '신스팝', '컨템포러리', '로파이', 'lo-fi'
];

function countGenreHintWords(text: string): number {
  const lower = text.toLowerCase();
  return SINGLE_GENRE_HINT_WORDS.filter(word => lower.includes(word.toLowerCase())).length;
}

const FOCUSED_SOLE_MARKER_PATTERN = /(으)?로만|위주로|통일감|한\s*가지\s*(색|느낌|장르)로/;
const FOCUSED_BACKGROUND_USE_PATTERN = /수면용|잠\s*잘\s*때|공부할\s*때|공부용|카페\s*배경|백색소음|업무용|집중할\s*때|명상/;
const FOCUSED_MOOD_ONLY_PATTERN = /잔잔한|차분한|조용한|담백한|슬로우/;
const FOCUSED_MOOD_CONFLICT_PATTERN = /신나는|밝은|경쾌한|업템포|다양한/;

const VARIETY_KEYWORD_PATTERN = /다양한|여러\s*(장르|스타일)?|골고루|모음|믹스/;
const VARIETY_GENRE_LIST_PATTERN = /[가-힣]+\s*(이랑|랑|와|과)\s*[가-힣]+\s*(이랑|랑|와|과)/;

/**
 * v4.1 (TASK A) — same "자유 텍스트를 정규식 키워드로 판정" shape as
 * extractEraConstraint above, deliberately: this is a heuristic detector,
 * not a hard classifier, so it's designed to fail toward 'balanced' (today's
 * existing fixed thresholds) rather than guess wrong in either narrow
 * direction. `era` is passed in (not re-derived) so a compound-decade
 * concept ("60~70년대 향수") counts as a variety signal for free — that's
 * already exactly what era.coPrimary/era.adjacent mean.
 */
export function detectConceptBreadth(freeText: string, era: EraConstraint): ConceptBreadth {
  const hasCompoundEra = Boolean(era.coPrimary) || era.adjacent.length > 0;
  const genreHintCount = countGenreHintWords(freeText);
  const hasVarietySignal = hasCompoundEra
    || VARIETY_KEYWORD_PATTERN.test(freeText)
    || VARIETY_GENRE_LIST_PATTERN.test(freeText)
    || genreHintCount >= 3;
  if (hasVarietySignal) return 'variety';

  const hasSoleGenreMention = genreHintCount === 1;
  const hasFocusedMoodOnly = FOCUSED_MOOD_ONLY_PATTERN.test(freeText) && !FOCUSED_MOOD_CONFLICT_PATTERN.test(freeText);
  const hasFocusedSignal = FOCUSED_SOLE_MARKER_PATTERN.test(freeText)
    || FOCUSED_BACKGROUND_USE_PATTERN.test(freeText)
    || hasSoleGenreMention
    || hasFocusedMoodOnly;
  if (hasFocusedSignal) return 'focused';

  return 'balanced';
}

// 지시문 10 (TASK A-3) — exported so core/batchPreallocation.ts's
// genreCountsFromIds seed uses this exact same per-genre cap directSetLocal
// already does, instead of a separate literal `5` that could silently drift.
export const GENRE_ERA_QUOTA_PER_GENRE_CAP = 5;
/** Genres with no oldpop-* era bucket at all (eraBucketForGenreId returns null) — this task's own "시대 표기 없는 범용 장르" bucket, capped at 20% same as any adjacent bucket. */
const GENERIC_ERA_SHARE = 0.2;

function bucketKeyOf(genreId: string): EraBucket | 'generic' {
  return eraBucketForGenreId(genreId) ?? 'generic';
}

function trimBucket(list: [string, number][], cap: number): { kept: [string, number][]; freed: number } {
  const total = list.reduce((sum, [, count]) => sum + count, 0);
  if (total <= cap) return { kept: list, freed: 0 };
  let toTrim = total - cap;
  const kept: [string, number][] = [];
  for (const [id, count] of list) {
    if (toTrim <= 0) { kept.push([id, count]); continue; }
    const cut = Math.min(count, toTrim);
    toTrim -= cut;
    if (count - cut > 0) kept.push([id, count - cut]);
  }
  return { kept, freed: total - cap };
}

/**
 * TASK B (3-2) — enforces primary >= 50%, each adjacent bucket <= its
 * maxShare, forbidden buckets = 0, and the era-unlabeled ("generic") bucket
 * <= 20%, by trimming over-quota genre ids and refilling the primary bucket
 * from the full genre library (never inventing new genre ids outside it).
 * A no-op when era.unspecified (see this function's only caller,
 * core/setDirector.ts, which must never call this for an unspecified era).
 */
export function applyEraQuota(
  genreCounts: Record<string, number>,
  songCount: number,
  era: EraConstraint,
  channelFilter: (genre: GenrePack) => boolean,
  /**
   * TASK v5.7 follow-up (TASK C §3-4, mood axis genre-count balance) —
   * best-first genre id preference (e.g. core/setDirector.ts's own `ranked`
   * scoreGenre output, which already folds in mood.preferredTraits) used to
   * order WHICH genre(s) distributeInto opens when a quota bucket needs new
   * genres beyond whatever chooseGenreIds already selected. Without this,
   * distributeInto's `newIds` fell back to genreLibrary's raw declaration
   * order — completely blind to mood/score, so a mood-driven concept whose
   * era-primary bucket (data/eraExclusions.ts's ERA_BUCKET_BY_GENRE_ID) has
   * no genuinely mood-matching member at all (e.g. "60년대" only has bright
   * doo-wop/Brill-Building/girl-group genres in its 1950s-60s bucket, zero
   * orchestral ones) still picked whichever bucket genre happened to be
   * declared first, every time, regardless of how "감미로운"/mellow the
   * concept was. Optional and purely a re-ORDERING of the same candidate
   * set (every existing candidate stays eligible; ids missing from
   * genreOrder simply keep their relative genreLibrary order at the back)
   * — never drops a genre, never changes which BUCKET wins the quota, only
   * which genre(s) within a bucket get opened first. Undefined at every
   * call site with no mood/rank signal to offer (unchanged behavior there).
   */
  genreOrder?: readonly string[]
): { counts: Record<string, number>; warnings: string[] } {
  if (era.unspecified || !songCount) return { counts: genreCounts, warnings: [] };
  const genreOrderRank = genreOrder ? new Map(genreOrder.map((id, idx) => [id, idx])) : undefined;

  const warnings: string[] = [];
  const adjacentMap = new Map(era.adjacent.map(a => [a.era, a.maxShare]));
  const forbiddenSet = new Set(era.forbidden);
  const genericCap = Math.floor(songCount * GENERIC_ERA_SHARE);

  const byBucket = new Map<string, [string, number][]>();
  for (const [id, count] of Object.entries(genreCounts)) {
    const bucket = bucketKeyOf(id);
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), [id, count]]);
  }

  let freed = 0;

  for (const bucket of forbiddenSet) {
    const list = byBucket.get(bucket);
    if (list?.length) {
      const removed = list.reduce((sum, [, count]) => sum + count, 0);
      freed += removed;
      byBucket.delete(bucket);
      warnings.push(`${ERA_LABEL[bucket]} 장르가 이 컨셉의 금지 시대라 ${removed}곡 재배분했습니다.`);
    }
  }

  for (const [bucket, maxShare] of adjacentMap) {
    const cap = Math.floor(songCount * maxShare);
    const list = byBucket.get(bucket) ?? [];
    const { kept, freed: freedHere } = trimBucket(list, cap);
    if (freedHere > 0) {
      freed += freedHere;
      byBucket.set(bucket, kept);
      warnings.push(`${ERA_LABEL[bucket]} 장르가 인접 시대 상한(${Math.round(maxShare * 100)}%)을 넘어 ${freedHere}곡 재배분했습니다.`);
    }
  }

  {
    const list = byBucket.get('generic') ?? [];
    const { kept, freed: freedHere } = trimBucket(list, genericCap);
    if (freedHere > 0) {
      freed += freedHere;
      byBucket.set('generic', kept);
      warnings.push(`시대 표기 없는 범용 장르가 상한(20%)을 넘어 ${freedHere}곡 재배분했습니다.`);
    }
  }

  // v3.77 (TASK D) — a compound-decade concept ("60~70년대") sets
  // era.coPrimary: both era.primary and era.coPrimary are co-equal, each
  // needing >= 40% (vs. a single primary's own >= 50%), rather than one
  // primary + a merely-adjacent 25%-capped second bucket. Real measurement:
  // the old single-primary-only version left a coPrimary-equivalent bucket
  // with no floor at all, so a "60~70년대" concept (which the OLD regex
  // layer only matched as "70년대" — see extractEraConstraint's own
  // detectCompoundDecades doc comment) could land 0 songs in 1960s.
  const primaryBuckets: EraBucket[] = era.coPrimary ? [era.primary, era.coPrimary] : [era.primary];
  const primaryMinShare = era.coPrimary ? 0.4 : 0.5;

  // Any bucket that is neither a primary bucket, adjacent, forbidden, nor
  // generic shouldn't exist given the 4-bucket model, but if it does
  // (defensive), treat it the same as forbidden rather than silently
  // keeping it.
  for (const bucket of [...byBucket.keys()]) {
    if ((primaryBuckets as string[]).includes(bucket) || bucket === 'generic' || adjacentMap.has(bucket as EraBucket) || forbiddenSet.has(bucket as EraBucket)) continue;
    const list = byBucket.get(bucket) ?? [];
    freed += list.reduce((sum, [, count]) => sum + count, 0);
    byBucket.delete(bucket);
  }

  // v4.2 bugfix — a first version of this function tracked `freed` as a
  // running total but then separately re-derived "how much is still left"
  // from `toAdd` after already having subtracted a *different* amount
  // (remaining, not toAdd) from it, double-counting the shortfall and
  // silently dropping songs (measured: 18 in, 16 out). `distributeInto`
  // is now the only place that mutates a target bucket's list/consumes
  // `freed`, called once per primary bucket (v3.77: up to 2 now) plus once
  // more for whatever's left, so every call shares one accounting path
  // instead of independently-buggy ones.
  /**
   * v3.78 follow-up (genre-singleton root cause) — the original version
   * round-robin'd +1 across every candidate id (existing genres, then every
   * pool genre not yet used) in one flat list, stopping the moment `amount`
   * ran out. Whenever `amount` wasn't a clean multiple of the candidate
   * count — the common case when filling a bucket mostly from scratch —
   * the LAST partial pass gave exactly +1 to however many new (previously
   * count=0) genres it took to exhaust `amount`, permanently stranding each
   * at a count of 1. A first fix attempt (open new genres in blocks of >=2,
   * greedily topping each up to cap before opening the next) still failed
   * for a real case: filling a 3-song-short 1950s-60s bucket by 8 more
   * topped the one already-existing genre to cap, opened ONE new genre and
   * maxed IT to cap too, leaving exactly 1 leftover with no already-touched
   * genre left to top up — forcing a second new genre open for just that 1
   * (measured: "비틀즈 느낌의 밝은 60년대 팝" left `oldpop-brill-building`
   * at exactly 1 song, `oldpop-british-beat`/`oldpop-doowop-harmony` at cap).
   *
   * Fixed by deciding the new-genre COUNT upfront instead of greedily
   * maxing genres out one at a time: after topping up existing genres,
   * `Math.ceil(remaining / cap)` is exactly how many new genres are needed
   * to hold `remaining` without exceeding any of their caps, so opening
   * precisely that many and round-robining evenly across just that set
   * (instead of the whole candidate pool) naturally balances them —
   * verified: the same real case above now lands doowop-harmony/
   * brill-building at 3 songs each instead of 5/1.
   */
  function distributeInto(targetBucket: EraBucket, amount: number): number {
    if (amount <= 0) return 0;
    const currentList = byBucket.get(targetBucket) ?? [];
    const existingIds = [...new Set(currentList.map(([id]) => id))];
    const existingIdSet = new Set(existingIds);
    const newIds = genreLibrary
      .filter(genre => channelFilter(genre) && bucketKeyOf(genre.id) === targetBucket)
      .map(genre => genre.id)
      .filter(id => !existingIdSet.has(id));
    // Best-mood/score-match first when a preference order was supplied —
    // stable sort, so two ids the caller has no opinion on (both absent from
    // genreOrder) keep their original genreLibrary relative order, same as
    // if genreOrder had never been passed at all.
    if (genreOrderRank) {
      newIds.sort((a, b) => (genreOrderRank.get(a) ?? Number.MAX_SAFE_INTEGER) - (genreOrderRank.get(b) ?? Number.MAX_SAFE_INTEGER));
    }
    const counts = new Map(currentList);
    let remaining = amount;

    const topUp = (ids: readonly string[]) => {
      let progressed = true;
      while (remaining > 0 && progressed) {
        progressed = false;
        for (const id of ids) {
          if (remaining <= 0) break;
          const current = counts.get(id) ?? 0;
          if (current >= GENRE_ERA_QUOTA_PER_GENRE_CAP) continue;
          counts.set(id, current + 1);
          remaining -= 1;
          progressed = true;
        }
      }
    };

    // Phase 1 — grow the bucket's existing genres before opening any new one.
    topUp(existingIds);

    // Phase 2 — open exactly as many new genres as the leftover needs to
    // stay under cap on each, then round-robin evenly across just that set.
    // If the pool runs out before `remaining` is exhausted (fewer newIds
    // than needed), fall through to using every remaining candidate — the
    // "insufficient candidates" case, unchanged from before, still returns
    // a partial fill via `amount - remaining` for the caller's own warning.
    while (remaining > 0 && newIds.length) {
      const genresToOpen = Math.min(newIds.length, Math.max(1, Math.ceil(remaining / GENRE_ERA_QUOTA_PER_GENRE_CAP)));
      const chosen = newIds.splice(0, genresToOpen);
      topUp(chosen);
    }

    byBucket.set(targetBucket, [...counts.entries()]);
    return amount - remaining;
  }

  // v3.77 (TASK D) — a coPrimary bucket can be starved even though nothing
  // was ever "freed": if every song already sits in the OTHER primary
  // bucket, that bucket was never trimmed (only adjacent/generic/forbidden
  // buckets get a cap above), so the fill loop below sees freed=0 and adds
  // nothing. Real measurement: 18 songs pre-seeded entirely into 1970s
  // left 1950s-60s at 0/18 even after this function ran. Each primary
  // bucket is capped at songCount minus every OTHER primary bucket's own
  // minimum, freeing the overflow so the fill loop can actually redistribute
  // it — mirrors the adjacent-bucket cap just above, scoped to only the
  // coPrimary case since a single primary has no sibling to make room for.
  if (era.coPrimary) {
    const eachMin = Math.ceil(songCount * primaryMinShare);
    for (const bucket of primaryBuckets) {
      const otherMinTotal = eachMin * (primaryBuckets.length - 1);
      const maxAllowed = Math.max(eachMin, songCount - otherMinTotal);
      const list = byBucket.get(bucket) ?? [];
      const { kept, freed: freedHere } = trimBucket(list, maxAllowed);
      if (freedHere > 0) {
        freed += freedHere;
        byBucket.set(bucket, kept);
        warnings.push(`${ERA_LABEL[bucket]} 장르가 공동 주 시대 배분 상한을 넘어 ${freedHere}곡 재배분했습니다.`);
      }
    }
  }

  // v3.78 follow-up (genre-singleton root cause) — era.primary is always
  // processed LAST and absorbs the FULL remaining `freed` budget in one
  // distributeInto call, rather than a separate "reach its own minimum"
  // call followed later by a second, independent "dump whatever's still
  // freed" call (both of which used to target era.primary). The TOTAL
  // amount handed to era.primary is mathematically identical either way
  // (min(needed, freed) + leftover === freed), but splitting it into two
  // calls could leave the second call's remainder too small for
  // distributeInto's own anti-singleton "never introduce a new genre with
  // fewer than 2 songs" logic to place safely — stranding a genre at
  // exactly 1 song even though the combined amount would have comfortably
  // filled 2+. era.coPrimary (when present) is unaffected: it still only
  // ever draws up to its own needed minimum, same as before.
  const fillOrder = era.coPrimary ? [era.coPrimary, era.primary] : [era.primary];
  for (const bucket of fillOrder) {
    const currentTotal = (byBucket.get(bucket) ?? []).reduce((sum, [, count]) => sum + count, 0);
    const min = Math.ceil(songCount * primaryMinShare);
    const needed = Math.max(0, min - currentTotal);
    const toAdd = bucket === era.primary ? freed : Math.min(needed, freed);
    if (toAdd > 0) {
      const actuallyAdded = distributeInto(bucket, toAdd);
      freed -= actuallyAdded;
      if (actuallyAdded < needed) {
        warnings.push(`${ERA_LABEL[bucket]} 장르 후보가 부족해 최소 비중(${min}곡)을 ${needed - actuallyAdded}곡만큼 채우지 못했습니다.`);
      }
    }
  }

  const result: Record<string, number> = {};
  for (const list of byBucket.values()) {
    for (const [id, count] of list) {
      if (count > 0) result[id] = (result[id] ?? 0) + count;
    }
  }
  return { counts: result, warnings };
}

/**
 * v3.78 follow-up (genre-singleton root cause) — a plain round-robin-with-cap
 * (`ids[index % ids.length]`) can leave a low-ranked candidate at exactly 1
 * song whenever the per-id cap binds for higher-ranked candidates before
 * `songCount` is fully placed (e.g. 2 genres reach cap 5 each, leaving a 6th
 * candidate to soak up a lone leftover song). This is genre-selection's own
 * version of the same bug applyEraQuota's own distributeInto had: decide how
 * many distinct genre ids are actually needed to hold `songCount` without any
 * one exceeding `cap` (`Math.ceil(songCount / cap)`), then round-robin evenly
 * across exactly that many — instead of the whole candidate list — so a
 * lower-ranked id is only touched when the pack genuinely needs it, and when
 * it is touched it gets a real share, not a stray 1.
 *
 * Lives here (not core/setDirector.ts, its original home) so
 * core/batchPreallocation.ts can seed applyEraQuota's genreCounts input with
 * the same singleton-avoiding split core/setDirector.ts's directSetLocal
 * already gets, without an import cycle (setDirector.ts already imports
 * FROM batchPreallocation.ts's preallocateSongSlots) — see 지시문 10 TASK A-3.
 */
export function genreCountsFromIds(ids: string[], songCount: number, cap: number): Record<string, number> {
  if (!ids.length || songCount <= 0) return {};
  const counts: Record<string, number> = {};
  let remaining = songCount;
  const pool = [...ids];
  while (remaining > 0 && pool.length) {
    const genresToOpen = Math.min(pool.length, Math.max(1, Math.ceil(remaining / cap)));
    const chosen = pool.splice(0, genresToOpen);
    let progressed = true;
    while (remaining > 0 && progressed) {
      progressed = false;
      for (const id of chosen) {
        if (remaining <= 0) break;
        const current = counts[id] ?? 0;
        if (current >= cap) continue;
        counts[id] = current + 1;
        remaining -= 1;
        progressed = true;
      }
    }
  }
  return counts;
}

/** For compositionScorer.ts's era-vs-concept advisory/blocking check — the actual measured share of each bucket in a resolved genre-count map. */
export function eraSharesOf(genreCounts: Record<string, number>): Record<string, number> {
  const total = Object.values(genreCounts).reduce((sum, count) => sum + count, 0);
  if (!total) return {};
  const byBucket = new Map<string, number>();
  for (const [id, count] of Object.entries(genreCounts)) {
    const bucket = bucketKeyOf(id);
    byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + count);
  }
  const shares: Record<string, number> = {};
  for (const [bucket, count] of byBucket) shares[bucket] = count / total;
  return shares;
}

// ---------------------------------------------------------------------------
// TASK C — title constraint
// ---------------------------------------------------------------------------

function buildTitleConstraint(era: EraConstraint, songCount: number): TitleConstraint {
  const applicable = TITLE_PATTERNS.filter(pattern => era.unspecified || !pattern.fitsEras?.length || pattern.fitsEras.includes(era.primary));
  const patternWeights: Record<string, number> = {};
  for (const pattern of applicable) {
    // image-pair was the old code's only real output (18/18 in the real
    // measured pack) — halved here so the other 7 patterns actually get a
    // turn instead of image-pair winning the weighted draw most of the time.
    patternWeights[pattern.id] = pattern.id === 'image-pair' ? 0.5 : 1;
  }
  const maxPerPattern = Math.max(2, Math.round((songCount * 4) / 18));
  return { patternWeights, maxPerPattern, forbiddenPatterns: [] };
}

// ---------------------------------------------------------------------------
// TASK D — vocabulary constraint
// ---------------------------------------------------------------------------

function buildVocabularyConstraint(era: EraConstraint, workspaceId: WorkspaceId, audience: AudienceProfile): VocabularyConstraint {
  const banks = era.unspecified
    ? VOCABULARY_BANKS.filter(bank => !bank.fitsWorkspaces?.length || bank.fitsWorkspaces.includes(workspaceId))
    : vocabularyBanksForEra(era.primary).filter(bank => !bank.fitsWorkspaces?.length || bank.fitsWorkspaces.includes(workspaceId));
  return {
    preferredBanks: banks.map(bank => bank.id),
    forbidden: [...audience.hardExclusions],
    maxRepeatPerWord: GENERIC_WORD_CAP,
    identityWords: [...CHANNEL_IDENTITY_WORDS],
    identityMaxRepeat: CHANNEL_IDENTITY_WORD_CAP
  };
}

// ---------------------------------------------------------------------------
// TASK A — resolveConstraints
// ---------------------------------------------------------------------------

export interface ConceptInput {
  conceptLabel: string;
  /** Era-tag text from any decomposed artist reference (core/artistReferenceDecomposer.ts's DecomposedReference.eraTag) — kept as plain strings so this module never needs to import that module's full type. */
  artistReferenceEraTags?: string[];
  /** v4.1 (TASK A) — explicit user choice (GenerationOptions.breadthOverride) — wins over detectConceptBreadth's own auto-detection when present. */
  breadthOverride?: ConceptBreadth;
}

export interface WorkspaceLike {
  id: WorkspaceId;
}

/**
 * TASK A — assembles the single constraint object every generator (genre,
 * title, vocabulary, era) should read from. Priority order per this task's
 * own §2-2: concept text first, then workspace default, then audience
 * default; a concept/audience conflict resolves toward the concept EXCEPT
 * audience hardExclusions, which a concept can never override (§10 — most
 * important for the kids workspaces' safety policy, D1's scope).
 */
export function resolveConstraints(
  concept: ConceptInput,
  workspace: WorkspaceLike,
  audience: AudienceProfile,
  songCount: number,
  /** v5.13 (TASK: kidsAgeTierId wiring) — see ResolvedConstraints.kidsAgeTierId's own doc comment. Optional, additive: every existing caller that omits this gets byte-identical output. */
  kidsAgeTierId?: KidsAgeTierId
): ResolvedConstraints {
  const warnings: string[] = [];
  const detectedEra = extractEraConstraint(concept.conceptLabel, concept.artistReferenceEraTags);
  // codex 지시문 02 (TASK J) — 'safety-over-era' workspaces (kids) never let
  // era gating narrow genre selection, even from an accidental decade-word
  // match in concept text — see data/workspaceEraIntent.ts's own doc
  // comment for why the other 3 modes are documented, real-behavior-matching
  // no-ops rather than additional code paths here.
  // codex 지시문 02 (TASK A) — reads eraIntent through the new
  // WorkspaceQualityPolicy aggregation registry (data/workspaceQualityPolicies.ts)
  // rather than calling data/workspaceEraIntent.ts directly — the one real,
  // proven consumer that registry's own doc comment points to. Same value,
  // same behavior; this is the aggregation layer actually being consulted
  // by a real code path, not decorative.
  const eraIntent = qualityPolicyForWorkspace(workspace.id).eraIntent;
  const era: EraConstraint = eraIntent.mode === 'safety-over-era' && !detectedEra.unspecified
    ? { primary: 'timeless', adjacent: [], forbidden: [], unspecified: true }
    : detectedEra;
  if (eraIntent.mode === 'safety-over-era' && !detectedEra.unspecified) {
    warnings.push(`이 워크스페이스는 시대 지정을 사용하지 않습니다(안전 우선) — 감지된 "${ERA_LABEL[detectedEra.primary]}" 시대 신호를 무시했습니다.`);
  }
  const title = buildTitleConstraint(era, songCount);
  const vocabulary = buildVocabularyConstraint(era, workspace.id, audience);
  const breadth = concept.breadthOverride ?? detectConceptBreadth(concept.conceptLabel, era);
  const breadthSource: 'auto' | 'user' = concept.breadthOverride ? 'user' : 'auto';

  const genreCandidates = era.unspecified
    ? []
    : genreLibrary.filter(genre => bucketKeyOf(genre.id) === era.primary).map(genre => genre.id);

  return {
    workspaceId: workspace.id,
    audienceProfileId: audience.id,
    breadth,
    breadthSource,
    conceptLabel: concept.conceptLabel,
    era,
    title,
    vocabulary,
    genreCandidates,
    killingPointSetId: 'senior-oldpop-default',
    arcModelId: audience.arcModelId ?? 'five-phase',
    structureTemplateSetId: 'adult-t1-t5',
    songLengthRange: audience.songLengthSecondsRange,
    lyricWordRange: audience.lyricWordRange,
    tempoRange: [audience.tempoFloor, audience.tempoCeiling],
    genreBoundedTempo: audience.genreBoundedTempo,
    arrangementDensityLimits: audience.arrangementDensityLimits,
    requiredAtoms: [],
    hardExclusions: [...audience.hardExclusions],
    relaxableAtPeak: [...audience.relaxableAtPeak],
    ...(kidsAgeTierId ? { kidsAgeTierId } : {}),
    warnings
  };
}

/**
 * Pragmatic entry point for callers that only have a fully-built
 * GenerationOptions (core/lyricEngine.ts's title generation, reached via
 * core/batchPreallocation.ts and core/localGenerator.ts) rather than
 * core/setDirector.ts's own InterpretedIntent — see this file's own top
 * doc comment for why these two paths re-derive independently instead of
 * sharing one object instance today.
 */
export function resolveConstraintsFromOptions(opts: {
  customConcept?: string;
  projectTitle: string;
  songCount: number;
  channel: { archetype?: string; kidsAgeTierId?: KidsAgeTierId };
  breadthOverride?: ConceptBreadth;
  /** v5.13 (TASK: kidsAgeTierId wiring) — per-generation override, same priority as opts.channel.kidsAgeTierId (mirrors GenerationOptions.kidsAgeTierId's own doc comment). */
  kidsAgeTierId?: KidsAgeTierId;
}, audience: AudienceProfile, workspaceId: WorkspaceId = 'senior-oldpop'): ResolvedConstraints {
  const conceptLabel = opts.customConcept?.trim() || opts.projectTitle;
  const kidsAgeTierId = opts.kidsAgeTierId ?? opts.channel.kidsAgeTierId;
  return resolveConstraints({ conceptLabel, breadthOverride: opts.breadthOverride }, { id: workspaceId }, audience, opts.songCount || 18, kidsAgeTierId);
}

export { getGenreById };
