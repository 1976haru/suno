import type { SongIdea } from '../types';
import { extractQualifyingLines } from './lyricLineLedger';
import type { SceneSignature } from './situationLedger';
import { sceneSimilarity, SCENE_SIMILARITY_ADVISORY_THRESHOLD, SCENE_SIMILARITY_BLOCKING_THRESHOLD } from './sceneSimilarity';

/**
 * v5.22 (AXIS 1 §1-7) — the two ledger-backed blocking checks the task
 * spec's own "관문 1"/"관문 2" section asks for, built as pure functions
 * (no IndexedDB access here — the caller pre-fetches ledger history the
 * same way core/importInspection.ts's languageContext/sessionExemptions are
 * already pre-resolved and passed in, not fetched inside the classifier).
 * Wired into core/importInspection.ts's inspectImportReport, the one real
 * pre-persistence checkpoint that already governs both the single-set
 * (App.tsx's onImportSongsJson) and multi-set (onImportMultiSetSongsJson,
 * via core/multiSetImportInspection.ts's reuse of inspectImportReport)
 * bridge-import paths — see this module's own header comment for why this
 * runs at import time rather than literally pre-generation: a bridge
 * agent's scenes/titles/lyrics don't exist until its response comes back,
 * so a genuine pre-generation ("관문 1"-timed) check is only possible for
 * the local-generation path, which already draws scenes from the fixed
 * lyricThemesForArchetype pool (unaffected by this task per §1-5's own
 * "삭제하지 마십시오" — local stays a fallback, not concept-driven).
 */

export interface SceneOverlapResult {
  blocking: boolean;
  /** trackNo -> the recent-history scene it collided with (case/whitespace-insensitive exact match). */
  collisions: { trackNo: number; situation: string; matchedHistoryEntry: string }[];
}

function normalizeForCompare(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Gate 1 — "장면이 최근 5세트와 겹치면 blocking". Exact (normalized) match
 * only: a near-miss is not this check's job (that's what the concept-driven
 * generation instruction itself is for) — a false-positive block over a
 * legitimately similar-but-distinct scene would be worse than missing a
 * genuine near-duplicate, per this task's own "무검수 기준을 느슨하게 만들지
 * 말 것" but ALSO its established precedent (v5.19) of never hard-blocking
 * a whole pack over a heuristic that can't be fully trusted.
 */
export function checkSceneOverlap(songs: Pick<SongIdea, 'trackNo' | 'listenerSituation'>[], recentHistory: string[]): SceneOverlapResult {
  const historyByNormalized = new Map(recentHistory.map(entry => [normalizeForCompare(entry), entry]));
  const collisions: SceneOverlapResult['collisions'] = [];
  for (const song of songs) {
    const situation = song.listenerSituation?.trim();
    if (!situation) continue;
    const matched = historyByNormalized.get(normalizeForCompare(situation));
    if (matched) collisions.push({ trackNo: song.trackNo, situation, matchedHistoryEntry: matched });
  }
  return { blocking: collisions.length > 0, collisions };
}

export interface SceneSimilarityMatch {
  trackNo: number;
  situation: string;
  matchedHistoryEntry: string;
  score: number;
}

export interface SceneSimilarityResult {
  /** true only when a match reaches SCENE_SIMILARITY_BLOCKING_THRESHOLD — a genuine near-verbatim reuse, not merely a similar idea. */
  blocking: boolean;
  blockingMatches: SceneSimilarityMatch[];
  /** SCENE_SIMILARITY_ADVISORY_THRESHOLD <= score < SCENE_SIMILARITY_BLOCKING_THRESHOLD — worth a human glance, never blocking on its own. */
  advisoryMatches: SceneSimilarityMatch[];
}

/**
 * codex 지시문 02 (TASK B) — the NEW near-miss signal checkSceneOverlap's
 * own doc comment explicitly says is out of its (exact-match) scope — see
 * core/sceneSimilarity.ts's own top doc comment for the full design and why
 * this is a separate function rather than a mode flag on checkSceneOverlap
 * (different data shape: this needs the richer SceneSignature axes, not
 * just the bare situation string checkSceneOverlap compares). Each song is
 * compared against every recent-history signature; only the single BEST
 * match per song is kept (a song already flagged as its worst-case overlap
 * doesn't need N-1 duplicate entries for every other, lower-scoring
 * history item).
 */
