import type { AudienceProfile, GenrePack, WorkspaceId } from '../types';
import { genreLibrary, getGenreById } from '../data/genreLibrary';
import { ERA_BUCKET_BY_GENRE_ID, ERA_LABEL, eraBucketForGenreId, type EraBucket } from '../data/eraExclusions';
import { TITLE_PATTERNS } from '../data/titlePatterns';
import { VOCABULARY_BANKS, vocabularyBanksForEra } from '../data/vocabularyBanks';
import { CHANNEL_IDENTITY_WORDS, CHANNEL_IDENTITY_WORD_CAP, GENERIC_WORD_CAP } from './lyricVocabularyRepetition';

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

  requiredAtoms: string[];
  hardExclusions: string[];
  relaxableAtPeak: string[];

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
  timeless: []
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

const GENRE_ERA_QUOTA_PER_GENRE_CAP = 5;
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
  channelFilter: (genre: GenrePack) => boolean
): { counts: Record<string, number>; warnings: string[] } {
  if (era.unspecified || !songCount) return { counts: genreCounts, warnings: [] };

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
  function distributeInto(targetBucket: EraBucket, amount: number): number {
    if (amount <= 0) return 0;
    const currentList = byBucket.get(targetBucket) ?? [];
    const existingIds = new Set(currentList.map(([id]) => id));
    const pool = genreLibrary.filter(genre => channelFilter(genre) && bucketKeyOf(genre.id) === targetBucket);
    const orderedIds = [...existingIds, ...pool.map(genre => genre.id).filter(id => !existingIds.has(id))];
    const counts = new Map(currentList);
    let remaining = amount;
    let guard = 0;
    while (remaining > 0 && orderedIds.length && guard < orderedIds.length * GENRE_ERA_QUOTA_PER_GENRE_CAP + 1) {
      let addedAny = false;
      for (const id of orderedIds) {
        if (remaining <= 0) break;
        const current = counts.get(id) ?? 0;
        if (current >= GENRE_ERA_QUOTA_PER_GENRE_CAP) continue;
        counts.set(id, current + 1);
        remaining -= 1;
        addedAny = true;
      }
      guard += 1;
      if (!addedAny) break;
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

  for (const bucket of primaryBuckets) {
    const currentTotal = (byBucket.get(bucket) ?? []).reduce((sum, [, count]) => sum + count, 0);
    const min = Math.ceil(songCount * primaryMinShare);
    const needed = Math.max(0, min - currentTotal);
    const toAdd = Math.min(needed, freed);
    if (toAdd > 0) {
      const actuallyAdded = distributeInto(bucket, toAdd);
      freed -= actuallyAdded;
      if (actuallyAdded < toAdd) {
        warnings.push(`${ERA_LABEL[bucket]} 장르 후보가 부족해 최소 비중(${min}곡)을 ${toAdd - actuallyAdded}곡만큼 채우지 못했습니다.`);
      }
    }
  }

  // Any songs still freed (forbidden/over-cap trims exceeding what the
  // primary bucket(s) needed just to reach their minimum) go back into the
  // FIRST primary bucket, never into a bucket that was just trimmed.
  if (freed > 0) {
    const actuallyAdded = distributeInto(era.primary, freed);
    freed -= actuallyAdded;
  }

  const result: Record<string, number> = {};
  for (const list of byBucket.values()) {
    for (const [id, count] of list) {
      if (count > 0) result[id] = (result[id] ?? 0) + count;
    }
  }
  return { counts: result, warnings };
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
  songCount: number
): ResolvedConstraints {
  const warnings: string[] = [];
  const era = extractEraConstraint(concept.conceptLabel, concept.artistReferenceEraTags);
  const title = buildTitleConstraint(era, songCount);
  const vocabulary = buildVocabularyConstraint(era, workspace.id, audience);

  const genreCandidates = era.unspecified
    ? []
    : genreLibrary.filter(genre => bucketKeyOf(genre.id) === era.primary).map(genre => genre.id);

  return {
    workspaceId: workspace.id,
    audienceProfileId: audience.id,
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
    requiredAtoms: [],
    hardExclusions: [...audience.hardExclusions],
    relaxableAtPeak: [...audience.relaxableAtPeak],
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
  channel: { archetype?: string };
}, audience: AudienceProfile, workspaceId: WorkspaceId = 'senior-oldpop'): ResolvedConstraints {
  const conceptLabel = opts.customConcept?.trim() || opts.projectTitle;
  return resolveConstraints({ conceptLabel }, { id: workspaceId }, audience, opts.songCount || 18);
}

export { getGenreById };
