/**
 * codex 지시문 06 (TASK E) — "가사 정렬". No dedicated required test file
 * (this task's own §필수 테스트 list names 8 files, none for lyrics
 * alignment — confirmed by direct comparison against the spec text), so
 * this is scoped exactly to what the spec's own two paragraphs literally
 * ask for: a real, structured MANUAL checklist for today (no ASR exists
 * anywhere in this codebase, confirmed by investigation), plus a type-only
 * future ASR contract — "향후 ASR adapter" is the spec's own explicit
 * framing for that half, so it's deliberately not implemented, matching
 * this whole session's "real type, not fake wiring" precedent (e.g.
 * core/jpKidsPolicy.ts's FuriganaPolicy, core/kpopSharedChecks.ts's
 * CenterTrackPolicy).
 */

export const MANUAL_LYRICS_ALIGNMENT_ITEMS = [
  { id: 'missing-lyrics', labelKo: '가사 누락' },
  { id: 'hook-repetition', labelKo: '훅 반복' },
  { id: 'mispronunciation', labelKo: '잘못 발음' },
  { id: 'section-order', labelKo: '섹션 순서' },
  { id: 'duet-part', labelKo: 'duet/part' },
  { id: 'sung-meta-tag', labelKo: 'meta tag를 노래함' }
] as const;

export type ManualLyricsAlignmentItemId = (typeof MANUAL_LYRICS_ALIGNMENT_ITEMS)[number]['id'];

const MANUAL_ITEM_ID_SET: ReadonlySet<string> = new Set(MANUAL_LYRICS_ALIGNMENT_ITEMS.map(item => item.id));

export function isValidManualLyricsAlignmentItemId(id: string): id is ManualLyricsAlignmentItemId {
  return MANUAL_ITEM_ID_SET.has(id);
}

/** One take's real, human-entered manual check result — which of the 6 real items were actually found, plus free-text notes. Every item omitted from `flaggedItemIds` is implicitly "checked, not found" (never assumed unchecked/unknown — a caller that wants to distinguish "not yet reviewed" from "reviewed, clean" tracks that separately via `reviewed`). */
export interface ManualLyricsAlignmentChecklist {
  takeId: string;
  reviewed: boolean;
  flaggedItemIds: ManualLyricsAlignmentItemId[];
  noteKo?: string;
}

export function createEmptyManualLyricsAlignmentChecklist(takeId: string): ManualLyricsAlignmentChecklist {
  return { takeId, reviewed: false, flaggedItemIds: [] };
}

// ---------------------------------------------------------------------------
// Future ASR adapter — type-only contract, spec's own explicit "향후" framing.
// No implementation exists or is claimed to exist; a real ASR integration
// (e.g. a browser-side or server-side speech-to-text model) plugs in here.
// ---------------------------------------------------------------------------

export interface TranscriptSegment {
  startSec: number;
  endSec: number;
  text: string;
}

export interface Transcript {
  segments: TranscriptSegment[];
  language: string;
}

export interface AlignmentReport {
  missingLyricsLines: string[];
  mispronouncedLines: { expected: string; heard: string }[];
  sectionOrderMismatch: boolean;
}

export interface LyricsAlignmentProvider {
  transcribe(file: Blob): Promise<Transcript>;
  compare(transcript: Transcript, expectedLyrics: string): AlignmentReport;
}
