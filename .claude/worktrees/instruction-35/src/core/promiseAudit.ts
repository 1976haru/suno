import type { SongIdea, SongScores } from '../types';
import { decomposeArtistReferences, type DecomposedReference } from './artistReferenceDecomposer';
import { extractEraConstraint, type EraConstraint } from './constraints';
import { eraBucketForGenreId, ERA_LABEL } from '../data/eraExclusions';
import { vocabularyBanksForEra } from '../data/vocabularyBanks';
import { seasonPacks } from '../data/presets';
import { SITUATION_FRAME_RULES } from '../data/lyricThemes';
import { getGenreById } from '../data/genreLibrary';
import { matchConceptRules } from '../data/conceptKeywords';
import {
  emotionArcsBrightOpening,
  emotionArcsCalmThroughout,
  emotionArcsStrongLift
} from './localGenerator';
import { titleHookOverlapWarning } from './quality';
import { classifyTitleShape } from './titleShapeVariety';

/**
 * v3.76 (TASK A) — real measurement, Haru's own words: "실제로 듣는
 * 청취자들이 제목과 같은 향수를 느끼고... 이런 평가를 받고 싶어." Every metric
 * this app has measured so far (BPM spread, genre similarity, word count,
 * prompt length) answers "is this internally consistent", never "does the
 * song deliver what the concept promised". A concept text makes several
 * concrete PROMISES (an era, an artist-sound reference, a mood, ...); this
 * module decomposes those promises and measures whether the generated pack
 * actually kept each one — the closest proxy this codebase has to "does the
 * listener feel what the title said they would".
 *
 * Naming note: the spec's own sketch names the per-promise type `Promise`,
 * which would shadow the built-in ES `Promise` (async) type for the whole
 * module and anything importing it under that name — a real landmine, not
 * a style nitpick (any `async`/`await` code sharing this import would
 * silently resolve to the wrong `Promise`). Renamed to `ConceptPromise`.
 *
 * Signature note: the spec's sketch takes `(songs, constraints, interpretation)`
 * — `constraints` from A3, `interpretation` from setDirector.ts's
 * InterpretedIntent. In practice neither carries a plain, original
 * `conceptLabel` string reliably (InterpretedIntent has no raw freeText
 * field; segments already decompose it), so this instead takes the raw
 * concept text directly plus an optional ResolvedConstraints (reused for
 * the era promise specifically, since that's already fully resolved
 * there) — same pragmatic-signature trade-off A3's own resolveConstraints
 * made, documented for the same reason.
 */

export type ConceptPromiseKind = 'era' | 'reference' | 'mood' | 'genre' | 'situation' | 'season' | 'motion' | 'cast';

export interface ConceptPromise {
  id: string;
  kind: ConceptPromiseKind;
  labelKo: string;
  /** The part of the concept text that triggered this promise. */
  sourceText: string;
  checkTargets: ('genre' | 'stylePrompt' | 'lyrics' | 'title' | 'emotionArc')[];
  /**
   * v4.5 (TASK D, 4-3) — only set on a 'reference' promise built by the
   * fallback path (detectFallbackReferencePromise below) for an artist NOT
   * in data/artistReferenceSeeds.ts's seed table. Carries the genre ids
   * data/conceptKeywords.ts's own keyword rules matched from the concept
   * text surrounding the unrecognized name (e.g. "포크" in "사이먼과 가펑클
   * 같은 담백한 포크 하모니" already resolves to folk-pop/oldpop-folk-rock-70s
   * via the SAME rule table core/conceptAgent.ts already uses for genre
   * recommendation) — measured against, since there's no curated trait list
   * for an unlisted artist to check against instead. Never set on a
   * seed-matched reference promise, which measures the real curated traits.
   */
  fallbackGenreIds?: string[];
  /** v4.5 (TASK D, 4-2) — only set on 'situation'/'motion'/'cast' promises: the data/lyricThemes.ts axis value (frameId for situation, motionKo/castKo for the other two) this promise expects generated songs to match. */
  expectedAxisValue?: string;
}

export interface PromiseResult {
  promise: ConceptPromise;
  byTarget: Record<string, number>;
  fulfillment: number;
  failedTracks: number[];
  explanationKo: string;
}

export interface PromiseAuditReport {
  conceptLabel: string;
  promises: PromiseResult[];
  overallFulfillment: number;
  weakestPromise: string;
  warnings: string[];
}

function ratio(hits: number, total: number): number {
  return total > 0 ? hits / total : 0;
}

