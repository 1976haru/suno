import type { SongIdea } from '../types';
import { descriptorCount, lyricWordAndSectionCounts, scoreComposition, type ScoreCompositionOptions } from './compositionScorer';
import { classifyTitleShape } from './titleShapeVariety';
import { lintInPackStyleSimilarity } from './diversityLinter';
import { auditPromises, auditTitleConceptConsistency } from './promiseAudit';
import { MALE_VOCAL_TRAIT_AXES, FEMALE_VOCAL_TRAIT_AXES } from '../data/vocalTraits';

/**
 * v3.78 (TASK B) — "관문 2": checks that only exist once the actual songs
 * exist (title text, lyric text, style-prompt text) — the counterpart to
 * core/designGate.ts's pre-generation "관문 1". Deliberately builds ON TOP OF
 * core/compositionScorer.ts's scoreComposition rather than re-implementing
 * its checks (arrangement-vocab leak, artist-name leak, era-anachronism
 * text, style-similarity, hook-collision, vocab-repeat-hard, the v3.77
 * vocal/BPM structure-collapse floors) — this module ADDS the checks this
 * task's own §3-2 table lists that scoreComposition doesn't already cover
 * (title-pattern variety, situation/emotion-arc variety, tighter blocking
 * word-count/section-count bounds, placeholder/label/title-line/article
 * leaks, and the advisory prompt/promise measurements), then merges both
 * into one per-track blocking/advisory list. Per this task's own 원칙 3, this
 * module ONLY reads already-generated SongIdea[] — it never edits lyrics,
 * stylePrompt, or any other generated field (원칙 "관문이 생성 로직을 수정하지
 * 말 것").
 */

export interface GenerationGateTrackResult {
  trackNo: number;
  passed: boolean;
  blocking: string[];
  advisory: string[];
}

export interface GenerationGateResult {
  passed: boolean;
  tracks: GenerationGateTrackResult[];
  failingTrackNos: number[];
  /** §3-3 — "blocking 곡이 12곡 이상" is the one case where the whole set should be regenerated instead of a targeted recompose. */
  needsFullRegeneration: boolean;
  /** Pack-level findings (apply to no single track) — e.g. title pattern variety, situation/emotion-arc variety. Also folded into every failing track's own `blocking`/`advisory` list above for the recompose instruction, same attribution pattern compositionScorer.ts already uses for pack-level findings. */
  packBlocking: string[];
  packAdvisory: string[];
}

const LYRIC_WORD_COUNT_MIN = 200;
const LYRIC_WORD_COUNT_MAX = 240;
const SECTION_COUNT_MIN = 6;
const SECTION_COUNT_MAX = 8;
const TITLE_PATTERN_VARIETY_MIN = 4;
const TITLE_PATTERN_MAX_SAME = 5;
const VOCAL_DESCRIPTOR_VARIETY_MIN = 12;
const EMOTION_ARC_VARIETY_MIN = 8;
const PROMPT_LENGTH_MIN = 350;
const PROMPT_LENGTH_MAX = 650;
const PROMPT_ATOMS_MIN = 15;
const PROMPT_ATOMS_MAX = 25;
const SHARED_ATOMS_MAX = 5;
const PROMISE_FULFILLMENT_MIN = 0.7;
const FULL_REGENERATION_TRACK_THRESHOLD = 12;

// Mirrors core/fullAudit.ts's own LABEL_LEAK_PATTERN/PLACEHOLDER_PATTERN
// exactly (same literal patterns) so "would this have been blocked at
// generation time" and "does the audit measure the same leak" never
// disagree — kept as separate consts (not imported) because fullAudit.ts's
// are module-private; duplicating three short regex literals is cheaper and
// less coupling than exporting internals whose only other purpose is being
// module-private measurement helpers.
const LABEL_LEAK_PATTERN = /^\s*(Money chords?|Killing point|Hook device|Arrangement density|Intro texture)\s*:/im;
const PLACEHOLDER_PATTERN = /\[PLACEHOLDER\]|\bTODO\b|lorem ipsum|\{\{.*?\}\}/i;
const TITLE_LINE_PATTERN = /^\s*Title\s*:/im;

/**
 * v3.78 (TASK B, NEW) — "관사 오류: like a <복수>" (§3-2). No existing
 * detector for this anywhere in the app (core/fullAudit.ts's own
 * `grammar_article_errors` item is explicitly `notImplemented: true`).
 * Deliberately narrow and conservative: only flags "a/an + word ending in
 * -s" (the exact pattern the spec names), excluding a hand-picked list of
 * common English words that end in -s but are singular/uncountable/adverbs
 * (so "like a mess", "like a bus", "always" don't false-positive). This is a
 * heuristic, not a real grammar checker — documented as such in
 * docs/v378-report.md rather than claimed as complete.
 */
