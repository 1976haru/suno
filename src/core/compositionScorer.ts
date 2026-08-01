import type { SongIdea } from '../types';
import { findArrangementVocabularyInLyrics } from './lyricVocabularyGuard';
import { findArtistReferenceLeaks } from './artistReferenceDecomposer';
import { lintInPackLyricDiversity, lintInPackStyleSimilarity } from './diversityLinter';
import { hookSceneTimeOfDayWarning, scenePropContradictionWarning, titleHookOverlapWarning } from './quality';
import { eraBucketForGenreId, ERA_FORBIDDEN_DESCRIPTORS, ERA_LABEL } from '../data/eraExclusions';
import { findExcessiveVocabularyRepetition, findHookWordOveruse } from './lyricVocabularyRepetition';
import { findNearDuplicateHook } from './hookSimilarity';
import { titleShapeVarietyWarning } from './titleShapeVariety';
import { eraSharesOf, type EraConstraint } from './constraints';

/**
 * TASK v3.62 (TASK 2) — C안's whole premise is "the app plans and scores,
 * the LLM composes" instead of "the app dictates and hopes." This module
 * is deliberately almost entirely reuse: every check below except the two
 * marked NEW already existed (v3.58-v3.61) and previously only ran as
 * import-time warnings nobody had to act on. Here they become the gate a
 * recomposed song must pass (see core/compositionRecompose.ts, TASK 3) —
 * the same functions, now actually blocking instead of just informational.
 */
export interface CompositionScore {
  trackNo: number;
  passed: boolean;
  /** Must be fixed by recomposing this song (TASK 3's retry loop targets these). */
  blocking: string[];
  /** Surfaced to the user but never blocks. */
  advisory: string[];
}

/** TASK v3.62 (TASK 2-2, NEW) — a real pack measured 106 comma-separated descriptors in one stylePrompt; Suno reads a descriptor list, not prose, and this many stops being legible. 20/40 are the hard bounds; 25/35 is the advisory sweet spot the task's own spec asked for. */
const DESCRIPTOR_COUNT_BLOCK_MIN = 20;
const DESCRIPTOR_COUNT_BLOCK_MAX = 40;
const DESCRIPTOR_COUNT_ADVISORY_MIN = 25;
const DESCRIPTOR_COUNT_ADVISORY_MAX = 35;

function descriptorCount(stylePrompt: string): number {
  return stylePrompt.split(',').map(atom => atom.trim()).filter(Boolean).length;
}

/** TASK v3.58 (TASK 1) threshold, reused here as the blocking bar for cross-song style-prompt similarity. */
const STYLE_SIMILARITY_BLOCK_THRESHOLD = 0.28;

/**
 * TASK v3.70 (TASK A) — a duet song's stylePrompt reliably contains the
 * literal word "duet" without needing any extra slot/plan plumbing threaded
 * into this function: both duet vocal presets' own prompt text says "...
 * duet, ..." (data/vocalPresets.ts), and reconcileWithPreassignedSlot
 * (core/batchPreallocation.ts) force-appends that exact vocalText into the
 * final stylePrompt if a remote agent ever omits it — so by the time a song
 * reaches this scorer, "duet" is a reliable, self-contained signal.
 */
const DUET_STYLE_SIGNAL = /\bduet\b/i;

/** Only a colon-bearing bracket tag counts as a per-section assignment (e.g. "[verse 1: male vocal]") — the single blanket "[male vocal]"/"[duet vocal]" meta tag every solo/duet song already gets at the very top of its lyrics (core/vocalPlan.ts's resolveVocalMetaTag) must never be mistaken for one. */
function sectionLevelGenderTags(lyrics: string): string[] {
  return (lyrics.match(/\[[^\]]*:[^\]]*\]/g) || []).filter(tag => /\b(male|female)\b/i.test(tag));
}

export interface ScoreCompositionOptions {
  /**
   * TASK v3.64 (TASK A) — the channel's real cross-pack hook history (see
   * core/hookLedger.ts's recentUsedTitlesAndHooks). Wiring this in turns
   * the previously-warning-only "duplicates a hook already used by this
   * channel" check (claudeCodeBridge.ts's flagHookCollisions, still
   * running unchanged at import time) into an actual blocking gate here —
   * so the recompose loop (TASK 3) and the bridge's "재작곡 지시문 복사" button
   * (Step4Result.tsx) both act on it instead of it only ever showing as a
   * soft warning nobody had to act on. Optional — omitting it (e.g. a
   * caller with no channel/IndexedDB context) just skips this specific
   * check, same as any other omitted context.
   */
  historicalHooks?: string[];
  /**
   * v4.2 (TASK A3, TASK B) — this pack's own resolved era constraint (see
   * core/constraints.ts's EraConstraint), when the caller has one. Undefined
   * (or era.unspecified — no decade/artist-era signal in the concept)
   * skips this check entirely, same as any other omitted context; never
   * invented from the songs themselves.
   */
  eraConstraint?: EraConstraint;
}