// ---------------------------------------------------------------------------
// Promise decomposition — concept text -> ConceptPromise[]
// ---------------------------------------------------------------------------

const MOOD_KEYWORDS: { pattern: RegExp; labelKo: string; brightPools: string[][]; styleWords: string[] }[] = [
  {
    pattern: /밝은|경쾌|신나는|명랑|upbeat|bright/i,
    labelKo: '밝음',
    brightPools: [emotionArcsBrightOpening, emotionArcsStrongLift],
    styleWords: ['bright', 'uplifting', 'joyful', 'sunny', 'buoyant']
  },
  {
    pattern: /잔잔한|차분한|조용한|calm|mellow|quiet/i,
    labelKo: '잔잔함',
    brightPools: [emotionArcsCalmThroughout],
    styleWords: ['gentle', 'soft', 'calm', 'mellow', 'unhurried']
  }
];

/** Fallback keyword-based classification for moods with no dedicated exported emotion-arc pool (e.g. melancholic). */
const EMOTION_ARC_MOOD_WORDS: Record<string, string[]> = {
  밝음: ['joy', 'joyful', 'bright', 'lift', 'delight', 'radiant', 'bloom', 'renewed'],
  잔잔함: ['steady', 'quiet', 'gentle', 'calm', 'peace', 'contentment']
};

function detectMoodPromise(conceptLabel: string): ConceptPromise | undefined {
  const match = MOOD_KEYWORDS.find(entry => entry.pattern.test(conceptLabel));
  if (!match) return undefined;
  return {
    id: `mood-${match.labelKo}`,
    kind: 'mood',
    labelKo: match.labelKo,
    sourceText: conceptLabel.match(match.pattern)?.[0] ?? conceptLabel,
    checkTargets: ['emotionArc', 'stylePrompt']
  };
}

function detectEraPromise(conceptLabel: string, era: EraConstraint): ConceptPromise | undefined {
  if (era.unspecified) return undefined;
  return {
    id: `era-${era.primary}`,
    kind: 'era',
    labelKo: ERA_LABEL[era.primary],
    sourceText: conceptLabel,
    checkTargets: ['genre', 'stylePrompt', 'lyrics']
  };
}

function detectReferencePromises(conceptLabel: string): { promise: ConceptPromise; reference: DecomposedReference }[] {
  return decomposeArtistReferences(conceptLabel).map(reference => ({
    promise: {
      id: `reference-${reference.eraTag}`,
      kind: 'reference',
      labelKo: `${reference.eraTag} 사운드`,
      sourceText: reference.matchedSurface,
      checkTargets: ['stylePrompt']
    },
    reference
  }));
}

/** "X 같은/풍의/스타일의/느낌의/처럼 Y" — the shape a user names ANY reference in, known artist or not (see this file's own detectFallbackReferencePromise doc comment). */
const REFERENCE_PHRASE_PATTERN = /[\p{L}0-9]+(?:\s*[\p{L}0-9]+){0,2}\s*(?:같은|풍의|풍|스타일의|스타일|느낌의|처럼)/u;

/**
 * v4.5 (TASK D, 4-3) — real measurement: "사이먼과 가펑클 같은 담백한 포크
 * 하모니" scored 0% overall promise fulfillment, not because the folk-pop
 * genre it asks for wasn't actually selected (it was — core/conceptAgent.ts's
 * own data/conceptKeywords.ts keyword rules already resolve "포크" to
 * folk-pop/oldpop-folk-rock-70s independently of the artist name), but
 * because NO promise was ever detected for this concept at all: Simon &
 * Garfunkel isn't in data/artistReferenceSeeds.ts, so detectReferencePromises
 * found nothing, and none of era/mood/season matched either. This task's
 * own instruction is explicit: "시드 표를 늘리지 마십시오. 2단계 해석 경로를
 * 고치십시오" — rather than adding Simon & Garfunkel (and the next unlisted
 * artist, and the next) to the seed table, this reuses the SAME keyword-rule
 * genre resolution conceptAgent.ts already trusts for genre SELECTION and
 * turns it into something promiseAudit.ts can also MEASURE against — a
 * real (if coarser than a curated trait list) fallback, not a live LLM call
 * (this module stays a pure, synchronous function throughout).
 */