const ARTICLE_ERROR_S_EXCEPTIONS = new Set([
  'this', 'yes', 'was', 'plus', 'bus', 'glass', 'class', 'mass', 'gas', 'loss', 'boss',
  'miss', 'kiss', 'cross', 'dress', 'press', 'stress', 'address', 'business', 'princess',
  'process', 'progress', 'success', 'excess', 'access', 'always', 'sometimes', 'perhaps',
  'christmas', 'campus', 'focus', 'bonus', 'virus', 'chorus', 'canvas', 'compass', 'circus',
  'atlas', 'gas', 'lens', 'series', 'species', 'analysis', 'basis', 'crisis', 'thesis',
  'promise', 'purpose', 'house', 'pause', 'noise', 'phase', 'sunrise', 'surprise', 'paradise'
]);

function findArticleErrors(lyrics: string): string[] {
  const matches: string[] = [];
  const pattern = /\b(?:like|as)\s+an?\s+([a-z]+s)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(lyrics))) {
    const word = match[1].toLowerCase();
    if (ARTICLE_ERROR_S_EXCEPTIONS.has(word)) continue;
    matches.push(match[0]);
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Pack-level findings (attributed to every track, same pattern
// compositionScorer.ts already uses for eraFindings/vocalZoneWarnings/etc.)
// ---------------------------------------------------------------------------
function packLevelFindings(songs: SongIdea[], conceptLabel: string): { blocking: string[]; advisory: string[] } {
  const blocking: string[] = [];
  const advisory: string[] = [];
  if (!songs.length) return { blocking, advisory };

  // vocal-descriptor-variety (>=12, blocking) — same measurement fullAudit.ts's
  // vocal_desc_variety already reports (advisory-only there); promoted to
  // blocking here per this task's own §3-2 table.
  const registerPool = [...MALE_VOCAL_TRAIT_AXES.register, ...FEMALE_VOCAL_TRAIT_AXES.register];
  const distinctVocalDescriptors = new Set(
    songs.flatMap(song => registerPool.filter(register => song.stylePrompt.toLowerCase().includes(register.toLowerCase())))
  );
  if (distinctVocalDescriptors.size < VOCAL_DESCRIPTOR_VARIETY_MIN) {
    blocking.push(`보컬 서술 종류가 ${distinctVocalDescriptors.size}종입니다 (최소 ${VOCAL_DESCRIPTOR_VARIETY_MIN}종).`);
  }
  const missingVocalType = songs.filter(song => !song.vocalType);
  if (missingVocalType.length) {
    blocking.push(`보컬 서술이 누락된 곡이 ${missingVocalType.length}곡 있습니다 (트랙 ${missingVocalType.map(song => song.trackNo).join(', ')}).`);
  }

  // title-pattern-variety (>=4) / title-pattern-max (<=5), blocking.
  const shapeCounts = new Map<string, number>();
  for (const song of songs) {
    const shape = classifyTitleShape(song.title);
    if (!shape) continue;
    shapeCounts.set(shape, (shapeCounts.get(shape) ?? 0) + 1);
  }
  if (shapeCounts.size < TITLE_PATTERN_VARIETY_MIN) {
    blocking.push(`제목 패턴 종류가 ${shapeCounts.size}종입니다 (최소 ${TITLE_PATTERN_VARIETY_MIN}종).`);
  }
  for (const [shape, count] of shapeCounts) {
    if (count > TITLE_PATTERN_MAX_SAME) {
      blocking.push(`제목 패턴 "${shape}"가 ${count}곡에 반복됩니다 (최대 ${TITLE_PATTERN_MAX_SAME}곡).`);
    }
  }

  // title-concept-fit (advisory, >=50%).
  const titleConsistency = auditTitleConceptConsistency(songs);
  const conceptFitShare = songs.length ? (songs.length - titleConsistency.offConceptTitleCount) / songs.length : 0;
  if (conceptFitShare < 0.5) {
    advisory.push(`컨셉 정합 제목이 ${Math.round(conceptFitShare * 100)}%입니다 (권장 50% 이상).`);
  }

  // lyric-situation-unique (blocking, 전부 다름).
  const situationCounts = new Map<string, number[]>();
  for (const song of songs) {
    const key = (song.listenerSituation || '').trim();
    situationCounts.set(key, [...(situationCounts.get(key) ?? []), song.trackNo]);
  }
  const duplicateSituations = [...situationCounts.entries()].filter(([, trackNos]) => trackNos.length > 1);
  if (duplicateSituations.length) {
    blocking.push(`가사 상황이 중복됩니다: ${duplicateSituations.map(([situation, trackNos]) => `"${situation || '(빈 값)'}" (트랙 ${trackNos.join(', ')})`).join('; ')}`);
  }

  // lyric-emotion-variety (>=8, blocking).
  const emotionArcs = new Set(songs.map(song => song.emotionArc).filter(Boolean));
  if (emotionArcs.size < EMOTION_ARC_VARIETY_MIN) {
    blocking.push(`감정 아크 종류가 ${emotionArcs.size}종입니다 (최소 ${EMOTION_ARC_VARIETY_MIN}종).`);
  }

  // prompt-length (advisory, 350~650) / prompt-atoms (advisory, 15~25) / shared-atoms (advisory, <=5).
  const lengths = songs.map(song => song.stylePrompt.length);
  const outOfLength = lengths.filter(length => length < PROMPT_LENGTH_MIN || length > PROMPT_LENGTH_MAX).length;
  if (outOfLength) {
    advisory.push(`style prompt 길이가 ${PROMPT_LENGTH_MIN}~${PROMPT_LENGTH_MAX}자 범위를 벗어난 곡이 ${outOfLength}곡입니다.`);
  }
  const atomCounts = songs.map(song => descriptorCount(song.stylePrompt));
  const outOfAtoms = atomCounts.filter(count => count < PROMPT_ATOMS_MIN || count > PROMPT_ATOMS_MAX).length;
  if (outOfAtoms) {
    advisory.push(`style prompt 서술어 개수가 ${PROMPT_ATOMS_MIN}~${PROMPT_ATOMS_MAX}개 범위를 벗어난 곡이 ${outOfAtoms}곡입니다.`);
  }
  const similarity = lintInPackStyleSimilarity(songs.map(song => ({ trackNo: song.trackNo, stylePrompt: song.stylePrompt })));
  if (similarity.sharedAtomCount > SHARED_ATOMS_MAX) {
    advisory.push(`18곡이 공유하는 서술어 원자가 ${similarity.sharedAtomCount}개입니다 (권장 ${SHARED_ATOMS_MAX}개 이하).`);
  }

  // promise-fulfillment (advisory, >=70%).
  if (conceptLabel.trim()) {
    const promiseAudit = auditPromises(songs, conceptLabel);
    if (promiseAudit.promises.length && promiseAudit.overallFulfillment < PROMISE_FULFILLMENT_MIN) {
      advisory.push(`컨셉 약속 이행도가 ${Math.round(promiseAudit.overallFulfillment * 100)}%입니다 (권장 ${Math.round(PROMISE_FULFILLMENT_MIN * 100)}% 이상). 가장 약한 약속: ${promiseAudit.weakestPromise || '(없음)'}`);
    }
  }

  return { blocking, advisory };
}

// ---------------------------------------------------------------------------
// Per-track findings not already covered by compositionScorer.ts.
// ---------------------------------------------------------------------------
function perTrackFindings(song: SongIdea): { blocking: string[]; advisory: string[] } {
  const blocking: string[] = [];
  const { words, sections } = lyricWordAndSectionCounts(song.lyrics);
  if (words < LYRIC_WORD_COUNT_MIN || words > LYRIC_WORD_COUNT_MAX) {
    blocking.push(`가사 단어수 ${words} (기준 ${LYRIC_WORD_COUNT_MIN}~${LYRIC_WORD_COUNT_MAX})`);
  }
  if (sections < SECTION_COUNT_MIN || sections > SECTION_COUNT_MAX) {
    blocking.push(`섹션 수 ${sections} (기준 ${SECTION_COUNT_MIN}~${SECTION_COUNT_MAX})`);
  }
  if (PLACEHOLDER_PATTERN.test(song.lyrics)) {
    blocking.push('가사에 자리표시자([PLACEHOLDER]/TODO/lorem ipsum/{{...}})가 남아 있습니다.');
  }
  if (TITLE_LINE_PATTERN.test(song.lyrics)) {
    blocking.push('가사 첫줄에 "Title:" 라벨이 남아 있습니다.');
  }
  if (LABEL_LEAK_PATTERN.test(song.stylePrompt) || LABEL_LEAK_PATTERN.test(song.lyrics)) {
    blocking.push('편곡 라벨(Money chords:/Killing point: 등)이 텍스트에 그대로 남아 있습니다.');
  }
  const articleErrors = findArticleErrors(song.lyrics);
  if (articleErrors.length) {
    blocking.push(`관사·복수 오류로 보이는 표현: ${articleErrors.join(', ')}`);
  }
  return { blocking, advisory: [] };
}

export function evaluateGenerationGate(songs: SongIdea[], opts: ScoreCompositionOptions & { conceptLabel?: string } = {}): GenerationGateResult {
  if (!songs.length) {
    return { passed: true, tracks: [], failingTrackNos: [], needsFullRegeneration: false, packBlocking: [], packAdvisory: [] };
  }
  const baseScores = scoreComposition(songs, opts);
  const baseByTrack = new Map(baseScores.map(score => [score.trackNo, score]));
  const pack = packLevelFindings(songs, opts.conceptLabel ?? '');

  const tracks: GenerationGateTrackResult[] = songs.map(song => {
    const base = baseByTrack.get(song.trackNo);
    const own = perTrackFindings(song);
    const blocking = [...(base?.blocking ?? []), ...own.blocking, ...pack.blocking];
    const advisory = [...(base?.advisory ?? []), ...own.advisory, ...pack.advisory];
    return { trackNo: song.trackNo, passed: blocking.length === 0, blocking, advisory };
  });

  const failingTrackNos = tracks.filter(track => !track.passed).map(track => track.trackNo);
  return {
    passed: failingTrackNos.length === 0,
    tracks,
    failingTrackNos,
    needsFullRegeneration: failingTrackNos.length >= FULL_REGENERATION_TRACK_THRESHOLD,
    packBlocking: pack.blocking,
    packAdvisory: pack.advisory
  };
}
