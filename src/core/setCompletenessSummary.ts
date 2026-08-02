import type { SongIdea } from '../types';
import { classifyTitleShape } from './titleShapeVariety';
import { titleHookOverlapWarning } from './quality';
import { lyricWordAndSectionCounts } from './compositionScorer';
import type { VerifiedCombo } from '../data/verifiedCombos';

/**
 * v4.3 (TASK E-3) — "실전 투입 전 마지막 확인용 화면 ... 이 화면 하나로
 * '이 세트를 써도 되는가'를 판단할 수 있어야 합니다" (하루님). Pure
 * aggregation only — every number here is read from data the caller already
 * computed elsewhere in this app (관문 2/audit/promiseAudit all already run
 * inside a Worker — see core/localGenerationClient.ts — this module never
 * re-runs them, just assembles their outputs into one summary shape). See
 * components/SetCompletenessPanel.tsx for the card UI built on top of this.
 */

export interface SetCompletenessMusicStats {
  genreVariety: number;
  bpmRange: [number, number] | null;
  vocalCounts: { male: number; female: number; mixed: number };
}

export interface SetCompletenessLyricsStats {
  situationVariety: number;
  emotionVariety: number;
  avgWordCount: number;
}

export interface SetCompletenessTitleStats {
  patternVariety: number;
  hookMatchCount: number;
  totalCount: number;
  /** Songs carrying a non-literal packaging-language title (v4.3 TASK A) — undefined packagingLanguage or 'english' packs will always read 0/N, which is correct (nothing to localize), not a failure. */
  localizedCount: number;
}

export interface VerifiedComboPlacement {
  combo: VerifiedCombo;
  trackNos: number[];
}

export interface SetCompletenessSummary {
  setCode: string;
  conceptLabel: string;
  gate2Passed: boolean | null;
  gate2FailingTrackCount: number;
  /** null when the caller has no audit/baseline comparison available (e.g. first-ever run, no localStorage baseline yet) — shown as "미측정", never as a false 0. */
  auditRegressionCount: number | null;
  promiseFulfillmentPct: number | null;
  music: SetCompletenessMusicStats;
  lyrics: SetCompletenessLyricsStats;
  title: SetCompletenessTitleStats;
  audioAnalyzed: boolean;
  audioTakeCount: number;
  verifiedCombosPlaced: VerifiedComboPlacement[];
}

function songMatchesCombo(song: SongIdea, combo: VerifiedCombo): boolean {
  if (combo.verdict !== 'good') return false;
  if (!song.genreId || song.genreId !== combo.genreId) return false;
  if (typeof song.bpm !== 'number' || song.bpm < combo.bpmRange[0] || song.bpm > combo.bpmRange[1]) return false;
  if (combo.vocalType && song.vocalType !== combo.vocalType) return false;
  return true;
}

export interface BuildSetCompletenessSummaryInput {
  songs: SongIdea[];
  setCode: string;
  conceptLabel: string;
  gate2Passed: boolean | null;
  gate2FailingTrackCount: number;
  auditRegressionCount: number | null;
  promiseFulfillmentPct: number | null;
  lyricLanguage: import('../types').LyricLanguage;
  audioTakeCount: number;
  candidateVerifiedCombos: VerifiedCombo[];
}

export function buildSetCompletenessSummary(input: BuildSetCompletenessSummaryInput): SetCompletenessSummary {
  const { songs } = input;

  const genreVariety = new Set(songs.map(s => s.genreId).filter(Boolean)).size;
  const bpms = songs.map(s => s.bpm).filter((bpm): bpm is number => typeof bpm === 'number');
  const bpmRange: [number, number] | null = bpms.length ? [Math.min(...bpms), Math.max(...bpms)] : null;
  const vocalCounts = { male: 0, female: 0, mixed: 0 };
  for (const song of songs) {
    if (song.vocalType) vocalCounts[song.vocalType] += 1;
  }

  const situationVariety = new Set(songs.map(s => s.listenerSituation).filter(Boolean)).size;
  const emotionVariety = new Set(songs.map(s => s.emotionArc).filter(Boolean)).size;
  const wordCounts = songs.map(song => lyricWordAndSectionCounts(song.lyrics, input.lyricLanguage).words);
  const avgWordCount = wordCounts.length ? Math.round(wordCounts.reduce((sum, w) => sum + w, 0) / wordCounts.length) : 0;

  const patternVariety = new Set(songs.map(s => classifyTitleShape(s.title)).filter(Boolean)).size;
  const hookMatchCount = songs.filter(song => !titleHookOverlapWarning(song.title, song.hookPhrase)).length;
  const localizedCount = songs.filter(song => Boolean(song.titleLocalized)).length;

  const verifiedCombosPlaced: VerifiedComboPlacement[] = [];
  for (const combo of input.candidateVerifiedCombos) {
    const trackNos = songs.filter(song => songMatchesCombo(song, combo)).map(song => song.trackNo);
    if (trackNos.length) verifiedCombosPlaced.push({ combo, trackNos });
  }

  return {
    setCode: input.setCode,
    conceptLabel: input.conceptLabel,
    gate2Passed: input.gate2Passed,
    gate2FailingTrackCount: input.gate2FailingTrackCount,
    auditRegressionCount: input.auditRegressionCount,
    promiseFulfillmentPct: input.promiseFulfillmentPct,
    music: { genreVariety, bpmRange, vocalCounts },
    lyrics: { situationVariety, emotionVariety, avgWordCount },
    title: { patternVariety, hookMatchCount, totalCount: songs.length, localizedCount },
    audioAnalyzed: input.audioTakeCount > 0,
    audioTakeCount: input.audioTakeCount,
    verifiedCombosPlaced
  };
}