function detectFallbackReferencePromise(conceptLabel: string, seedReferences: DecomposedReference[]): ConceptPromise | undefined {
  if (seedReferences.length) return undefined; // a real seed match already covers this concept's reference promise.
  const phraseMatch = conceptLabel.match(REFERENCE_PHRASE_PATTERN);
  if (!phraseMatch) return undefined;
  const genreIds = [...new Set(matchConceptRules(conceptLabel).flatMap(rule => Object.keys(rule.genreWeights ?? {})))]
    .filter(id => getGenreById(id));
  if (!genreIds.length) return undefined;
  const genreLabels = genreIds.map(id => getGenreById(id)!.label).join('/');
  return {
    id: `reference-fallback-${genreIds[0]}`,
    kind: 'reference',
    labelKo: `${genreLabels} 계열 사운드 (미수록 참조)`,
    sourceText: phraseMatch[0],
    checkTargets: ['genre'],
    fallbackGenreIds: genreIds
  };
}

const SEASON_KEYWORD_PATTERN = /봄|여름|가을|겨울|크리스마스|christmas|spring|summer|autumn|winter|장마|첫눈/i;

function detectSeasonPromise(conceptLabel: string): ConceptPromise | undefined {
  if (!SEASON_KEYWORD_PATTERN.test(conceptLabel)) return undefined;
  const matchedSeason = seasonPacks.find(season => season.keywords.some(keyword => conceptLabel.toLowerCase().includes(keyword.toLowerCase())));
  return {
    id: 'season',
    kind: 'season',
    labelKo: matchedSeason?.label ?? '계절감',
    sourceText: conceptLabel.match(SEASON_KEYWORD_PATTERN)?.[0] ?? conceptLabel,
    checkTargets: ['lyrics', 'stylePrompt']
  };
}

// ---------------------------------------------------------------------------
// v4.5 (TASK D, 4-2) — situation/motion/cast promises. This app's lyric
// themes (data/lyricThemes.ts) already carry a frameId (the scene shape)
// and, for a growing subset, motionKo/castKo (what's physically happening,
// who's there) — see that file's own field doc comment for why those two
// axes existed since v3.64 as "allocation diversity metadata" but never
// reached a promise/fulfillment measurement until now. A concept like
// "젊은 시절 춤추던 토요일 밤" (a young Saturday night spent dancing) or
// "퇴근길" (the commute home) names a SITUATION the same way an era or
// artist reference names a sound — this is the missing axis that made C8
// score 0% even though the right lyric theme (dance-saturday) was actually
// being assigned (see core/bridgeInstruction.ts's own v4.5 TASK B work,
// which is what actually wires that assignment into generation).
// ---------------------------------------------------------------------------

function detectSituationPromise(conceptLabel: string): ConceptPromise | undefined {
  const match = SITUATION_FRAME_RULES.find(rule => rule.pattern.test(conceptLabel));
  if (!match) return undefined;
  return {
    id: `situation-${match.frameId}`,
    kind: 'situation',
    labelKo: match.labelKo,
    sourceText: conceptLabel.match(match.pattern)?.[0] ?? conceptLabel,
    checkTargets: ['lyrics'],
    expectedAxisValue: match.frameId
  };
}

interface MotionKeywordRule {
  motionKo: string;
  labelKo: string;
  pattern: RegExp;
}

/** motionKo values are free Korean short phrases (data/lyricThemes.ts, e.g. "이동 중(드라이브)"), not a closed enum — matched by substring below, so "드라이브" here also matches "이동 중(드라이브)" on a song. */
const MOTION_KEYWORD_RULES: MotionKeywordRule[] = [
  { motionKo: '춤', labelKo: '춤', pattern: /춤추|댄스|dance/i },
  { motionKo: '드라이브', labelKo: '드라이브', pattern: /드라이브|차\s*몰|운전|drive/i },
  { motionKo: '여행', labelKo: '여행·이동', pattern: /여행|기차|travel|journey/i }
];

function detectMotionPromise(conceptLabel: string): ConceptPromise | undefined {
  const match = MOTION_KEYWORD_RULES.find(rule => rule.pattern.test(conceptLabel));
  if (!match) return undefined;
  return {
    id: `motion-${match.motionKo}`,
    kind: 'motion',
    labelKo: match.labelKo,
    sourceText: conceptLabel.match(match.pattern)?.[0] ?? conceptLabel,
    checkTargets: ['lyrics'],
    expectedAxisValue: match.motionKo
  };
}

interface CastKeywordRule {
  castKo: string;
  labelKo: string;
  pattern: RegExp;
}

