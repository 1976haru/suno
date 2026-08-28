import type { AudienceProfile, ChannelArchetype, ConceptBreadth, GenrePack, KidsAgeTierId, WorkspaceId } from '../types';
import { genreLibrary, getGenreById } from '../data/genreLibrary';
import { ERA_LABEL, eraBucketForGenreId, type EraBucket } from '../data/eraExclusions';
import { ERA_BUCKETS_BY_GENRE_ID, type EraBucket as FineEraBucket } from '../data/eraBuckets';
import { TITLE_PATTERNS } from '../data/titlePatterns';
import { VOCABULARY_BANKS, vocabularyBanksForEra } from '../data/vocabularyBanks';
import { CHANNEL_IDENTITY_WORDS, CHANNEL_IDENTITY_WORD_CAP, GENERIC_WORD_CAP } from './lyricVocabularyRepetition';
import { qualityPolicyForWorkspace } from '../data/workspaceQualityPolicies';
import type { EraNeutralPolicy } from '../data/workspaceEraIntent';
import { workspaceEraFloorForArchetype } from '../data/workspaceEraFloor';

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
  /**
   * 지시문 46 긴급수정 (TASK A) — true일 때 이 EraConstraint는 컨셉이
   * 실제로 시대를 말해서가 아니라 data/workspaceEraFloor.ts의 채널 기본
   * 바닥(applyWorkspaceEraFloor)이 채워 넣은 것이다. "바닥은 하한이지
   * 컨셉을 이기지 않는다"는 §규약 7("실측 없이 blocking 을 만들지
   * 않는다")과 결합하면, 이 바닥에 대한 미달을 명시적 컨셉 미달("60년대
   * 올드팝"인데 실제로 안 지켜짐, 이미 검증된 blocking 대상)과 같은
   * 무게로 blocking 처리할 근거가 없다는 뜻이다 — core/designGate.ts의
   * eraIssues가 이 플래그로 blocking/advisory를 가른다. undefined(기존
   * 모든 명시적 컨셉 경로)면 기존 동작 그대로 blocking.
   */
  floorApplied?: boolean;
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
// 지시문 29 (TASK E) — 실측: "70년대 비틀즈의 향수"에서 british-beat(1950s-60s
// 장르)가 9곡으로 나왔다. 원인은 이 패턴들이 처음부터 "명시적 연대 숫자"와
// "아티스트/장르 키워드"를 하나의 정규식에 섞어 두고 있었다는 것 — "비틀"이라는
// 단어 자체가 ERA_1950_60_PATTERN 안에 있어서, freeText에 "70년대"라고 명시해도
// "비틀즈"라는 단어가 같이 있으면 1950s-60s도 동시에 걸리고, 코드 순서상
// 1950s-60s 패턴이 먼저 검사돼 그게 그대로 primary가 됐다(지시문 01 SCENE_ERA
// §6 "명시 시대 > 참조 시대"가 요구한 우선순위와 반대). 이제 "몇 년대"라고
// 숫자로 못박은 EXPLICIT 패턴과, 아티스트/서브장르 이름으로만 그 시대를
// 암시하는 KEYWORD 패턴을 분리한다 — extractEraConstraint가 EXPLICIT 히트를
// 항상 우선한다.
const ERA_1950_60_EXPLICIT_PATTERN = /(1950|1950s|50년대|1960|1960s|\b60s\b|60년|60년대)/i;
const ERA_1950_60_KEYWORD_PATTERN = /(비틀|beatles?|beat ?pop|doo-?wop|두왑|british beat)/i;
const ERA_1970_EXPLICIT_PATTERN = /(1970|1970s|\b70s\b|70년|70년대)/i;
const ERA_1970_KEYWORD_PATTERN = /(카펜터스?|carpenters?|abba|아바|모타운|motown|soul train|양키|yacht)/i;
const ERA_1980_EXPLICIT_PATTERN = /(1980|1980s|\b80s\b|80년대|80년)/i;
const ERA_1980_KEYWORD_PATTERN = /(신스팝|synth-?pop|시티팝|city ?pop|어덜트\s*컨템포러리|adult contemporary)/i;
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

const EXPLICIT_PATTERNS: [EraBucket, RegExp][] = [
  ['1950s-60s', ERA_1950_60_EXPLICIT_PATTERN],
  ['1970s', ERA_1970_EXPLICIT_PATTERN],
  ['1980s', ERA_1980_EXPLICIT_PATTERN]
];
const KEYWORD_PATTERNS: [EraBucket, RegExp][] = [
  ['1950s-60s', ERA_1950_60_KEYWORD_PATTERN],
  ['1970s', ERA_1970_KEYWORD_PATTERN],
  ['1980s', ERA_1980_KEYWORD_PATTERN]
];

/** 연대 숫자("70년대", "1970s")만 본다 — 아티스트/서브장르 키워드는 제외. */
function detectExplicitEraHits(text: string): EraBucket[] {
  const hits: EraBucket[] = [];
  for (const [bucket, pattern] of EXPLICIT_PATTERNS) if (pattern.test(text)) hits.push(bucket);
  if (ERA_2000_PATTERN.test(text)) hits.push('2000s');
  return [...new Set(hits)];
}

/** 아티스트/서브장르 키워드("비틀즈", "carpenters")만 본다 — 연대 숫자는 제외. */
function detectKeywordEraHits(text: string): EraBucket[] {
  const hits: EraBucket[] = [];
  for (const [bucket, pattern] of KEYWORD_PATTERNS) if (pattern.test(text)) hits.push(bucket);
  return [...new Set(hits)];
}

