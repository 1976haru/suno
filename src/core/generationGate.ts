import type { LyricLanguage, ScopedIssue, SongIdea } from '../types';
import { descriptorCount, lyricWordAndSectionCounts, scoreComposition, type ScoreCompositionOptions } from './compositionScorer';
import { resolveLyricRange } from './lyricMetrics';
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
  /** v4.1 (TASK C) — now also false when packBlocking is non-empty, even if every individual track's own blocking list is empty: a design-level pack issue (era share, title-pattern collapse) means the pack isn't actually done, even though no single track's own text is at fault. */
  passed: boolean;
  tracks: GenerationGateTrackResult[];
  failingTrackNos: number[];
  /** §3-3 — "blocking 곡이 12곡 이상" OR concept promise fulfillment under 40% (v4.1 TASK C addition — see packBlocking's own 'full'-scope entries) is when the whole set should be regenerated instead of a targeted recompose. */
  needsFullRegeneration: boolean;
  /**
   * v4.1 (TASK C) — pack-level findings, each carrying its own `scope`
   * (core/types.ts's IssueScope) and the REAL affectedTracks it touches —
   * no longer folded into every track's own blocking/advisory list (the
   * old `...pack.blocking` spread here was exactly the "3-song problem
   * reads as an 18-song failure" bug this task exists to fix). Includes
   * both this file's own pack-level checks (title pattern, emotion-arc
   * variety, situation duplication, promise fulfillment, ...) and
   * core/compositionScorer.ts's own scoreComposition().packBlocking/
   * packAdvisory (era consistency, vocal/tempo structure collapse,
   * vocabulary repetition, ...) — this module builds ON TOP of
   * compositionScorer's checks, so its pack-level output surfaces here too.
   */
  packBlocking: ScopedIssue[];
  packAdvisory: ScopedIssue[];
}

/**
 * v4.1 (TASK B) -- was a flat English word-count band (200-240), so a
 * Japanese lyric's whitespace "word" count (~1 for the whole lyric) could
 * never trip either bound. Now derived as a ratio of the resolved
 * per-language target range (core/lyricMetrics.ts's resolveLyricRange)
 * instead of a hardcoded English pair -- the ratios are exactly this file's
 * own pre-v4.1 numbers relative to promptComposer.ts's 215-230 instruction
 * target, so English behavior is unchanged; Korean/Japanese now get a real,
 * scaled band instead of an unreachable one.
 */
const LYRIC_WORD_COUNT_MIN_RATIO = 200 / 215;
const LYRIC_WORD_COUNT_MAX_RATIO = 240 / 230;
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
/** v4.1 (TASK C) — below this, no targeted recompose or rebalance can realistically save the pack; a full regeneration is the honest fix. Separate from PROMISE_FULFILLMENT_MIN (0.7) above, which stays the softer "room to improve" advisory bar. */
const PROMISE_FULFILLMENT_FULL_REGEN_FLOOR = 0.4;

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

/**
 * v4.1 (TASK C) — minimum-ish subset of tracks that need to change to
 * satisfy "at least `varietyMin` distinct categories, at most
 * `maxPerCategory` tracks sharing any one category" (title pattern shape,
 * emotion arc, ...). Greedy, not a proven combinatorial minimum: repeatedly
 * pulls one track out of the CURRENTLY largest category (the one most
 * responsible for the shortfall) until both constraints are satisfied.
 * This task's own scope explicitly prioritizes passing the real
 * verification scenario (a handful of tracks flagged, never the whole
 * pack) over an exactly-optimal minimum — see plan's own "과도한 일반화보다
 * 실제 검증 시나리오 D를 확실히 통과시키는 것 우선".
 */