const CAST_KEYWORD_RULES: CastKeywordRule[] = [
  { castKo: '둘', labelKo: '둘이', pattern: /둘이|둘만|우리\s*둘|커플/i },
  { castKo: '여럿', labelKo: '친구들과', pattern: /친구들과|친구들|여럿이|다\s*같이/i },
  { castKo: '혼자', labelKo: '혼자', pattern: /혼자|나\s*홀로/i }
];

function detectCastPromise(conceptLabel: string): ConceptPromise | undefined {
  const match = CAST_KEYWORD_RULES.find(rule => rule.pattern.test(conceptLabel));
  if (!match) return undefined;
  return {
    id: `cast-${match.castKo}`,
    kind: 'cast',
    labelKo: match.labelKo,
    sourceText: conceptLabel.match(match.pattern)?.[0] ?? conceptLabel,
    checkTargets: ['lyrics'],
    expectedAxisValue: match.castKo
  };
}

/**
 * v3.76 — decomposes a concept's PROMISES. Every promise kind is optional
 * (a concept with no decade word makes no era promise, per this app's own
 * "억지로 시대를 정하지 말 것" convention from A3) — an empty return is
 * correct for a concept that makes no detectable promise at all, not a bug.
 */
export function decomposeConceptPromises(conceptLabel: string): {
  promises: ConceptPromise[];
  references: DecomposedReference[];
} {
  const era = extractEraConstraint(conceptLabel);
  const promises: ConceptPromise[] = [];
  const eraPromise = detectEraPromise(conceptLabel, era);
  if (eraPromise) promises.push(eraPromise);

  const referenceEntries = detectReferencePromises(conceptLabel);
  promises.push(...referenceEntries.map(entry => entry.promise));

  // v4.5 (TASK D, 4-3) — only when no seed-recognized artist reference
  // exists at all; see detectFallbackReferencePromise's own doc comment.
  const fallbackReferencePromise = detectFallbackReferencePromise(conceptLabel, referenceEntries.map(entry => entry.reference));
  if (fallbackReferencePromise) promises.push(fallbackReferencePromise);

  const moodPromise = detectMoodPromise(conceptLabel);
  if (moodPromise) promises.push(moodPromise);

  const seasonPromise = detectSeasonPromise(conceptLabel);
  if (seasonPromise) promises.push(seasonPromise);

  // v4.5 (TASK D, 4-2)
  const situationPromise = detectSituationPromise(conceptLabel);
  if (situationPromise) promises.push(situationPromise);
  const motionPromise = detectMotionPromise(conceptLabel);
  if (motionPromise) promises.push(motionPromise);
  const castPromise = detectCastPromise(conceptLabel);
  if (castPromise) promises.push(castPromise);

  return { promises, references: referenceEntries.map(entry => entry.reference) };
}

// ---------------------------------------------------------------------------
// Per-promise measurement
// ---------------------------------------------------------------------------

/**
 * v3.76 — words common enough across many genres' style prompts that
 * matching on them alone would false-positive a "reference kept" hit
 * regardless of whether the actual reference-specific sound is present
 * (e.g. "bright forward diction" naively reduces to "bright", which
 * appears in dozens of unrelated genre descriptions). Excluded so the
 * keyword(s) picked per trait phrase are the ones actually distinctive to
 * that phrase.
 */
const GENERIC_STYLE_WORDS = new Set([
  // Generic mood/production adjectives — appear across nearly every genre's
  // stylePrompt regardless of any specific artist reference.
  'warm', 'bright', 'soft', 'gentle', 'close', 'forward', 'natural', 'smooth', 'clean',
  'deep', 'high', 'rich', 'full', 'light', 'wide', 'unhurried', 'steady', 'driving',
  'major-key', 'abrupt', 'melodic', 'lead', 'style', 'sound', 'feel', 'tone',
  // Generic instrument/production/structure NOUNS — real measurement found
  // these dominating false-positive matches (e.g. "harmony"/"chorus"/"mix"/
  // "drums" appear in almost every song's stylePrompt via the app's own
  // structural vocabulary, not because a reference's specific sound reached
  // it). Excluding these is what separates "this song mentions drums" from
  // "this song mentions THIS reference's own drum treatment".
  'vocal', 'vocals', 'harmony', 'chorus', 'hook', 'hooks', 'drums', 'drum', 'kit',
  'guitar', 'piano', 'chord', 'chords', 'section', 'room', 'reverb', 'rhythm',
  'verse', 'verses', 'singing', 'bass', 'playing', 'backing', 'diction', 'mix'
]);

