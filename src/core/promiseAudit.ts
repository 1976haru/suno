import type { SongIdea, SongScores } from '../types';
import { decomposeArtistReferences, type DecomposedReference } from './artistReferenceDecomposer';
import { extractEraConstraint, type EraConstraint } from './constraints';
import { eraBucketForGenreId, ERA_LABEL } from '../data/eraExclusions';
import { vocabularyBanksForEra } from '../data/vocabularyBanks';
import { seasonPacks } from '../data/presets';
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

export type ConceptPromiseKind = 'era' | 'reference' | 'mood' | 'genre' | 'situation' | 'season';

export interface ConceptPromise {
  id: string;
  kind: ConceptPromiseKind;
  labelKo: string;
  /** The part of the concept text that triggered this promise. */
  sourceText: string;
  checkTargets: ('genre' | 'stylePrompt' | 'lyrics' | 'title' | 'emotionArc')[];
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

  const moodPromise = detectMoodPromise(conceptLabel);
  if (moodPromise) promises.push(moodPromise);

  const seasonPromise = detectSeasonPromise(conceptLabel);
  if (seasonPromise) promises.push(seasonPromise);

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
      const reference = references.find(ref => `reference-${ref.eraTag}` === promise.id);
      if (!reference) continue;
      measured = measureReference(songs, reference);
    } else if (promise.kind === 'mood') {
      const moodEntry = MOOD_KEYWORDS.find(entry => entry.labelKo === promise.labelKo)!;
      measured = measureMood(songs, promise, moodEntry);
    } else if (promise.kind === 'season') {
      measured = measureSeason(songs, promise);
    } else {
      continue; // 'genre'/'situation' promises are detected by setDirector-level context this function doesn't have direct access to — see this file's own "미구현" note in docs/v376-report.md.
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

const ERA_APPROPRIATE_TITLE_SHAPES = new Set(['single-word', 'verb-phrase']);

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
