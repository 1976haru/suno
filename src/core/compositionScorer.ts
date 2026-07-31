import type { SongIdea } from '../types';
import { findArrangementVocabularyInLyrics } from './lyricVocabularyGuard';
import { findArtistReferenceLeaks } from './artistReferenceDecomposer';
import { lintInPackLyricDiversity, lintInPackStyleSimilarity } from './diversityLinter';
import { hookSceneTimeOfDayWarning, scenePropContradictionWarning, titleHookOverlapWarning } from './quality';
import { eraBucketForGenreId, ERA_FORBIDDEN_DESCRIPTORS } from '../data/eraExclusions';
import { findExcessiveVocabularyRepetition } from './lyricVocabularyRepetition';
import { findNearDuplicateHook } from './hookSimilarity';

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
}

export function scoreComposition(songs: SongIdea[], opts?: ScoreCompositionOptions): CompositionScore[] {
  if (!songs.length) return [];

  const historicalHooks = opts?.historicalHooks ?? [];
  const historicalHookKeys = new Set(historicalHooks.map(hook => hook.trim().toLowerCase()));

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

    return { trackNo: song.trackNo, passed: blocking.length === 0, blocking, advisory };
  });
}