/** v4.2 (TASK A3, TASK B) — see this task's own §3-3 "primary 비중 < 50% → blocking, forbidden 시대 장르 존재 → blocking, 범용 장르 > 20% → advisory". Pack-level (not attributable to one track), so every song's own score gets the same findings, same pattern as vocabularyRepetitionWarning/titleShapeWarning below. */
function eraConsistencyFindings(songs: SongIdea[], eraConstraint: EraConstraint | undefined): { blocking: string[]; advisory: string[] } {
  if (!eraConstraint || eraConstraint.unspecified) return { blocking: [], advisory: [] };
  const genreCounts: Record<string, number> = {};
  for (const song of songs) {
    if (song.genreId) genreCounts[song.genreId] = (genreCounts[song.genreId] ?? 0) + 1;
  }
  const shares = eraSharesOf(genreCounts);
  const primaryShare = shares[eraConstraint.primary] ?? 0;
  const genericShare = shares.generic ?? 0;
  const forbiddenBuckets = eraConstraint.forbidden.filter(bucket => (shares[bucket] ?? 0) > 0);

  const blocking: string[] = [];
  const advisory: string[] = [];
  if (primaryShare < 0.5) {
    blocking.push(`이 컨셉의 주 시대(${ERA_LABEL[eraConstraint.primary]}) 장르 비중이 ${Math.round(primaryShare * 100)}%로 최소 50% 미만입니다.`);
  }
  if (forbiddenBuckets.length) {
    blocking.push(`이 컨셉이 금지한 시대(${forbiddenBuckets.map(bucket => ERA_LABEL[bucket]).join(', ')}) 장르가 포함되어 있습니다 (${forbiddenBuckets.map(bucket => `${Math.round((shares[bucket] ?? 0) * 100)}%`).join(', ')}).`);
  }
  if (genericShare > 0.2) {
    advisory.push(`시대 표기 없는 범용 장르 비중이 ${Math.round(genericShare * 100)}%로 권장 상한(20%)을 넘습니다.`);
  }
  return { blocking, advisory };
}