function computeRebalanceTracks(groups: Map<string, number[]>, varietyMin: number, maxPerCategory: number | null): number[] {
  const working = new Map<string, number[]>();
  for (const [key, trackNos] of groups) working.set(key, [...trackNos]);
  const changed: number[] = [];

  if (maxPerCategory !== null) {
    for (const trackNos of working.values()) {
      while (trackNos.length > maxPerCategory) {
        changed.push(trackNos.pop()!);
      }
    }
  }

  // Each already-pulled track becomes its own new distinct category once
  // rewritten (that's the whole point of pulling it), so the real distinct
  // count after rebalancing is however many ORIGINAL groups still have a
  // member left, PLUS one per track already pulled out — not just the
  // former (a group that merely shrinks from 18 to 17 is still exactly one
  // group; the count only grows once a track has actually left it).
  function projectedDistinctCount(): number {
    const remainingGroups = [...working.values()].filter(list => list.length > 0).length;
    return remainingGroups + changed.length;
  }

  // Pulling a track out of a size-1 group can't create new variety (it just
  // empties that group while adding one to `changed` — net zero), so the
  // loop stops once no group has more than 1 left even if varietyMin is
  // still unmet — there is nothing left to rebalance, only a genuinely new
  // design fixes it.
  while (projectedDistinctCount() < varietyMin) {
    let largestKey: string | null = null;
    let largestSize = 1;
    for (const [key, trackNos] of working) {
      if (trackNos.length > largestSize) {
        largestSize = trackNos.length;
        largestKey = key;
      }
    }
    if (!largestKey) break;
    changed.push(working.get(largestKey)!.pop()!);
  }

  return [...new Set(changed)].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Pack-level findings, each tagged with its real IssueScope/affectedTracks
// (v4.1 TASK C — see GenerationGateResult.packBlocking's own doc comment).
// ---------------------------------------------------------------------------
function packLevelFindings(songs: SongIdea[], conceptLabel: string): { blocking: ScopedIssue[]; advisory: ScopedIssue[] } {
  const blocking: ScopedIssue[] = [];
  const advisory: ScopedIssue[] = [];
  const allTrackNos = songs.map(song => song.trackNo);
  if (!songs.length) return { blocking, advisory };

  // vocal-descriptor-variety (>=12, blocking) — same measurement fullAudit.ts's
  // vocal_desc_variety already reports (advisory-only there); promoted to
  // blocking here per this task's own §3-2 table. design-scope: a real
  // collapse here means vocalPlan.ts's own register text never reached the
  // pack, which only a design-time regeneration fixes.
  const registerPool = [...MALE_VOCAL_TRAIT_AXES.register, ...FEMALE_VOCAL_TRAIT_AXES.register];
  const distinctVocalDescriptors = new Set(
    songs.flatMap(song => registerPool.filter(register => song.stylePrompt.toLowerCase().includes(register.toLowerCase())))
  );
  if (distinctVocalDescriptors.size < VOCAL_DESCRIPTOR_VARIETY_MIN) {
    blocking.push({
      scope: 'design',
      id: 'vocal-descriptor-variety',
      labelKo: `보컬 서술 종류가 ${distinctVocalDescriptors.size}종입니다 (최소 ${VOCAL_DESCRIPTOR_VARIETY_MIN}종).`,
      affectedTracks: allTrackNos,
      fixHintKo: '설계 단계에서 보컬 서술 배분을 다시 실행해야 합니다 — 곡을 다시 만드는 것만으로는 고쳐지지 않습니다.'
    });
  }
  const missingVocalType = songs.filter(song => !song.vocalType);
  if (missingVocalType.length) {
    blocking.push({
      scope: 'design',
      id: 'vocal-type-missing',
      labelKo: `보컬 서술이 누락된 곡이 ${missingVocalType.length}곡 있습니다 (트랙 ${missingVocalType.map(song => song.trackNo).join(', ')}).`,
      affectedTracks: missingVocalType.map(song => song.trackNo),
      fixHintKo: '설계 단계에서 보컬 타입 배분을 다시 실행해야 합니다.'
    });
  }

  // title-pattern-variety (>=4) / title-pattern-max (<=5), blocking,
  // rebalance-scope — the worked example this task's own verification
  // scenario D targets: computeRebalanceTracks picks the real minimum
  // subset of titles that need to be rewritten, not the whole pack.
  const shapeGroups = new Map<string, number[]>();
  for (const song of songs) {
    const shape = classifyTitleShape(song.title);
    if (!shape) continue;
    shapeGroups.set(shape, [...(shapeGroups.get(shape) ?? []), song.trackNo]);
  }
  if (shapeGroups.size < TITLE_PATTERN_VARIETY_MIN || [...shapeGroups.values()].some(list => list.length > TITLE_PATTERN_MAX_SAME)) {
    const rebalanceTracks = computeRebalanceTracks(shapeGroups, TITLE_PATTERN_VARIETY_MIN, TITLE_PATTERN_MAX_SAME);
    const parts: string[] = [];
    if (shapeGroups.size < TITLE_PATTERN_VARIETY_MIN) parts.push(`제목 패턴 종류가 ${shapeGroups.size}종입니다 (최소 ${TITLE_PATTERN_VARIETY_MIN}종)`);
    for (const [shape, trackNos] of shapeGroups) {
      if (trackNos.length > TITLE_PATTERN_MAX_SAME) parts.push(`제목 패턴 "${shape}"가 ${trackNos.length}곡에 반복됩니다 (최대 ${TITLE_PATTERN_MAX_SAME}곡)`);
    }
    blocking.push({
      scope: 'rebalance',
      id: 'title-pattern-variety',
      labelKo: parts.join('; ') + '.',
      affectedTracks: rebalanceTracks,
      fixHintKo: `다음 ${rebalanceTracks.length}곡의 제목만 다시 지어주십시오. 가사와 스타일 프롬프트는 유지하십시오. (트랙 ${rebalanceTracks.join(', ')})`
    });
  }

  // title-concept-fit (advisory, >=50%), rebalance-scope.
  const titleConsistency = auditTitleConceptConsistency(songs);
  const conceptFitShare = songs.length ? (songs.length - titleConsistency.offConceptTitleCount) / songs.length : 0;
  if (conceptFitShare < 0.5) {
    advisory.push({
      scope: 'rebalance',
      id: 'title-concept-fit',
      labelKo: `컨셉 정합 제목이 ${Math.round(conceptFitShare * 100)}%입니다 (권장 50% 이상).`,
      affectedTracks: titleConsistency.failedTracks,
      fixHintKo: '컨셉과 어긋난 제목만 골라 다시 짓는 것을 고려하세요.'
    });
  }

  // lyric-situation-unique (blocking, 전부 다름), pair-scope — same
  // "worse one only" principle as compositionScorer.ts's style-similarity
  // check: keeps the first occurrence in each duplicate group as-is, flags
  // only the later track(s) as the one(s) needing a rewrite.
  const situationCounts = new Map<string, number[]>();
  for (const song of songs) {
    const key = (song.listenerSituation || '').trim();
    situationCounts.set(key, [...(situationCounts.get(key) ?? []), song.trackNo]);
  }
  const duplicateSituations = [...situationCounts.entries()].filter(([, trackNos]) => trackNos.length > 1);
  if (duplicateSituations.length) {
    const affected = duplicateSituations.flatMap(([, trackNos]) => trackNos.slice(1));
    blocking.push({
      scope: 'pair',
      id: 'lyric-situation-duplicate',
      labelKo: `가사 상황이 중복됩니다: ${duplicateSituations.map(([situation, trackNos]) => `"${situation || '(빈 값)'}" (트랙 ${trackNos.join(', ')})`).join('; ')}`,
      affectedTracks: [...new Set(affected)].sort((a, b) => a - b),
      fixHintKo: '중복된 곡 쌍마다 하나는 그대로 두고, 나머지 하나의 가사 상황만 다시 지어주십시오.'
    });
  }

  // lyric-emotion-variety (>=8, blocking), rebalance-scope — same
  // computeRebalanceTracks helper as title pattern (no per-category max
  // here, just a variety floor).
  const emotionGroups = new Map<string, number[]>();
  for (const song of songs) {
    if (!song.emotionArc) continue;
    emotionGroups.set(song.emotionArc, [...(emotionGroups.get(song.emotionArc) ?? []), song.trackNo]);
  }
  if (emotionGroups.size < EMOTION_ARC_VARIETY_MIN) {
    const rebalanceTracks = computeRebalanceTracks(emotionGroups, EMOTION_ARC_VARIETY_MIN, null);
    blocking.push({
      scope: 'rebalance',
      id: 'emotion-arc-variety',
      labelKo: `감정 아크 종류가 ${emotionGroups.size}종입니다 (최소 ${EMOTION_ARC_VARIETY_MIN}종).`,
      affectedTracks: rebalanceTracks,
      fixHintKo: `다음 ${rebalanceTracks.length}곡의 감정 아크만 다른 것으로 다시 지어주십시오. (트랙 ${rebalanceTracks.join(', ')})`
    });
  }

  // prompt-length (advisory, 350~650) / prompt-atoms (advisory, 15~25) / shared-atoms (advisory, <=5), rebalance-scope.
  const lengths = songs.map(song => song.stylePrompt.length);
  const outOfLengthTracks = songs.filter((song, idx) => lengths[idx] < PROMPT_LENGTH_MIN || lengths[idx] > PROMPT_LENGTH_MAX).map(song => song.trackNo);
  if (outOfLengthTracks.length) {
    advisory.push({
      scope: 'rebalance',
      id: 'prompt-length',
      labelKo: `style prompt 길이가 ${PROMPT_LENGTH_MIN}~${PROMPT_LENGTH_MAX}자 범위를 벗어난 곡이 ${outOfLengthTracks.length}곡입니다.`,
      affectedTracks: outOfLengthTracks,
      fixHintKo: '길이가 범위를 벗어난 곡만 골라 style prompt를 다시 작성하는 것을 고려하세요.'
    });
  }
  const atomCounts = songs.map(song => descriptorCount(song.stylePrompt));
  const outOfAtomsTracks = songs.filter((song, idx) => atomCounts[idx] < PROMPT_ATOMS_MIN || atomCounts[idx] > PROMPT_ATOMS_MAX).map(song => song.trackNo);
  if (outOfAtomsTracks.length) {
    advisory.push({
      scope: 'rebalance',
      id: 'prompt-atoms',
      labelKo: `style prompt 서술어 개수가 ${PROMPT_ATOMS_MIN}~${PROMPT_ATOMS_MAX}개 범위를 벗어난 곡이 ${outOfAtomsTracks.length}곡입니다.`,
      affectedTracks: outOfAtomsTracks,
      fixHintKo: '서술어 개수가 범위를 벗어난 곡만 골라 style prompt를 다시 작성하는 것을 고려하세요.'
    });
  }
  const similarity = lintInPackStyleSimilarity(songs.map(song => ({ trackNo: song.trackNo, stylePrompt: song.stylePrompt })));
  if (similarity.sharedAtomCount > SHARED_ATOMS_MAX) {
    advisory.push({
      scope: 'design',
      id: 'shared-style-atoms',
      labelKo: `18곡이 공유하는 서술어 원자가 ${similarity.sharedAtomCount}개입니다 (권장 ${SHARED_ATOMS_MAX}개 이하).`,
      affectedTracks: allTrackNos,
      fixHintKo: '설계 단계에서 스타일 프롬프트 원자 배분을 다시 검토하는 것을 고려하세요.'
    });
  }

  // promise-fulfillment: <70% stays a design-scope advisory (today's
  // pre-existing bar); v4.1 (TASK C) adds a genuinely-blocking 'full'-scope
  // finding below 40% (Full 재생성 threshold), separate from and stricter
  // than the 70% advisory bar above.
  if (conceptLabel.trim()) {
    const promiseAudit = auditPromises(songs, conceptLabel);
    if (promiseAudit.promises.length && promiseAudit.overallFulfillment < PROMISE_FULFILLMENT_MIN) {
      advisory.push({
        scope: 'design',
        id: 'promise-fulfillment',
        labelKo: `컨셉 약속 이행도가 ${Math.round(promiseAudit.overallFulfillment * 100)}%입니다 (권장 ${Math.round(PROMISE_FULFILLMENT_MIN * 100)}% 이상). 가장 약한 약속: ${promiseAudit.weakestPromise || '(없음)'}`,
        affectedTracks: allTrackNos,
        fixHintKo: '설계 단계에서 컨셉과 어긋난 부분을 다시 검토하는 것을 고려하세요.'
      });
    }
    if (promiseAudit.promises.length && promiseAudit.overallFulfillment < PROMISE_FULFILLMENT_FULL_REGEN_FLOOR) {
      blocking.push({
        scope: 'full',
        id: 'promise-fulfillment-critical',
        labelKo: `컨셉 약속 이행도가 ${Math.round(promiseAudit.overallFulfillment * 100)}%로 ${Math.round(PROMISE_FULFILLMENT_FULL_REGEN_FLOOR * 100)}% 미만입니다 — 부분 수정으로는 회복하기 어렵습니다.`,
        affectedTracks: allTrackNos,
        fixHintKo: '이 세트는 전체 재생성을 권장합니다.'
      });
    }
  }

  return { blocking, advisory };
}

// ---------------------------------------------------------------------------
// Per-track findings not already covered by compositionScorer.ts.
// ---------------------------------------------------------------------------
function perTrackFindings(song: SongIdea, language: LyricLanguage, wordCountRange: [number, number]): { blocking: string[]; advisory: string[] } {
  const blocking: string[] = [];
  const unitLabel = language === 'japanese' ? '자' : '단어';
  const { words, sections } = lyricWordAndSectionCounts(song.lyrics, language);
  if (words < wordCountRange[0] || words > wordCountRange[1]) {
    blocking.push(`가사 ${unitLabel}수 ${words} (기준 ${wordCountRange[0]}~${wordCountRange[1]})`);
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
  const baseResult = scoreComposition(songs, opts);
  const baseByTrack = new Map(baseResult.tracks.map(score => [score.trackNo, score]));
  const pack = packLevelFindings(songs, opts.conceptLabel ?? '');
  // v4.1 (TASK C) — this module builds ON TOP OF compositionScorer.ts (see
  // this file's own top doc comment), so its own pack-level findings
  // (era consistency, vocal/tempo structure collapse, vocabulary
  // repetition, ...) surface in this result's packBlocking/packAdvisory
  // too, not just this file's own checks.
  const packBlocking = [...baseResult.packBlocking, ...pack.blocking];
  const packAdvisory = [...baseResult.packAdvisory, ...pack.advisory];

  const lyricLanguage: LyricLanguage = opts.lyricLanguage ?? 'english';
  const { primaryRange: lyricTargetRange } = resolveLyricRange(lyricLanguage, opts.audienceProfile);
  const wordCountRange: [number, number] = [
    Math.round(lyricTargetRange[0] * LYRIC_WORD_COUNT_MIN_RATIO),
    Math.round(lyricTargetRange[1] * LYRIC_WORD_COUNT_MAX_RATIO)
  ];

  // v4.1 (TASK C) — track.blocking/advisory are now TRACK-SCOPED ONLY (the
  // old `...pack.blocking`/`...pack.advisory` spread here was the exact bug
  // this task exists to fix: a 3-song pack-level problem read as an
  // 18-song failure because every track's own list carried a copy of it).
  // Pack-level findings live in packBlocking/packAdvisory above instead,
  // each with its own real scope/affectedTracks.
  const tracks: GenerationGateTrackResult[] = songs.map(song => {
    const base = baseByTrack.get(song.trackNo);
    const own = perTrackFindings(song, lyricLanguage, wordCountRange);
    const blocking = [...(base?.blocking ?? []), ...own.blocking];
    const advisory = [...(base?.advisory ?? []), ...own.advisory];
    return { trackNo: song.trackNo, passed: blocking.length === 0, blocking, advisory };
  });

  const failingTrackNos = tracks.filter(track => !track.passed).map(track => track.trackNo);
  const packHasBlockingIssue = packBlocking.length > 0;
  return {
    // v4.1 (TASK C) — a pack-level blocking finding (e.g. title-pattern
    // collapse, era-share failure) means the pack isn't actually done even
    // when every individual track's own text passes — this must not read
    // as "생성 검증 통과" while a design/rebalance/full-scope issue is open.
    passed: failingTrackNos.length === 0 && !packHasBlockingIssue,
    tracks,
    failingTrackNos,
    needsFullRegeneration: failingTrackNos.length >= FULL_REGENERATION_TRACK_THRESHOLD || packBlocking.some(issue => issue.scope === 'full'),
    packBlocking,
    packAdvisory
  };
}