function significantWords(phrase: string): string[] {
  const words = phrase.toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/\s+/).filter(Boolean);
  const distinctive = words.filter(word => word.length >= 4 && !GENERIC_STYLE_WORDS.has(word));
  return distinctive.length ? distinctive : words.filter(word => word.length >= 4);
}

function measureEra(songs: SongIdea[], era: EraConstraint): { byTarget: Record<string, number>; failedTracks: number[]; explanationKo: string } {
  const genreHits = songs.filter(song => eraBucketForGenreId(song.genreId) === era.primary);
  const styleHits = genreHits; // stylePrompt carries the same genre-derived era text — see this file's own doc comment.
  const banks = vocabularyBanksForEra(era.primary);
  const bankWords = new Set(banks.flatMap(bank => [...bank.nouns, ...bank.verbs, ...bank.adjectives].map(word => word.toLowerCase())));
  const lyricHits = songs.filter(song => {
    const lyricsLower = song.lyrics.toLowerCase();
    return [...bankWords].some(word => lyricsLower.includes(word));
  });
  const failedTracks = songs.filter(song => eraBucketForGenreId(song.genreId) !== era.primary).map(song => song.trackNo);
  const genericCount = songs.length - genreHits.length;
  return {
    byTarget: {
      genre: ratio(genreHits.length, songs.length),
      stylePrompt: ratio(styleHits.length, songs.length),
      lyrics: ratio(lyricHits.length, songs.length)
    },
    failedTracks,
    explanationKo: genericCount > 0
      ? `시대 표기 없는/다른 시대 장르가 ${genericCount}곡입니다.`
      : '전 곡이 컨셉 시대 장르입니다.'
  };
}

/**
 * v3.76 — measures how much of the reference's OWN trait vocabulary
 * actually reached each song's stylePrompt, not just whether any single
 * word matched anywhere. `byTarget.stylePrompt` is the average, across all
 * songs, of "how many of this reference's distinct trait phrases does this
 * song's stylePrompt contain a distinctive word from" — a song sharing 1
 * genre with the reference but none of its actual sound descriptors scores
 * near 0, not 100%, which a bare "matched at least one word" ratio would.
 */
function measureReference(songs: SongIdea[], reference: DecomposedReference): { byTarget: Record<string, number>; failedTracks: number[]; explanationKo: string } {
  const traitPhrases = [
    ...reference.instrumentation,
    ...reference.harmonyTraits,
    ...reference.rhythmTraits,
    ...reference.productionTraits,
    ...reference.vocalTraits
  ];
  const phraseKeywordSets = traitPhrases.map(significantWords);
  const perSongPhraseHitCount = songs.map(song => {
    const styleLower = song.stylePrompt.toLowerCase();
    return phraseKeywordSets.filter(keywords => keywords.some(keyword => styleLower.includes(keyword))).length;
  });
  const perSongCoverage = perSongPhraseHitCount.map(count => ratio(count, traitPhrases.length));
  const averageCoverage = perSongCoverage.reduce((sum, value) => sum + value, 0) / (songs.length || 1);
  const songsWithAnyTrait = perSongPhraseHitCount.filter(count => count > 0).length;
  const reachedPhraseCount = phraseKeywordSets.filter(keywords => songs.some(song => keywords.some(keyword => song.stylePrompt.toLowerCase().includes(keyword)))).length;
  const failedTracks = songs.filter((_, idx) => perSongPhraseHitCount[idx] === 0).map(song => song.trackNo);
  return {
    byTarget: { stylePrompt: averageCoverage },
    failedTracks,
    explanationKo: `참조 사운드 서술어 ${traitPhrases.length}개 중 ${reachedPhraseCount}개가 실제 프롬프트 어딘가에 도달했지만, ${songsWithAnyTrait}곡에만 하나라도 등장합니다(전 곡 평균 서술어 도달률 ${Math.round(averageCoverage * 100)}%).`
  };
}

function isBrightEmotionArc(emotionArc: string | undefined, pools: string[][]): boolean {
  if (!emotionArc) return false;
  if (pools.some(pool => pool.includes(emotionArc))) return true;
  const words = EMOTION_ARC_MOOD_WORDS['밝음'];
  return words.some(word => emotionArc.toLowerCase().includes(word));
}

