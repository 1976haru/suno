import { safeFileName } from '../utils/zipExporter';
import { stripSetTitlePrefix } from '../utils/generation';

/**
 * v3.57 (지시문 C) — CapCut subtitle export. This module only ever reads a
 * song's already-composed `lyrics` string (see core/lyricEngine.ts's
 * composeLyrics) and a user-supplied playback duration; it never calls an
 * AI provider and never estimates timing from audio (there is no audio
 * here) — see SRT_TIMING_DISCLAIMER, always shown alongside any export.
 */

const VOCAL_META_TAG_LINE = /^\[(male vocal|female vocal|children'?s choir|duet vocal|group vocal)\]$/i;
const TITLE_LINE = /^title:\s*/i;
const SECTION_TAG_LINE = /^\[([^\]]+)\]$/;

export interface LyricSungLine {
  /** Lowercased section this line belongs to (e.g. 'verse 1', 'chorus', 'short bridge'), from the nearest preceding [tag] line. */
  sectionTag: string;
  text: string;
}

/**
 * Flattens composed lyrics into the ordered list of lines actually sung —
 * i.e. everything except the leading vocal-meta-tag line ([male vocal] etc,
 * see core/vocalPlan.ts's ensureVocalMetaTag), the "Title: ..." display
 * line, section-tag lines themselves ([verse 1], [chorus], ...), and blank
 * separators. A song's lyricTranslations arrays (types.ts) are line-aligned
 * with this function's output — same length, same order — so a translated
 * line at index i always corresponds to extractLyricSungLines(lyrics)[i].
 */
export function extractLyricSungLines(lyrics: string): LyricSungLine[] {
  const lines = String(lyrics || '').split(/\r?\n/);
  let currentSection = 'intro';
  const result: LyricSungLine[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (VOCAL_META_TAG_LINE.test(line)) continue;
    if (TITLE_LINE.test(line)) continue;
    const sectionMatch = line.match(SECTION_TAG_LINE);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim().toLowerCase();
      continue;
    }
    result.push({ sectionTag: currentSection, text: line });
  }

  return result;
}

/**
 * TASK v3.57 — "섹션 비율로 자막 구간을 자동 분배": without audio there is no
 * way to know a section's real musical length, so this is a deliberate,
 * disclosed heuristic rather than a measurement. Chorus/final-chorus lines
 * are weighted heavier (choruses are usually sung with more sustain/
 * repetition per line than a quick pre-chorus or bridge line), so a lyric
 * line's on-screen duration varies by which section it's in instead of
 * splitting the total time flatly across every line regardless of section.
 * pre-chorus is checked before the plain chorus pattern since its own tag
 * text contains the substring "chorus".
 */
function weightForSection(sectionTag: string): number {
  const tag = sectionTag.toLowerCase();
  if (/pre-chorus/.test(tag)) return 0.9;
  if (/chorus/.test(tag)) return 1.15;
  if (/bridge/.test(tag)) return 0.85;
  return 1;
}

export interface SrtCue {
  index: number;
  startMs: number;
  endMs: number;
  englishText: string;
  translatedText?: string;
}

/**
 * Distributes `totalSeconds` across `lines` proportionally to each line's
 * section weight (see weightForSection), then attaches translatedLines[i]
 * (if present) as the cue's second subtitle row. Returns [] for empty
 * input or a non-positive duration — callers should treat that as "not
 * ready to export yet", not a crash.
 */
export function buildSrtCues(lines: LyricSungLine[], totalSeconds: number, translatedLines?: string[]): SrtCue[] {
  if (!lines.length || !(totalSeconds > 0)) return [];

  const weights = lines.map(line => weightForSection(line.sectionTag));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || lines.length;
  const totalMs = totalSeconds * 1000;

  let cursor = 0;
  return lines.map((line, i) => {
    const startMs = cursor;
    const isLast = i === lines.length - 1;
    const endMs = isLast ? totalMs : cursor + (weights[i] / totalWeight) * totalMs;
    cursor = endMs;
    return {
      index: i + 1,
      startMs: Math.round(startMs),
      endMs: Math.round(endMs),
      englishText: line.text,
      translatedText: translatedLines?.[i]?.trim() || undefined
    };
  });
}

function pad(value: number, length = 2): string {
  return String(Math.max(0, Math.trunc(value))).padStart(length, '0');
}

/** SRT's required `HH:MM:SS,mmm` timestamp format. */
export function formatSrtTimestamp(ms: number): string {
  const clamped = Math.max(0, Math.round(ms));
  const hours = Math.floor(clamped / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const millis = clamped % 1000;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`;
}

export type SrtMode = 'en' | 'en-ko' | 'en-ja';

export const SRT_MODE_LABELS: Record<SrtMode, string> = {
  en: '영어만',
  'en-ko': '영어 + 한국어',
  'en-ja': '영어 + 일본어'
};

/**
 * Builds one complete .srt file's text (index, blank-line-separated blocks,
 * `-->` arrow, English line first then the translation when the mode calls
 * for one and a translation is actually available for that cue — a cue
 * missing its translation silently falls back to English-only rather than
 * printing an empty second line).
 */
export function buildSrtFile(cues: SrtCue[], mode: SrtMode = 'en'): string {
  if (!cues.length) return '';
  const blocks = cues.map(cue => {
    const textLines = mode !== 'en' && cue.translatedText
      ? [cue.englishText, cue.translatedText]
      : [cue.englishText];
    return [String(cue.index), `${formatSrtTimestamp(cue.startMs)} --> ${formatSrtTimestamp(cue.endMs)}`, ...textLines].join('\n');
  });
  return `${blocks.join('\n\n')}\n`;
}

/**
 * Accepts "SS", "MM:SS", or "HH:MM:SS" (whitespace-tolerant); returns null
 * for anything else so the caller can show a validation message instead of
 * silently treating garbage input as 0 seconds.
 */
export function parseDurationToSeconds(input: string): number | null {
  const trimmed = String(input || '').trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':').map(part => part.trim());
  if (!parts.length || parts.length > 3 || parts.some(part => !/^\d+(\.\d+)?$/.test(part))) return null;
  const nums = parts.map(Number);
  if (nums.length === 1) return nums[0];
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  return nums[0] * 3600 + nums[1] * 60 + nums[2];
}

/**
 * TASK v4.12 bugfix — callers pass `song.title`, which already carries its
 * own "NN. " prefix by default (utils/generation.ts's
 * applySetTitlePrefixesToBlueprint), so prepending trackNo here too doubled
 * it into filenames like "02_02. Folded_ko.srt". Strips any existing prefix
 * first via that same module's own stripSetTitlePrefix.
 */
export function srtFilename(trackNo: number, title: string, mode: SrtMode): string {
  return `${String(trackNo).padStart(2, '0')}_${safeFileName(stripSetTitlePrefix(title))}_${mode}.srt`;
}

/**
 * TASK v3.57 — timing here is a proportional estimate from the user's own
 * MM:SS input, not a real audio measurement (this app never has the
 * rendered audio, only the lyric text) — every SRT export in the UI must
 * surface this so a user doesn't assume frame-accurate sync.
 */
export const SRT_TIMING_DISCLAIMER = '정밀 싱크는 자동으로 맞출 수 없습니다. 캡컷에서 자막 타이밍을 곡에 맞게 미세조정해주세요.';
