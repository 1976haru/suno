/**
 * TASK v3.73 (TASK B) — matches a real Suno export's filename ("01 Two
 * Sugars.mp3") back to this pack's own trackNo/title, so a measurement means
 * something ("T1 is 3:42") instead of being an anonymous file. Pure string
 * logic, no browser API — fully unit-testable.
 */

export interface AudioMatchCandidate {
  trackNo: number;
  title: string;
}

export type AudioMatchMethod = 'trackNo' | 'title' | 'none';

export interface AudioMatchResult {
  fileName: string;
  trackNo?: number;
  matchMethod: AudioMatchMethod;
  /** "(1)"/"(2)" duplicate-take suffix, if the filename had one — e.g. Suno's own "generate 2 versions from one prompt" habit. */
  versionSuffix?: string;
}

const EXTENSION_PATTERN = /\.(mp3|wav|m4a|flac|ogg)$/i;
/** "(1)", "(2)", ... right before the extension — Suno's duplicate-take naming. */
const VERSION_SUFFIX_PATTERN = /\s*\((\d+)\)$/;
/** A leading track number: "01 ", "12.", "01_", "01-" — 1-3 digits then a separator. */
const LEADING_NUMBER_PATTERN = /^\s*0*(\d{1,3})[\s._-]+/;

function stripExtension(fileName: string): string {
  return fileName.replace(EXTENSION_PATTERN, '');
}

/** Strips a trailing "(N)" duplicate-take marker, returning the base name and the marker (if any) separately. */
export function parseVersionSuffix(fileNameNoExt: string): { baseName: string; versionSuffix?: string } {
  const match = fileNameNoExt.match(VERSION_SUFFIX_PATTERN);
  if (!match) return { baseName: fileNameNoExt };
  return { baseName: fileNameNoExt.slice(0, match.index).trimEnd(), versionSuffix: match[0].trim() };
}

/** The leading track number in a filename ("01 Two Sugars" -> 1), or null if there isn't one. */
export function parseLeadingTrackNumber(fileNameNoExt: string): number | null {
  const match = fileNameNoExt.match(LEADING_NUMBER_PATTERN);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Lowercase, trim, collapse internal whitespace — for title comparison only (never used for display). */
export function normalizeTitleForMatch(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * 1st: leading track number. 2nd: normalized title match against a
 * candidate list. 3rd: no match — the caller shows a manual-assign UI
 * instead of treating this as an error (TASK B's own "둘 다 실패하면
 * 사용자에게 수동 지정 UI").
 */
export function matchAudioFileName(fileName: string, candidates: readonly AudioMatchCandidate[]): AudioMatchResult {
  const noExt = stripExtension(fileName);
  const { baseName, versionSuffix } = parseVersionSuffix(noExt);

  const leadingNumber = parseLeadingTrackNumber(baseName);
  if (leadingNumber !== null && candidates.some(c => c.trackNo === leadingNumber)) {
    return { fileName, trackNo: leadingNumber, matchMethod: 'trackNo', versionSuffix };
  }

  // Title match: strip a leading track-number prefix (if any) before comparing, so
  // "01 Two Sugars" still matches title "Two Sugars" even when the number itself
  // didn't resolve to a real trackNo (e.g. the pack was regenerated with fewer songs).
  const titleOnly = leadingNumber !== null ? baseName.replace(LEADING_NUMBER_PATTERN, '') : baseName;
  const normalized = normalizeTitleForMatch(titleOnly);
  const titleMatch = candidates.find(c => normalizeTitleForMatch(c.title) === normalized);
  if (titleMatch) return { fileName, trackNo: titleMatch.trackNo, matchMethod: 'title', versionSuffix };

  return { fileName, matchMethod: 'none', versionSuffix };
}

export function matchAudioFiles(fileNames: readonly string[], candidates: readonly AudioMatchCandidate[]): AudioMatchResult[] {
  return fileNames.map(fileName => matchAudioFileName(fileName, candidates));
}

/** trackNos with no matched file at all — "미생성", never an error (TASK B's own "누락된 트랙은 미생성으로 표시하고 오류로 처리하지 마십시오"). */
export function missingTrackNumbers(matches: readonly AudioMatchResult[], candidates: readonly AudioMatchCandidate[]): number[] {
  const matched = new Set(matches.filter(m => m.trackNo !== undefined).map(m => m.trackNo));
  return candidates.map(c => c.trackNo).filter(trackNo => !matched.has(trackNo)).sort((a, b) => a - b);
}

/** Groups matches by trackNo — a trackNo with 2+ entries means multiple takes were uploaded for it (Suno's "generate 2 versions" habit); the caller lets the user pick which one to keep. */
export function groupMatchesByTrackNo(matches: readonly AudioMatchResult[]): Map<number, AudioMatchResult[]> {
  const groups = new Map<number, AudioMatchResult[]>();
  for (const match of matches) {
    if (match.trackNo === undefined) continue;
    const existing = groups.get(match.trackNo);
    if (existing) existing.push(match);
    else groups.set(match.trackNo, [match]);
  }
  return groups;
}