function measureMood(songs: SongIdea[], moodPromise: ConceptPromise, moodEntry: (typeof MOOD_KEYWORDS)[number]): { byTarget: Record<string, number>; failedTracks: number[]; explanationKo: string } {
  const arcHits = songs.filter(song => isBrightEmotionArc(song.emotionArc, moodEntry.brightPools));
  const styleHits = songs.filter(song => moodEntry.styleWords.some(word => song.stylePrompt.toLowerCase().includes(word)));
  const failedTracks = songs.filter(song => !isBrightEmotionArc(song.emotionArc, moodEntry.brightPools)).map(song => song.trackNo);
  return {
    byTarget: {
      emotionArc: ratio(arcHits.length, songs.length),
      stylePrompt: ratio(styleHits.length, songs.length)
    },
    failedTracks,
    explanationKo: `컨셉에 "${moodPromise.sourceText}"이(가) 명시됐으나 ${songs.length - arcHits.length}곡의 감정 아크가 이 분위기가 아닙니다.`
  };
}

function measureSeason(songs: SongIdea[], seasonPromise: ConceptPromise): { byTarget: Record<string, number>; failedTracks: number[]; explanationKo: string } {
  const matchedSeason = seasonPacks.find(season => season.label === seasonPromise.labelKo);
  const keywords = (matchedSeason?.keywords ?? [seasonPromise.sourceText]).map(word => word.toLowerCase());
  const lyricHits = songs.filter(song => keywords.some(keyword => song.lyrics.toLowerCase().includes(keyword)));
  const styleHits = songs.filter(song => keywords.some(keyword => song.stylePrompt.toLowerCase().includes(keyword)));
  const failedTracks = songs.filter(song => !keywords.some(keyword => song.lyrics.toLowerCase().includes(keyword))).map(song => song.trackNo);
  return {
    byTarget: {
      lyrics: ratio(lyricHits.length, songs.length),
      stylePrompt: ratio(styleHits.length, songs.length)
    },
    failedTracks,
    explanationKo: `계절 키워드가 가사에 등장한 곡은 ${lyricHits.length}/${songs.length}입니다.`
  };
}

/**
 * v4.5 (TASK D, 4-2) — "컨셉의 상황 키워드가 lyricTheme.frameId와 매칭되는가...
 * 기준 60% 이상." song.lyricFrameId is set by both generation paths (see
 * core/batchPreallocation.ts/core/localGenerator.ts's own lyricFrameId
 * field, v3.64 TASK A) — this is a real design-time value, not inferred
 * from lyric text after the fact.
 */
function measureSituation(songs: SongIdea[], expectedFrameId: string): { byTarget: Record<string, number>; failedTracks: number[]; explanationKo: string } {
  const hits = songs.filter(song => song.lyricFrameId === expectedFrameId);
  const failedTracks = songs.filter(song => song.lyricFrameId !== expectedFrameId).map(song => song.trackNo);
  return {
    byTarget: { lyrics: ratio(hits.length, songs.length) },
    failedTracks,
    explanationKo: `이 상황(${SITUATION_FRAME_RULES.find(rule => rule.frameId === expectedFrameId)?.labelKo ?? expectedFrameId})의 장면 프레임이 배정된 곡은 ${hits.length}/${songs.length}입니다.`
  };
}

/** v4.5 (TASK D, 4-2) — substring match against song.lyricThemeMotionKo, since that field is a free short phrase (e.g. "이동 중(드라이브)"), not a closed enum matching expectedMotionKo exactly. */
function measureMotion(songs: SongIdea[], expectedMotionKo: string): { byTarget: Record<string, number>; failedTracks: number[]; explanationKo: string } {
  const hits = songs.filter(song => song.lyricThemeMotionKo?.includes(expectedMotionKo));
  const failedTracks = songs.filter(song => !song.lyricThemeMotionKo?.includes(expectedMotionKo)).map(song => song.trackNo);
  return {
    byTarget: { lyrics: ratio(hits.length, songs.length) },
    failedTracks,
    explanationKo: `이 움직임(${expectedMotionKo})이 장면에 포함된 곡은 ${hits.length}/${songs.length}입니다.`
  };
}

/** v4.5 (TASK D, 4-2) — same substring-match reasoning as measureMotion, for song.lyricThemeCastKo. */
function measureCast(songs: SongIdea[], expectedCastKo: string): { byTarget: Record<string, number>; failedTracks: number[]; explanationKo: string } {
  const hits = songs.filter(song => song.lyricThemeCastKo?.includes(expectedCastKo));
  const failedTracks = songs.filter(song => !song.lyricThemeCastKo?.includes(expectedCastKo)).map(song => song.trackNo);
  return {
    byTarget: { lyrics: ratio(hits.length, songs.length) },
    failedTracks,
    explanationKo: `이 인물 구성(${expectedCastKo})이 장면에 포함된 곡은 ${hits.length}/${songs.length}입니다.`
  };
}