/**
 * 지시문 29 (TASK E) — 실측(70년대 세트, 두 번 반복): "70년대 비틀즈의 향수"
 * 컨셉이 british-beat(1950s-60s 장르) 9곡으로 나왔다. 원인은 ERA_1950_60_PATTERN
 * 안에 "비틀" 같은 아티스트 키워드가 연대 숫자와 한 정규식에 섞여 있었던 것 —
 * freeText에 "70년대"라고 명시해도 같은 문장에 "비틀즈"가 있으면 1950s-60s도
 * 동시에 걸리고, 코드 순서상 1950s-60s 쪽이 먼저 검사돼 그게 그대로 primary가
 * 됐다(지시문 01 SCENE_ERA §6 "명시 시대 > 참조 시대"가 요구한 우선순위와
 * 반대). "몇 년대"라고 숫자로 못박은 EXPLICIT 히트와, 아티스트/서브장르
 * 이름으로만 그 시대를 암시하는 KEYWORD 히트(freeText 자신의 키워드 +
 * artistReferenceEraTags 전부)를 분리해서, EXPLICIT이 있으면 항상 그것이
 * primary/coPrimary를 결정한다. KEYWORD만으로 걸린, EXPLICIT과 다른 버킷은
 * coPrimary로 승격되지 않고 좁은 상한의 adjacent로만 반영된다("60년대 향수를
 * 담은 70년대 트랙" — 60년대 장르를 직접 대량 배정하지 않는다). freeText에
 * EXPLICIT 연대가 전혀 없을 때만(예: "비틀즈 느낌 플레이리스트") KEYWORD
 * 히트가 그대로 primary가 된다 — 이 경우엔 충돌이 없다.
 */
const ARTIST_REFERENCE_CONFLICT_ADJACENT_SHARE = 0.17; // 정책값(추정) — "18곡 중 2~3곡까지만" 원문 요구를 비율로 옮긴 것. 청취 검증 안 됨.

/**
 * TASK B (3-1) — decade/artist-era detection. Deliberately narrow (explicit
 * decade numerals/known artist-era words only) — generic old-pop words like
 * "올드팝"/"추억"/"옛날" must NEVER trigger this (see this task's own §10 and
 * §9-2's 3rd verification concept, "비 오는 날 창가에서 듣는 올드팝", which has
 * no decade word and must resolve unspecified:true).
 */