export function scoreComposition(songs: SongIdea[], opts?: ScoreCompositionOptions): CompositionScore[] {
  if (!songs.length) return [];

  const historicalHooks = opts?.historicalHooks ?? [];
  const historicalHookKeys = new Set(historicalHooks.map(hook => hook.trim().toLowerCase()));
  const eraFindings = eraConsistencyFindings(songs, opts?.eraConstraint);

  const vocabFindings = findArrangementVocabularyInLyrics(songs);
  const vocabByTrack = new Map<number, string[]>();
  for (const finding of vocabFindings) {
    vocabByTrack.set(finding.trackNo, [...(vocabByTrack.get(finding.trackNo) || []), finding.line]);
  }

  const similarityReport = lintInPackStyleSimilarity(songs.map(song => ({ trackNo: song.trackNo, stylePrompt: song.stylePrompt })));
  const lyricDiversityReport = lintInPackLyricDiversity(songs.map(song => ({ trackNo: song.trackNo, lyrics: song.lyrics, hookPhrase: song.hookPhrase, title: song.title })));
  const repeatedPatternTracks = new Set([
    ...lyricDiversityReport.repeatedChorusHookPatterns.flatMap(p => p.trackNos),
    ...lyricDiversityReport.repeatedTitleShapes.flatMap(p => p.trackNos),
    ...lyricDiversityReport.repeatedFirstLinePatterns.flatMap(p => p.trackNos),
    ...lyricDiversityReport.repeatedChorusStructures.flatMap(p => p.trackNos)
  ]);

  // NEW (TASK v3.64 TASK A-4) — pack-wide vocabulary repetition (e.g. a real
  // pack repeated "window" 28x, "light"/"old" 27x each). This is a
  // whole-pack word-choice property, not attributable to any one track, so
  // (like the pack-level lyric-diversity checks above) the same finding is
  // surfaced as an advisory on every track rather than picking one to blame.
  const vocabularyRepetitionFindings = findExcessiveVocabularyRepetition(songs);
  const vocabularyRepetitionWarning = vocabularyRepetitionFindings.length
    ? `이 세트에서 다음 단어가 상한을 넘겨 반복됩니다: ${vocabularyRepetitionFindings.map(f => `${f.word} ${f.count}회 (상한 ${f.cap})`).join(', ')}`
    : undefined;

  // NEW (v4.2, TASK A3 TASK D-2) — a word anchoring 3+ distinct hooks reads
  // as a recurring gimmick even when its pack-wide word count never crosses
  // GENERIC_WORD_CAP (findExcessiveVocabularyRepetition above counts lyric
  // bodies, not hooks specifically). Advisory only, per this task's own
  // "어휘 반복을 blocking으로 세게 걸지 말 것".
  const hookWordOveruseFindings = findHookWordOveruse(songs);
  const hookWordOveruseWarning = hookWordOveruseFindings.length
    ? `다음 단어가 3개 이상의 훅에 반복됩니다: ${hookWordOveruseFindings.map(f => `${f.word} (훅 ${f.hookCount}개)`).join(', ')}`
    : undefined;

  // NEW (TASK v3.64 TASK E) — real measurement: a real pack's titles were
  // almost entirely "[noun][noun]" (Firstlight Cup, Folded Frost, ...).
  // Warning-level only — title/hook overlap is never enforced as a ratio.
  const titleShapeWarning = titleShapeVarietyWarning(songs.map(song => song.title));

  return songs.map(song => {
    const blocking: string[] = [];
    const advisory: string[] = [];

    // Reused: TASK v3.60 TASK A — arrangement/production vocabulary sung as lyrics.
    const vocabLines = vocabByTrack.get(song.trackNo);
    if (vocabLines?.length) {
      blocking.push(`가사에 편곡/악기 어휘가 문장의 주어로 등장합니다 — "${vocabLines[0]}"`);
    }

    // Reused: TASK v3.58 TASK 3 — artist-name leak guard (style prompt + lyrics + youtube).
    const styleLeaks = findArtistReferenceLeaks(song.stylePrompt);
    if (styleLeaks.length) blocking.push(`style prompt에 아티스트/밴드명 누출 (${styleLeaks.map(l => l.surface).join(', ')})`);
    const lyricLeaks = findArtistReferenceLeaks(song.lyrics);
    if (lyricLeaks.length) blocking.push(`가사에 아티스트/밴드명 누출 (${lyricLeaks.map(l => l.surface).join(', ')})`);
    const youtubeLeaks = findArtistReferenceLeaks(`${song.youtube?.title ?? ''} ${song.youtube?.description ?? ''}`);
    if (youtubeLeaks.length) blocking.push(`youtube 메타데이터에 아티스트/밴드명 누출 (${youtubeLeaks.map(l => l.surface).join(', ')})`);

    // NEW (TASK v3.70 TASK A) — real listening feedback: a duet-prompted
    // track rendered as a single voice because nothing in the lyrics told
    // Suno which section is which singer (Suno reads lyric tags to split
    // vocals, not stylePrompt prose — see core/vocalPlan.ts's
    // applyDuetSectionVocalTags). Blocking for a duet missing both genders'
    // section tags; advisory (not blocking) for a non-duet song that
    // somehow has them, since that's surprising but not necessarily wrong.
    const isDuetSong = DUET_STYLE_SIGNAL.test(song.stylePrompt);
    const genderTags = sectionLevelGenderTags(song.lyrics);
    const hasMaleSectionTag = genderTags.some(tag => /\bmale\b/i.test(tag));
    const hasFemaleSectionTag = genderTags.some(tag => /\bfemale\b/i.test(tag));
    if (isDuetSong && !(hasMaleSectionTag && hasFemaleSectionTag)) {
      blocking.push('듀엣 곡인데 가사에 [Verse 1: Male Vocal]/[Verse 2: Female Vocal] 같은 섹션별 보컬 배정 태그가 없습니다 — Suno는 가사 태그로 보컬을 나누므로, 태그가 없으면 한 명이 전부 부릅니다.');
    } else if (!isDuetSong && (hasMaleSectionTag || hasFemaleSectionTag)) {
      advisory.push('단독 보컬 곡인데 가사에 섹션별 성별 보컬 배정 태그가 있습니다 — 의도한 것인지 확인하세요.');
    }

    // NEW (TASK v3.64 TASK D) — was a warning-only check (claudeCodeBridge.ts's
    // flagHookCollisions, unchanged, still runs at import time too); this is
    // the same real-history data now also gating recompose/the copy-instruction button.
    if (song.hookPhrase && historicalHookKeys.has(song.hookPhrase.trim().toLowerCase())) {
      blocking.push(`훅 "${song.hookPhrase}"가 이 채널의 이전 세트에서 이미 사용됐습니다`);
    } else if (song.hookPhrase) {
      const nearDuplicate = findNearDuplicateHook(song.hookPhrase, historicalHooks);
      if (nearDuplicate) {
        blocking.push(`훅 "${song.hookPhrase}"가 이전 세트의 훅 "${nearDuplicate.matchedAgainst}"과 사실상 같은 훅입니다 (단어 일치율 ${Math.round(nearDuplicate.similarity * 100)}%)`);
      }
    }

    // Reused: TASK v3.58 TASK 1 — cross-song style-prompt similarity, only the pair(s) this track is actually part of.
    if (similarityReport.worstPair && similarityReport.worstPair.similarity > STYLE_SIMILARITY_BLOCK_THRESHOLD
      && (similarityReport.worstPair.trackNoA === song.trackNo || similarityReport.worstPair.trackNoB === song.trackNo)) {
      blocking.push(`다른 트랙(${similarityReport.worstPair.trackNoA === song.trackNo ? similarityReport.worstPair.trackNoB : similarityReport.worstPair.trackNoA})과 스타일 프롬프트 유사도 ${Math.round(similarityReport.worstPair.similarity * 100)}% (기준 ${Math.round(STYLE_SIMILARITY_BLOCK_THRESHOLD * 100)}% 이하)`);
    }

    // NEW (TASK 2-2) — descriptor count.
    const count = descriptorCount(song.stylePrompt);
    if (count < DESCRIPTOR_COUNT_BLOCK_MIN || count > DESCRIPTOR_COUNT_BLOCK_MAX) {
      blocking.push(`style prompt 서술어가 ${count}개입니다 (허용 ${DESCRIPTOR_COUNT_BLOCK_MIN}-${DESCRIPTOR_COUNT_BLOCK_MAX}개)`);
    } else if (count < DESCRIPTOR_COUNT_ADVISORY_MIN || count > DESCRIPTOR_COUNT_ADVISORY_MAX) {
      advisory.push(`style prompt 서술어가 ${count}개입니다 (권장 ${DESCRIPTOR_COUNT_ADVISORY_MIN}-${DESCRIPTOR_COUNT_ADVISORY_MAX}개)`);
    }

    // NEW (TASK 2-2) — era-anachronism check for the oldpop-* family.
    const eraBucket = eraBucketForGenreId(song.genreId);
    if (eraBucket) {
      const forbidden = ERA_FORBIDDEN_DESCRIPTORS[eraBucket];
      const lowerPrompt = song.stylePrompt.toLowerCase();
      const found = forbidden.filter(term => lowerPrompt.includes(term));
      if (found.length) {
        blocking.push(`${eraBucket} 장르(${song.genreId})인데 이 시대에 없는 서술어가 있습니다: ${found.join(', ')}`);
      }
    }

    // Reused: TASK v3.60 TASK E — hook/scene time-of-day and prop contradictions (advisory).
    const timeOfDayWarning = hookSceneTimeOfDayWarning(song.hookPhrase, song.listenerSituation);
    if (timeOfDayWarning) advisory.push(timeOfDayWarning);
    const propWarning = scenePropContradictionWarning(song.listenerSituation, song.lyrics);
    if (propWarning) advisory.push(propWarning);

    // Reused: v3.58 TASK 5-6 — title/hook zero-overlap (advisory).
    const overlapWarning = titleHookOverlapWarning(song.title, song.hookPhrase);
    if (overlapWarning) advisory.push(overlapWarning);

    // Reused: TASK v3.60 TASK D — chorus/title monotony (advisory, pack-level but attributed per track when this track is part of the repeated group).
    if (repeatedPatternTracks.has(song.trackNo)) {
      advisory.push('이 곡의 후렴 반복 패턴/제목 형태/첫줄 패턴이 세트 내 다른 곡들과 반복됩니다.');
    }

    if (vocabularyRepetitionWarning) advisory.push(vocabularyRepetitionWarning);
    if (hookWordOveruseWarning) advisory.push(hookWordOveruseWarning);
    if (titleShapeWarning) advisory.push(titleShapeWarning);
    blocking.push(...eraFindings.blocking);
    advisory.push(...eraFindings.advisory);

    return { trackNo: song.trackNo, passed: blocking.length === 0, blocking, advisory };
  });
}