/** v4.5 (TASK D, 4-3) — see detectFallbackReferencePromise's own doc comment for why this measures genre assignment rather than a curated trait-phrase list. */
function measureFallbackReference(songs: SongIdea[], genreIds: string[]): { byTarget: Record<string, number>; failedTracks: number[]; explanationKo: string } {
  const genreIdSet = new Set(genreIds);
  const hits = songs.filter(song => song.genreId && genreIdSet.has(song.genreId));
  const failedTracks = songs.filter(song => !song.genreId || !genreIdSet.has(song.genreId)).map(song => song.trackNo);
  return {
    byTarget: { genre: ratio(hits.length, songs.length) },
    failedTracks,
    explanationKo: `미수록 참조를 장르 키워드(${genreIds.join(', ')})로 해석해 측정합니다 — 이 장르가 배정된 곡은 ${hits.length}/${songs.length}입니다.`
  };
}

/**
 * v3.76 (TASK A) — measures whether the pack actually kept each promise the
 * concept made. `constraints` (A3's ResolvedConstraints) is reused for the
 * era promise specifically when the caller already has one (keeps the era
 * bucket identical to whatever `applyEraQuota` used at generation time);
 * omitted, this derives its own from `conceptLabel` via the same
 * `extractEraConstraint` function, so the two never disagree.
 */
export function auditPromises(songs: SongIdea[], conceptLabel: string, constraints?: { era: EraConstraint }): PromiseAuditReport {
  const warnings: string[] = [];
  if (!songs.length) {
    return { conceptLabel, promises: [], overallFulfillment: 0, weakestPromise: '', warnings: ['이 세트에 곡이 없습니다.'] };
  }

  const era = constraints?.era ?? extractEraConstraint(conceptLabel);
  const { promises: decomposed, references } = decomposeConceptPromises(conceptLabel);
  // decomposeConceptPromises derives its own era internally too; if a caller
  // passed a different `constraints.era`, prefer the caller's (see this
  // function's own doc comment) by re-deriving the era promise's checkTargets
  // against it rather than the locally re-derived one.
  const results: PromiseResult[] = [];

  for (const promise of decomposed) {
    let measured: { byTarget: Record<string, number>; failedTracks: number[]; explanationKo: string };
    if (promise.kind === 'era') {
      measured = measureEra(songs, era);
    } else if (promise.kind === 'reference') {
      // v4.5 (TASK D, 4-3) — a fallback (unlisted-artist) reference promise
      // has fallbackGenreIds set and no matching seed DecomposedReference;
      // measured against genre assignment instead of a curated trait list.
      if (promise.fallbackGenreIds?.length) {
        measured = measureFallbackReference(songs, promise.fallbackGenreIds);
      } else {
        const reference = references.find(ref => `reference-${ref.eraTag}` === promise.id);
        if (!reference) continue;
        measured = measureReference(songs, reference);
      }
    } else if (promise.kind === 'mood') {
      const moodEntry = MOOD_KEYWORDS.find(entry => entry.labelKo === promise.labelKo)!;
      measured = measureMood(songs, promise, moodEntry);
    } else if (promise.kind === 'season') {
      measured = measureSeason(songs, promise);
    } else if (promise.kind === 'situation') {
      measured = measureSituation(songs, promise.expectedAxisValue!);
    } else if (promise.kind === 'motion') {
      measured = measureMotion(songs, promise.expectedAxisValue!);
    } else if (promise.kind === 'cast') {
      measured = measureCast(songs, promise.expectedAxisValue!);
    } else {
      continue; // 'genre' promises are detected by setDirector-level context this function doesn't have direct access to — see this file's own "미구현" note in docs/v376-report.md.
    }
    const targetValues = Object.values(measured.byTarget);
    const fulfillment = targetValues.length ? targetValues.reduce((sum, value) => sum + value, 0) / targetValues.length : 0;
    results.push({ promise, byTarget: measured.byTarget, fulfillment, failedTracks: measured.failedTracks, explanationKo: measured.explanationKo });
  }

  if (!results.length) warnings.push('컨셉에서 감지된 약속이 없습니다 (시대/참조/분위기/계절 단어가 없는 컨셉).');

  const overallFulfillment = results.length ? results.reduce((sum, result) => sum + result.fulfillment, 0) / results.length : 0;
  const weakest = results.slice().sort((a, b) => a.fulfillment - b.fulfillment)[0];

  return {
    conceptLabel,
    promises: results,
    overallFulfillment,
    weakestPromise: weakest ? weakest.promise.labelKo : '',
    warnings
  };
}