export function extractEraConstraint(freeText: string, artistReferenceEraTags: string[] = []): EraConstraint {
  const artistHaystack = artistReferenceEraTags.join(' ');

  // v3.77 (TASK D) — checked BEFORE the single-bucket regexes below: a
  // compound decade phrase must resolve to two co-equal primaries, not
  // silently collapse to whichever single-bucket regex happens to match a
  // substring of it (see detectCompoundDecades's own doc comment for the
  // real "60~70년대" -> 0/18 1960s bug this closes).
  const compound = detectCompoundDecades(freeText);
  if (compound) {
    const [primary, coPrimary] = compound;
    const pairSet = new Set([primary, coPrimary]);
    const forbidden = REAL_ERA_BUCKETS.filter(bucket => !pairSet.has(bucket));
    return { primary, coPrimary, adjacent: [], forbidden, unspecified: false };
  }

  const explicitHits = detectExplicitEraHits(freeText);
  // 키워드 히트는 freeText 자신의 아티스트/서브장르 언급 + artistReferenceEraTags
  // 전부를 합쳐서 본다(예전 haystack 병합과 동일한 소스), explicit과 겹치는
  // 버킷은 이미 explicit 쪽에서 처리하므로 뺀다.
  const keywordHits = [...new Set([...detectKeywordEraHits(freeText), ...detectKeywordEraHits(artistHaystack)])]
    .filter(bucket => !explicitHits.includes(bucket));

  // freeText에 명시적 연대가 없다 — 키워드 히트가 그대로 판정에 참여한다
  // (충돌이 없으므로 예전 동작과 동일).
  if (!explicitHits.length) {
    const uniqueHits = [...new Set([...explicitHits, ...keywordHits])];
    if (!uniqueHits.length) return { primary: 'timeless', adjacent: [], forbidden: [], unspecified: true };
    const [primary, ...rest] = uniqueHits;
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

  // freeText가 명시적으로 연대를 말했다 — 그것이 항상 primary/coPrimary를
  // 결정한다. keywordHits(explicit과 다른 버킷)는 coPrimary로 승격되지 않고
  // 좁은 상한의 adjacent로만 반영된다.
  const [primary, ...restExplicit] = explicitHits;
  if (restExplicit.length >= 1) {
    const coPrimary = restExplicit[0];
    const extraHits = restExplicit.slice(1);
    const pairSet = new Set<EraBucket>([primary, coPrimary]);
    const adjacentFromExtra = extraHits.map(era => ({ era, maxShare: 0.25 }));
    const adjacentFromKeywordConflict = keywordHits
      .filter(era => !pairSet.has(era) && !extraHits.includes(era))
      .map(era => ({ era, maxShare: ARTIST_REFERENCE_CONFLICT_ADJACENT_SHARE }));
    const adjacent = [...adjacentFromExtra, ...adjacentFromKeywordConflict];
    const coveredBuckets = new Set([...pairSet, ...extraHits, ...keywordHits]);
    const forbidden = REAL_ERA_BUCKETS.filter(bucket => !coveredBuckets.has(bucket));
    return { primary, coPrimary, adjacent, forbidden, unspecified: false };
  }

  // 지시문 29 (TASK E) — 키워드로만 충돌하는 버킷(예: 1970s 명시 + "비틀즈"
  // 키워드의 1950s-60s)이 우연히 primary의 자연 인접 버킷(ERA_ADJACENCY)과도
  // 겹치면, 더 좁은 쪽(ARTIST_REFERENCE_CONFLICT_ADJACENT_SHARE)이 이긴다 —
  // "british-beat는 18곡 중 2~3곡까지만"이 일반 인접 상한(0.25, 4~5곡)보다
  // 더 타이트한 요구이기 때문. keywordHits에 없는 자연 인접 버킷은 기존
  // 0.25 그대로 유지한다.
  const adjacentSet = new Set(ERA_ADJACENCY[primary]);
  const keywordConflictSet = new Set(keywordHits.filter(era => era !== primary));
  const allAdjacentEras = new Set([...adjacentSet, ...keywordConflictSet]);
  const adjacent = [...allAdjacentEras].map(era => ({
    era,
    maxShare: keywordConflictSet.has(era) ? ARTIST_REFERENCE_CONFLICT_ADJACENT_SHARE : 0.25
  }));
  const coveredBuckets = new Set([primary, ...allAdjacentEras]);
  const forbidden = REAL_ERA_BUCKETS.filter(bucket => !coveredBuckets.has(bucket));

  return { primary, adjacent, forbidden, unspecified: false };
}

/** 지시문 46 (TASK B) — data/eraBuckets.ts의 세분화 EraBucket을 이 파일의 4-버킷 EraConstraint 어휘로 접는다. 1990s/2010s/2020s/era-neutral은 이 앱의 EraConstraint가 아직 다루지 않는 시대라 undefined(바닥 미적용)를 반환한다. */
function coarseBucketForFineEra(fine: FineEraBucket): EraBucket | undefined {
  if (fine === '1950s' || fine === '1960s') return '1950s-60s';
  if (fine === '1970s') return '1970s';
  if (fine === '1980s') return '1980s';
  if (fine === '2000s') return '2000s';
  return undefined;
}

/**
 * 지시문 46 (TASK B) — 하루: "카페에서 듣고 싶은 노래처럼 주제를 선택해도
 * 기본은 60·70 세대 감성이어야 한다." extractEraConstraint가
 * unspecified:true(컨셉이 시대를 전혀 말하지 않음)를 반환했을 때만
 * data/workspaceEraFloor.ts의 채널 기본 시대로 채운다 — 새 관문이 아니라
 * 기존 시대 관문(era-quota·era-neutral-share 상하한)이 원래도 가지고
 * 있던 "era.unspecified면 통째로 꺼짐" 게이트 뒤에 폴백 하나를 더하는
 * 것뿐이다. 컨셉이 실제로 시대를 말하면(unspecified:false) 이 함수는
 * 입력을 그대로 반환한다 — 바닥은 하한이지 컨셉을 이기지 않는다.
 * data/workspaceEraFloor.ts에 없는 아키타입(kr-2030/jp-2030/kr-idol-male/female/
 * kids 등)도 그대로 반환 — 그 워크스페이스는 시대가 정체성이 아니다.
 */
export function applyWorkspaceEraFloor(era: EraConstraint, archetype: ChannelArchetype | undefined): EraConstraint {
  if (!era.unspecified) return era;
  const floor = workspaceEraFloorForArchetype(archetype);
  if (!floor || !floor.defaultEraBuckets.length) return era;
  const coarseBuckets = [...new Set(floor.defaultEraBuckets.map(coarseBucketForFineEra).filter((bucket): bucket is EraBucket => Boolean(bucket)))];
  if (!coarseBuckets.length) return era;
  const [primary, coPrimary] = coarseBuckets;
  // 지시문 46 긴급수정 (TASK A) — floorApplied:true로 표시해 core/designGate.ts's
  // eraIssues가 이 미달을 blocking이 아니라 advisory로 처리하게 한다 —
  // EraConstraint.floorApplied 자신의 doc comment 참고.
  return { primary, coPrimary, adjacent: [], forbidden: [], unspecified: false, floorApplied: true };
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
  genreOrder?: readonly string[],
  /**
   * 정합성 점검 §1 결함1 fix — real measured bug: distributeInto used to
   * always cap a genre it opens/tops-up at the module-wide
   * GENRE_ERA_QUOTA_PER_GENRE_CAP (5) regardless of the CALLER's actual
   * resolved breadth. That's correct for 'balanced' (designGate.ts's
   * BREADTH_THRESHOLDS.balanced.genre.maxPerGenre is also 5) but wrong for
   * 'variety' (maxPerGenre 4): a real "1950년대 향수가 느껴지는 올드팝"
   * concept on senior-morning auto-detects 'variety' breadth (era-adjacency
   * counts as a variety signal — see detectConceptBreadth), so
   * chooseGenreIds only pre-seeds a few genres, era.primary's fill then
   * opens fresh 1950s-60s genres capped at 5 each — one song over variety's
   * own 4-cap — and design-gate's 'genre-max' check (senior-morning is
   * intentionally exempt from the auto-widening every other archetype gets
   * for this exact check, per that check's own doc comment) blocked a
   * mathematically-satisfiable concept (6 real eligible 1950s-60s genres
   * exist — more than enough at cap 4). Defaults to the original constant
   * so every call site that doesn't know its own breadth is unaffected.
   */
  perGenreCap: number = GENRE_ERA_QUOTA_PER_GENRE_CAP,
  /**
   * 지시문 46 긴급수정 (TASK A) — distributeInto의 Phase 2(부족분을 채우려
   * genreLibrary 전체에서 풀 밖의 새 장르를 여는 단계)를 켤지 끌지.
   * 기본 true(모든 기존 호출부 불변) — era가 컨셉이 실제로 명시한
   * 것일 때(예: "60년대 올드팝")는 그 의도를 채우기 위해 새 장르를 여는
   * 것이 맞다. false는 era.floorApplied(사용자가 고르지 않은 채널 기본
   * 바닥)일 때만 쓴다 — 실측: 새 장르를 열면 사용자가 선택한 팔레트
   * 계열 밖 장르가 들어와 palette-variety-max(팔레트 계열 그룹 4종,
   * 청취 검증값)를 깬다. false면 이미 선택된 풀 안에서만 재분배하고,
   * 부족분은 채우지 못한 채로 둔다(§"바닥은 하한이다" — 사용자가 고르지
   * 않은 장르를 강제로 끌어오지 않는다).
   */
  allowNewGenres: boolean = true
): { counts: Record<string, number>; warnings: string[] } {
  if (era.unspecified || !songCount) return { counts: genreCounts, warnings: [] };
  const genreOrderRank = genreOrder ? new Map(genreOrder.map((id, idx) => [id, idx])) : undefined;

  const warnings: string[] = [];
  const adjacentMap = new Map(era.adjacent.map(a => [a.era, a.maxShare]));
  const forbiddenSet = new Set(era.forbidden);
  const genericCap = Math.floor(songCount * GENERIC_ERA_SHARE);

  // 지시문 79 (TASK A-1) — 마지막 안전망(§아래 "재배분 후보가 부족해 …"
  // 분기)이 되돌릴 수 있는 후보 집합. 실측 결함: trimBucket은 상한을 넘긴
  // 버킷에서 **앞쪽 장르를 통째로 삭제**하므로(count-cut이 0이면 kept에
  // 넣지 않는다, §585-597행), 인접 상한이 낮고 그 버킷에 장르가 몰려
  // 있으면 살아남는 장르가 1종이 된다. 그 뒤 주 시대 버킷에 후보가 하나도
  // 없으면(예: showa-70s에 1950s-60s 장르가 0종) 안전망이 "살아남은
  // 목록"만 보고 라운드로빈하므로 그 1종에 15곡이 전부 몰렸다
  // (showa-seventies × "60년대 올드팝" 실측 15/15). 삭제 전 원본 id를
  // 버킷과 함께 기억해 두었다가, 안전망 단계에서 **금지 시대가 아닌**
  // 원본 장르까지 후보에 넣는다 — 금지 시대는 사용자가 명시적으로 뺀
  // 것이므로 되돌리지 않는다.
  const originalBucketOf = new Map<string, string>();
  const byBucket = new Map<string, [string, number][]>();
  for (const [id, count] of Object.entries(genreCounts)) {
    const bucket = bucketKeyOf(id);
    originalBucketOf.set(id, bucket);
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), [id, count]]);
  }

  // 지시문 79 (TASK A-1) — 주 시대를 채울 후보가 **하나도 없을 때**는
  // 이 함수를 통째로 건너뛴다. 실측 결함(oldpop-lounge × "2000년대 감성"
  // 15/15, morning-showa-cafe / showa-seventies 동일): 주 시대 버킷에
  // 넣을 장르가 기존 풀에도 genreLibrary(채널 필터 통과분)에도 0종이면,
  // 이 함수가 할 수 있는 일은 금지·상한 버킷에서 곡을 **빼는 것뿐**이다 —
  // 세트를 요청한 시대 쪽으로 한 걸음도 옮기지 못하면서 사용자가 고른
  // 장르 구성만 무너뜨린다(남는 장르가 1종이 되면 15곡이 전부 그 하나로
  // 간다). 그럴 바에는 사용자가 고른 구성을 그대로 두고 "이 채널로는 이
  // 시대를 표현할 수 없다"는 경고만 남기는 편이 낫다 — 판정 기준은
  // check:gates가 이미 쓰는 "지원하지 않는 조합"과 같은 축이다.
  //
  // 주 시대 후보가 **하나라도** 있으면(부분적으로라도 시대 쪽으로 옮길 수
  // 있으면) 기존 동작 그대로다 — 이 분기는 0종일 때만 발동한다.
  //
  // era.floorApplied(사용자가 쓴 게 아니라 채널 바닥이 넣은 시대 힌트)는
  // 이 분기에서 제외한다. 두 가지 이유가 있다. ① 실측: 붕괴가 관측된
  // 조합은 전부 사용자가 명시한 컨셉이었고, 바닥 경로는 컨셉이 비어 있어도
  // 늘 정상 범위(5종 → 4종)였다. ② 바닥 경로는 이미 allowNewGenres:false로
  // "풀 안에서만 재분배"하도록 따로 설계돼 있어(§allowNewGenres의 doc
  // comment) 이 분기가 하려는 보호를 다른 방식으로 이미 갖고 있다.
  // 실측 회귀로 확인: 바닥 경로까지 건너뛰게 하면 tests/v343.test.ts의
  // instrumentSet 주입 검사가 깨진다(장르 배정이 달라진다).
  const primaryCandidateCount = (() => {
    const inPool = (byBucket.get(era.primary) ?? []).length;
    if (inPool > 0) return inPool;
    if (!allowNewGenres) return -1;
    return genreLibrary.filter(genre => channelFilter(genre) && bucketKeyOf(genre.id) === era.primary).length;
  })();
  if (primaryCandidateCount === 0) {
    return {
      counts: genreCounts,
      warnings: [`${ERA_LABEL[era.primary]} 장르가 이 채널의 후보에 하나도 없어 시대 배분을 적용하지 않았습니다 — 선택하신 장르 구성을 그대로 씁니다.`]
    };
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
  //
  // 지시문 46 긴급수정 (TASK A) — allowNewGenres:false일 때는 이 스윕을
  // 건너뛴다. 실측: freed로 넘긴 뒤 distributeInto가 allowNewGenres:false라
  // 새 장르를 못 열면(§distributeInto의 newIds=[] 분기), 기존 버킷 멤버가
  // 이미 perGenreCap에 도달한 경우 그 freed 물량을 어디에도 놓지 못하고
  // 그대로 사라졌다(18곡 입력 -> 13곡 출력, 실측 확인) — v4.2 bugfix가
  // 막았던 것과 같은 "silently dropping songs" 결함이 allowNewGenres:false
  // 조합에서 새로 재발했다. 바닥(사용자가 고르지 않은 시대 힌트)은 새
  // 장르를 열 수 없으니, 애초에 이 orphan 버킷(예: adult-contemporary의
  // 1980s)을 freed로 뽑아내지 않고 그대로 둔다 — "바닥은 하한이다,
  // 사용자가 실제로 고른 장르를 강제로 비우지 않는다"는 원칙과도 맞는다.
  if (allowNewGenres) {
    for (const bucket of [...byBucket.keys()]) {
      if ((primaryBuckets as string[]).includes(bucket) || bucket === 'generic' || adjacentMap.has(bucket as EraBucket) || forbiddenSet.has(bucket as EraBucket)) continue;
      const list = byBucket.get(bucket) ?? [];
      freed += list.reduce((sum, [, count]) => sum + count, 0);
      byBucket.delete(bucket);
    }
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
    const newIds = allowNewGenres
      ? genreLibrary
          .filter(genre => channelFilter(genre) && bucketKeyOf(genre.id) === targetBucket)
          .map(genre => genre.id)
          .filter(id => !existingIdSet.has(id))
      : [];
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
          if (current >= perGenreCap) continue;
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
      const genresToOpen = Math.min(newIds.length, Math.max(1, Math.ceil(remaining / perGenreCap)));
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

  // 지시문 46 긴급수정 (TASK A) — 보존 안전망: allowNewGenres:false(바닥
  // 유래 era)에서 distributeInto가 기존 버킷 멤버를 이미 perGenreCap까지
  // 채웠는데도 freed가 남을 수 있다(§실측: 15곡 입력에 10곡만 출력 — 5곡
  // 소실, allowNewGenres:false가 Phase 2를 막아 기존 코드가 항상 전제하던
  // "새 장르를 열어서라도 다 채운다"는 안전판이 사라졌다). allowNewGenres:true인
  // 기존 모든 호출부는 Phase 2가 있어 이 분기가 사실상 발동하지 않는다
  // (freed가 남는 유일한 경우는 genreLibrary 전체에도 후보가 없는 극단적
  // 예외였고, 그건 지금도 동일하게 여기서 처리된다 — 새 동작이 아니라
  // 기존에도 있던 마지막 방어선이 이제 실제로 쓰이는 것뿐이다). 총 곡수
  // 보존이 장르당 상한 준수보다 우선한다 — 빈 슬롯(undefined genreId)을
  // 만드는 것이 상한을 살짝 넘기는 것보다 훨씬 나쁘다.
  //
  // 실측(라운드로빈이 아니라 최다 장르 1종에 몰아준 첫 버전) — showa-cafe
  // "70년대" 같은 EXPLICIT 컨셉(allowNewGenres:true지만 genreLibrary에도
  // 후보가 정말 없는 극단적 예외)에서 한 장르에 몰리면 그 장르의 좁은
  // BPM 범위 하나로 쏠려 bpm-stddev 관문을 깬다(check:gates 실측). 여러
  // 장르에 라운드로빈으로 나눠 템포 다양성을 덜 해친다.
  if (freed > 0) {
    const allEntries = [...byBucket.values()].flat();
    // 지시문 79 (TASK A-1) — 살아남은 목록이 1종뿐이면 여기서 15곡이 한
    // 장르로 몰린다(§originalBucketOf의 doc comment, 실측 15/15). trimBucket이
    // 통째로 삭제한 원본 장르 중 **금지 시대가 아닌 것**을 후보로 되살려
    // 라운드로빈 대상을 넓힌다. 되살린 장르는 count 0에서 시작하므로 아래
    // 루프가 자기 버킷 목록에 새로 넣어 준다. 금지 시대(era.forbidden)는
    // 제외한다 — "이 시대는 빼라"는 사용자의 명시적 의도다.
    const revivable: [string, string][] = [];
    for (const [id, bucket] of originalBucketOf) {
      if (forbiddenSet.has(bucket as EraBucket)) continue;
      if (allEntries.some(([entryId]) => entryId === id)) continue;
      revivable.push([id, bucket]);
    }
    for (const [id, bucket] of revivable) {
      byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), [id, 0]]);
      allEntries.push([id, 0]);
    }
    if (allEntries.length) {
      const ids = allEntries.map(([id]) => id);
      let idx = 0;
      let remainingToPlace = freed;
      while (remainingToPlace > 0) {
        const id = ids[idx % ids.length];
        for (const list of byBucket.values()) {
          const entryIdx = list.findIndex(([entryId]) => entryId === id);
          if (entryIdx !== -1) {
            list[entryIdx] = [id, list[entryIdx][1] + 1];
            break;
          }
        }
        remainingToPlace -= 1;
        idx += 1;
      }
      warnings.push(`재배분 후보가 부족해 ${freed}곡을 기존 장르들에 상한을 넘겨 라운드로빈으로 되돌렸습니다.`);
      freed = 0;
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
 * 지시문 33 (§1) — "era-neutral 하한을 먼저 확보한다, 나머지로 시대 비중을
 * 계산한다"의 실제 구현. applyEraQuota 자체는 건드리지 않는다(이미 여러
 * 지시문이 다듬은 anti-singleton/coPrimary 로직이 있어 그 안에 하한을
 * 끼워 넣는 건 위험이 크다) — 대신 applyEraQuota가 끝난 결과에 대해, era-
 * neutral 총량이 정책 하한보다 적으면 비-era-neutral 장르들에서 필요한
 * 만큼만 회수해 era-neutral 장르에 옮겨 붓는 후처리 단계다(지시문 31의
 * reorderForEnergyContinuity와 같은 "핵심 로직은 안 건드리고 후처리로
 * 보정한다" 패턴).
 *
 * "era-neutral"의 기준은 applyEraQuota/eraNeutralShareOf가 이미 쓰는 것과
 * 반드시 같아야 한다 — bucketKeyOf(구·거친 5버킷 분류, 'generic')다. 처음
 * isEraNeutralGenreId(신·세밀 ERA_BUCKETS_BY_GENRE_ID)로 짰다가 실측에서
 * 걸렸다: "6070년대" 컴파운드 컨셉의 실제 결과가 bucketKeyOf 기준 generic
 * 3곡을 이미 갖고 있었는데, isEraNeutralGenreId 기준으로는 다른 장르
 * 집합을 "부족"으로 오판해 불필요하게 1970s 버킷에서 회수 — 이미 통과하던
 * v379EraParsing.test.ts(1970s ≥30%)를 27.78%로 깨뜨렸다. 두 분류 체계가
 * 항상 일치하지 않는다는 것 자체가 지시문 32에서 이미 확인된 사실이다.
 *
 * 회수는 "가장 큰 것부터 한 곡씩, 라운드로빈"이다 — 한 장르를 통째로
 * 비우지 않는다(genreSingletonRootCause.test.ts가 지키는 불변식: 이미
 * 3곡 이상인 장르에서만, 최소 2곡은 항상 남긴다 — 실측에서 걸림: "가장
 * 큰 것부터 count-1까지" 방식은 5곡짜리 장르를 1곡으로 만들어 새 싱글톤을
 * 만들었다). 여러 비-neutral 장르에 걸쳐 매 라운드 재정렬하며 1곡씩 덜기
 * 때문에 어느 한 버킷(예: coPrimary)만 불균형하게 깎이지 않는다.
 *
 * policy.minTracks/maxTracks는 18곡 기준값 — songCount가 다르면 비례
 * 스케일한다. verified:false 정책이므로 이 함수의 산출물(배정 결과)은
 * advisory 판정과 별개다 — designGate.ts의 eraNeutralFloorAdvisory가 그
 * 결과를 다시 감사할 뿐, 이 함수 자체는 blocking을 만들지 않는다.
 */
export function ensureEraNeutralFloor(
  genreCounts: Record<string, number>,
  songCount: number,
  policy: EraNeutralPolicy | undefined,
  channelFilter: (genre: GenrePack) => boolean,
  perGenreCap: number = GENRE_ERA_QUOTA_PER_GENRE_CAP,
  /** 지시문 46 긴급수정 (TASK A) — applyEraQuota의 동명 파라미터와 같은 의미·같은 기본값. era.floorApplied일 때 false로 넘겨, 하한 확보를 위해 genreLibrary 전체에서 사용자가 고르지 않은 새 era-neutral 장르를 여는 것을 막는다. */
  allowNewGenres: boolean = true
): { counts: Record<string, number>; warnings: string[] } {
  if (!policy || !songCount) return { counts: genreCounts, warnings: [] };
  const floor = Math.round((policy.minTracks / 18) * songCount);
  if (floor <= 0) return { counts: genreCounts, warnings: [] };

  const isNeutral = (id: string) => bucketKeyOf(id) === 'generic';
  const entries = Object.entries(genreCounts);
  const neutralIds = entries.filter(([id]) => isNeutral(id)).map(([id]) => id);
  const currentNeutral = entries.filter(([id]) => isNeutral(id)).reduce((sum, [, c]) => sum + c, 0);
  if (currentNeutral >= floor) return { counts: genreCounts, warnings: [] };

  const needed = floor - currentNeutral;
  const counts = new Map(entries);
  let remaining = needed;
  // 라운드로빈으로 매 패스마다 재정렬 — 한 장르에 집중되지 않고, 3곡
  // 미만(회수 후 2곡 미만이 될) 장르는 아예 건드리지 않는다.
  let progressed = true;
  while (remaining > 0 && progressed) {
    progressed = false;
    const candidates = [...counts.entries()]
      .filter(([id, count]) => !isNeutral(id) && count >= 3)
      .sort((a, b) => b[1] - a[1]);
    for (const [id] of candidates) {
      if (remaining <= 0) break;
      const current = counts.get(id)!;
      if (current < 3) continue;
      counts.set(id, current - 1);
      remaining -= 1;
      progressed = true;
    }
  }
  const actuallyFreed = needed - remaining;
  const warnings: string[] = [];
  if (actuallyFreed <= 0) {
    return { counts: genreCounts, warnings: [`era-neutral 하한(${floor}곡, 추정치)을 확보할 비-era-neutral 장르 여유가 없습니다(모든 장르가 2곡 이하).`] };
  }

  // era-neutral 후보 장르를 anti-singleton 방식(기존 장르 먼저 채움 →
  // 부족하면 새 장르를 필요한 만큼만 연다)으로 채운다 — applyEraQuota의
  // distributeInto와 같은 원리.
  const candidatePool = allowNewGenres
    ? genreLibrary
        .filter(genre => channelFilter(genre) && isNeutral(genre.id))
        .map(genre => genre.id)
        .filter(id => !neutralIds.includes(id))
    : [];
  let toFill = actuallyFreed;
  const topUp = (ids: readonly string[]) => {
    let filling = true;
    while (toFill > 0 && filling) {
      filling = false;
      for (const id of ids) {
        if (toFill <= 0) break;
        const current = counts.get(id) ?? 0;
        if (current >= perGenreCap) continue;
        counts.set(id, current + 1);
        toFill -= 1;
        filling = true;
      }
    }
  };
  topUp(neutralIds);
  const pool = [...candidatePool];
  while (toFill > 0 && pool.length) {
    const genresToOpen = Math.min(pool.length, Math.max(1, Math.ceil(toFill / perGenreCap)));
    const chosen = pool.splice(0, genresToOpen);
    topUp(chosen);
  }
  if (toFill > 0) {
    warnings.push(`era-neutral 후보 장르가 부족해 하한(${floor}곡)을 ${toFill}곡만큼 채우지 못했습니다.`);
    // 지시문 46 긴급수정 (TASK A) — applyEraQuota의 동일 안전망과 같은
    // 이유: 위 첫 while 루프(981-994행)가 이미 비-neutral 장르에서
    // toFill만큼 실제로 빼냈다 — neutral 쪽에 다 못 옮기면 그 곡이 그대로
    // 사라진다(총 곡수 소실). 총 곡수 보존이 era-neutral 하한 준수보다
    // 우선한다 — 못 옮긴 만큼은 원래 빼낸 비-neutral 장르 중 가장 큰
    // 것에 그대로 돌려준다.
    // 지시문 46 긴급수정 (TASK A) — applyEraQuota의 동일 안전망과 같은
    // 이유로 한 장르에 몰아주지 않고 라운드로빈으로 돌려준다(§bpm-stddev
    // 관문 실측).
    const nonNeutralEntries = [...counts.entries()].filter(([id]) => !isNeutral(id));
    const returnPool = nonNeutralEntries.length ? nonNeutralEntries : [...counts.entries()];
    if (returnPool.length) {
      const ids = returnPool.map(([id]) => id);
      for (let i = 0; i < toFill; i += 1) {
        const id = ids[i % ids.length];
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
  }

  const result: Record<string, number> = {};
  for (const [id, count] of counts) {
    if (count > 0) result[id] = count;
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
export function genreCountsFromIds(
  ids: string[],
  songCount: number,
  cap: number,
  /**
   * 지시문 47 (TASK B) — 실측: 기존 genresToOpen = ceil(remaining/cap)은
   * "songCount/cap이 요구하는 최소 장르 수"만 채운다 — 그게 genre-variety
   * 관문의 자기 하한(예: balanced 4종)보다 낮을 수 있다(15곡·cap 5 →
   * ceil(15/5)=3 < 4). oldpop-lounge에서 사용자가 정확히 4종을 골랐을
   * 때뿐 아니라, 채널 preferredGenres 전체(24종 등 카탈로그 전부)를 그대로
   * opts.genreIds로 넘기는 훨씬 흔한 기본 상태에서도 똑같이 3종으로
   * 뭉쳐 관문을 막았다 — "장르가 몇 종 있는가"가 아니라 "genresToOpen이
   * 관문 하한보다 작은가"가 진짜 조건이었다.
   *
   * 실측 두 차례 조정 끝에 이 형태로 정착:
   *  1. 처음엔 "distinct id 전부에 최소 2곡을 보장"하는 2단계 알고리즘을
   *     시도했다가 core/setDirector.ts 호출부·tests/v367.test.ts's arc
   *     BPM 곡선을 깼다 — 카탈로그 전체(46종 등)를 상한(genre.max, 9)까지
   *     억지로 다 채우면 18곡이 너무 넓게 퍼져 곡선이 납작해졌다.
   *  2. genre.max가 아니라 genre.min(관문이 요구하는 최소치, 예: 4)만
   *     genresToOpen의 하한으로 올린다 — 기존 알고리즘의 "장르가 많으면
   *     그중 필요한 만큼만 연다"는 취지(카탈로그 전체를 다 쓰지 않는다)는
   *     그대로 두고, "그 필요한 만큼"이 관문 하한보다 낮아지지만 않게
   *     한다. songCount/2보다 크게 열면 라운드로빈 특성상 1곡짜리
   *     싱글톤이 생길 수 있어(genreSingletonRootCause.test.ts's 불변식)
   *     floor(songCount/2)로도 한 번 더 캡핑한다.
   */
  minDistinctGenres?: number
): Record<string, number> {
  if (!ids.length || songCount <= 0) return {};
  const counts: Record<string, number> = {};
  let remaining = songCount;
  const pool = [...new Set(ids)];
  const effectiveMin = minDistinctGenres !== undefined ? Math.max(1, Math.min(minDistinctGenres, Math.floor(songCount / 2))) : 1;
  while (remaining > 0 && pool.length) {
    const genresToOpen = Math.min(pool.length, Math.max(effectiveMin, Math.ceil(remaining / cap)));
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

/**
 * 지시문 12 (TASK A-3) — genreLibrary 354종 전수 부여된 세분화 eraBuckets
 * (data/eraBuckets.ts)에서 이 장르가 'era-neutral'인지 직접 읽는다 (구)
 * eraBucketForGenreId의 null 반환과는 다르다 — 그쪽은 하위호환을 위해
 * timeless 6종을 여전히 'timeless'로 반환하는 특례가 있다(eraExclusions.ts).
 * 여기서는 그 특례 없이 "이 장르가 특정 연대를 주장하지 않는가"를 정직하게
 * 판정한다 — timeless 6종도 (신) 데이터에서는 era-neutral이므로 포함된다.
 */
export function isEraNeutralGenreId(genreId: string): boolean {
  const fineBuckets = ERA_BUCKETS_BY_GENRE_ID[genreId];
  // genreLibrary 354종은 전수 커버되므로 실제 장르 id는 항상 매핑이 있다 —
  // 매핑이 없는 id(존재하지 않는 장르, 또는 eraBuckets.ts 갱신을 놓친 신규
  // 장르)는 "특정 시대를 주장한다는 근거가 없다"는 원칙에 따라 보수적으로
  // era-neutral 취급한다(구 시스템의 generic 폴백과 같은 안전망).
  return !fineBuckets || (fineBuckets.length === 1 && fineBuckets[0] === 'era-neutral');
}

/**
 * 지시문 12 (TASK A-3) — "era-neutral 장르는 primary share 계산의 분모에서
 * 제외한다": era-neutral 장르가 섞여 있어도 그 곡들을 아예 빼고 남은
 * 시대-표기 장르들끼리만 비중을 계산한다. 18곡 중 era-neutral 6곡이면
 * 나머지 12곡에 대해서만 목표 비중(예: 78%)을 요구하는 식 — era-neutral
 * 곡의 존재가 실제 시대 장르 배치의 정확도 요구를 흐리지 않게 한다.
 */
export function eraPrimaryShareOf(genreCounts: Record<string, number>, bucket: EraBucket): number {
  let bucketCount = 0;
  let nonNeutralTotal = 0;
  for (const [id, count] of Object.entries(genreCounts)) {
    if (isEraNeutralGenreId(id)) continue;
    nonNeutralTotal += count;
    if (bucketKeyOf(id) === bucket) bucketCount += count;
  }
  return nonNeutralTotal ? bucketCount / nonNeutralTotal : 0;
}

/** era-neutral 장르의 비중 — 분모는 전체 곡수(제외 없음). (구) era-unspecified-share/genericShare가 쓰던 "generic" 버킷과 동일한 모수, era-neutral로 명명만 정정. */
export function eraNeutralShareOf(genreCounts: Record<string, number>): number {
  const total = Object.values(genreCounts).reduce((sum, count) => sum + count, 0);
  if (!total) return 0;
  let neutralCount = 0;
  for (const [id, count] of Object.entries(genreCounts)) {
    if (isEraNeutralGenreId(id)) neutralCount += count;
  }
  return neutralCount / total;
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
  /** 지시문 46 (TASK B) — applyWorkspaceEraFloor가 컨셉에 시대 신호가 없을 때 채널 기본 시대를 찾는 데 쓴다. 없으면(기존 모든 호출부) 바닥 미적용 — 순수 추가, 기존 동작 불변. */
  archetype?: ChannelArchetype;
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
  // 지시문 46 긴급수정 (TASK A) — 지시문 46 TASK B가 남긴 미완분: applyWorkspaceEraFloor를
  // 호출하는 곳이 실제로는 0곳이었다(§실측). 이전 시도에서 여기 바로 이
  // 자리에 바닥을 적용했다가 tests/designGate.test.ts 6건이 깨졌는데,
  // 진짜 원인을 이번에 추적했다: applyWorkspaceEraFloor가 만드는
  // coPrimary(예: senior-oldpop 바닥의 1950s-60s+1970s)가
  // detectConceptBreadth의 hasCompoundEra 신호와 그대로 겹쳐, "컨셉이
  // 실제로 두 시대를 언급했다"는 신호와 "컨셉이 시대를 전혀 안 말해서
  // 바닥을 채워 넣었다"는 신호를 구분하지 못했다 — 컨셉 미지정 팩이
  // 전부 breadth='variety'(가장 넓은 등급)로 오분류돼 genre-max/
  // genre-variety 임계값이 통째로 바뀌었다. breadth는 반드시 컨셉이
  // 실제로 말한 것(detectedEra, 바닥 적용 전)만 봐야 한다 — 장르 후보/
  // 어휘/제목 제약은 바닥이 적용된 `era`를 쓰고, breadth만 분리한다.
  const era: EraConstraint = eraIntent.mode === 'safety-over-era' && !detectedEra.unspecified
    ? { primary: 'timeless', adjacent: [], forbidden: [], unspecified: true }
    : applyWorkspaceEraFloor(detectedEra, workspace.archetype);
  if (eraIntent.mode === 'safety-over-era' && !detectedEra.unspecified) {
    warnings.push(`이 워크스페이스는 시대 지정을 사용하지 않습니다(안전 우선) — 감지된 "${ERA_LABEL[detectedEra.primary]}" 시대 신호를 무시했습니다.`);
  }
  const title = buildTitleConstraint(era, songCount);
  const vocabulary = buildVocabularyConstraint(era, workspace.id, audience);
  // 지시문 46 긴급수정 (TASK A) — breadth는 위 doc comment대로 detectedEra(바닥
  // 미적용 원본)로만 판정한다. safety-over-era로 era 자체가 timeless로
  // 강제된 경우에도 breadth는 실제 감지된 시대 신호를 그대로 반영해야
  // 하므로 detectedEra를 쓴다(기존 동작과 동일 — 이 분리는 오직
  // applyWorkspaceEraFloor의 합성 coPrimary를 breadth 판정에서 빼내는
  // 것일 뿐, 그 외의 기존 breadth 계산 입력은 전혀 바꾸지 않는다).
  const breadth = concept.breadthOverride ?? detectConceptBreadth(concept.conceptLabel, detectedEra);
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
  return resolveConstraints({ conceptLabel, breadthOverride: opts.breadthOverride }, { id: workspaceId, archetype: opts.channel.archetype as ChannelArchetype | undefined }, audience, opts.songCount || 18, kidsAgeTierId);
}

export { getGenreById };