export function checkSceneSimilarity(
  songs: Pick<SongIdea, 'trackNo' | 'listenerSituation' | 'lyricFrameId' | 'lyricThemeMotionKo' | 'lyricThemeCastKo' | 'lyricThemeEraSettingKo'>[],
  recentHistory: SceneSignature[]
): SceneSimilarityResult {
  const blockingMatches: SceneSimilarityMatch[] = [];
  const advisoryMatches: SceneSimilarityMatch[] = [];
  if (!recentHistory.length) return { blocking: false, blockingMatches, advisoryMatches };

  for (const song of songs) {
    const situation = song.listenerSituation?.trim();
    if (!situation) continue;
    const signature: SceneSignature = {
      situation,
      packId: '',
      trackNo: song.trackNo,
      ...(song.lyricFrameId ? { frameId: song.lyricFrameId } : {}),
      ...(song.lyricThemeMotionKo ? { motionKo: song.lyricThemeMotionKo } : {}),
      ...(song.lyricThemeCastKo ? { castKo: song.lyricThemeCastKo } : {}),
      ...(song.lyricThemeEraSettingKo ? { eraSettingKo: song.lyricThemeEraSettingKo } : {})
    };
    let best: { entry: SceneSignature; score: number } | undefined;
    for (const entry of recentHistory) {
      const score = sceneSimilarity(signature, entry);
      if (!best || score > best.score) best = { entry, score };
    }
    if (!best || best.score < SCENE_SIMILARITY_ADVISORY_THRESHOLD) continue;
    const match: SceneSimilarityMatch = { trackNo: song.trackNo, situation, matchedHistoryEntry: best.entry.situation, score: best.score };
    if (best.score >= SCENE_SIMILARITY_BLOCKING_THRESHOLD) blockingMatches.push(match);
    else advisoryMatches.push(match);
  }

  return { blocking: blockingMatches.length > 0, blockingMatches, advisoryMatches };
}

export interface TitleHistoryCollisionResult {
  blocking: boolean;
  collisions: { trackNo: number; title: string }[];
}

/** Gate 1 — "제목이 전체 이력과 완전일치 -> blocking". `historicalTitles` is the channel's full title history (core/hookLedger.ts's usedTitles), already set-normalized by the caller. */
export function checkTitleHistoryCollision(songs: Pick<SongIdea, 'trackNo' | 'title'>[], historicalTitles: Set<string>): TitleHistoryCollisionResult {
  const normalizedHistory = new Set(Array.from(historicalTitles).map(normalizeForCompare));
  const collisions = songs
    .filter(song => song.title?.trim() && normalizedHistory.has(normalizeForCompare(song.title)))
    .map(song => ({ trackNo: song.trackNo, title: song.title }));
  return { blocking: collisions.length > 0, collisions };
}

export interface LyricLineOverlapResult {
  /** Only true at 3+ matches, per spec ("한 세트 3개 이상이면 blocking") — 1-2 matches are recorded but non-blocking. */
  blocking: boolean;
  matches: { trackNo: number; line: string }[];
}

/**
 * Gate 2 — "가사 문장 25자 이상 완전일치 — 한 세트 3개 이상이면 blocking".
 * Reuses lyricLineLedger.ts's own extractQualifyingLines so the SAME
 * length-floor/section-tag/hook-exclusion rules govern both what gets
 * remembered and what gets checked against that memory — never a
 * second, silently-drifting copy of that logic.
 */
export function checkLyricLineOverlap(songs: Pick<SongIdea, 'trackNo' | 'lyrics' | 'hookPhrase'>[], recentHistory: string[]): LyricLineOverlapResult {
  const historySet = new Set(recentHistory.map(normalizeForCompare));
  const matches: LyricLineOverlapResult['matches'] = [];
  for (const song of songs) {
    const lines = extractQualifyingLines(song.lyrics ?? '', song.hookPhrase ?? '');
    for (const line of lines) {
      if (historySet.has(normalizeForCompare(line))) matches.push({ trackNo: song.trackNo, line });
    }
  }
  return { blocking: matches.length >= 3, matches };
}