/**
 * v4.1 (TASK D) — attaches conceptFitScore (SongScores) onto an already-
 * scored pack, reusing this file's own auditPromises rather than
 * duplicating promise measurement. Deliberately lives here, not in
 * core/quality.ts: quality.ts's scoreSongs runs on every generation path
 * (worker, batch, bridge, retry) and this file transitively depends on
 * quality.ts already (via core/localGenerator.ts's emotionArcsBrightOpening/
 * CalmThroughout/StrongLift exports, which localGenerator.ts itself needs
 * for scoreSongs) — importing auditPromises back into quality.ts would
 * close that into a 3-module circular import, which real testing confirmed
 * breaks this file's own top-level MOOD_KEYWORDS table (its brightPools
 * entries read as undefined mid-cycle, crashing every pack whose concept
 * text contains a mood keyword like "잔잔한"). Called once real concept
 * text is available, at the display layer (Step4Result.tsx), not on every
 * generation-path scoreSongs call. No promises detected (or no
 * conceptLabel) means nothing was measured, not that the pack failed —
 * stays neutral 100, same "no signal, don't penalize" convention
 * generationGate.ts's own packLevelFindings already uses for promise
 * fulfillment.
 */
export function applyConceptFitScore(songs: SongIdea[], conceptLabel: string): SongIdea[] {
  const report = conceptLabel.trim() ? auditPromises(songs, conceptLabel) : null;
  const conceptFitScore = report && report.promises.length ? Math.round(report.overallFulfillment * 100) : 100;
  return songs.map(song => ({
    ...song,
    scores: { ...(song.scores as SongScores), conceptFitScore }
  }));
}

// ---------------------------------------------------------------------------
// Title-concept consistency — TASK A §2-4, a separate measurement from the
// 6 promise kinds above (Haru's own stated priority: "제목대로 느껴지는가").
// ---------------------------------------------------------------------------

export interface TitleConsistencyReport {
  /** classifyTitleShape's 'single-word'/'verb-phrase' read as period-appropriate for an older-pop concept (a bare noun-noun image pair is exactly the symptom this measures); this is a coarse proxy, not real era-linguistics classification. */
  eraPatternMatchShare: number;
  /** title === hookPhrase, or shares at least one significant word with it (titleHookOverlapWarning returning null). */
  hookConnectedCount: number;
  /** Neither era-pattern-shaped nor hook-connected — a title with no visible tie to the concept or its own song. */
  offConceptTitleCount: number;
  failedTracks: number[];
}

// TASK v4.8 (TASK B-2) — 'name-address' added: a comma-led direct-address
// title ("Sweet Caroline", "Oh, Donna") is exactly data/titlePatterns.ts's
// own 'name-address' pattern, era-restricted there to fitsEras:
// ['1950s-60s'] — just as period-appropriate as single-word/verb-phrase,
// only not detected as its own shape before titleShapeVariety.ts's own
// classifier fix (see that file's own doc comment on classifyTitleShape).
const ERA_APPROPRIATE_TITLE_SHAPES = new Set(['single-word', 'verb-phrase', 'name-address']);

export function auditTitleConceptConsistency(songs: SongIdea[]): TitleConsistencyReport {
  let eraPatternHits = 0;
  let hookConnected = 0;
  const failedTracks: number[] = [];
  for (const song of songs) {
    const shape = classifyTitleShape(song.title);
    const isEraShaped = ERA_APPROPRIATE_TITLE_SHAPES.has(shape);
    const isHookConnected = song.title.trim().toLowerCase() === (song.hookPhrase ?? '').trim().toLowerCase()
      || titleHookOverlapWarning(song.title, song.hookPhrase) === null;
    if (isEraShaped) eraPatternHits += 1;
    if (isHookConnected) hookConnected += 1;
    if (!isEraShaped && !isHookConnected) failedTracks.push(song.trackNo);
  }
  return {
    eraPatternMatchShare: ratio(eraPatternHits, songs.length),
    hookConnectedCount: hookConnected,
    offConceptTitleCount: failedTracks.length,
    failedTracks
  };
}
