import type { IntroMode } from '../types';

/**
 * codex 지시문 03 (TASK E) — real gap confirmed by investigation: nothing in
 * this codebase parses raw `lyrics: string` into a real section tree today.
 * Every existing consumer (core/lyricMetrics.ts's stripLyricsToBody,
 * core/srtExport.ts's extractLyricSungLines, core/lyricLineLedger.ts's
 * extractQualifyingLines, core/batchPreallocation.ts's
 * `.includes(STRUCTURE_TEMPLATE_MARKER_TAG)` check) independently re-splits
 * on `\n` and matches `[...]` via near-identical regexes, discarding or
 * flattening the tag's own identity rather than classifying it. This is the
 * first real `LyricsSection[]` builder — a genuinely useful new capability
 * TASK F's section-aware repetition check and this task's own structural
 * checks below both build on.
 *
 * Real tag vocabulary this classifier is calibrated against (see
 * core/lyricEngine.ts's own SECTION_LABELS / core/kidsLyricEngine.ts):
 * `[short intro]`, `[verse 1]`, `[pre-chorus]`, `[chorus]`, `[verse 2]`,
 * `[short bridge]`, `[final chorus]`, `[end]`, plus real production-note
 * variants seen elsewhere this session ("key-lift final chorus",
 * "instrumental hook", "call and response", "breakdown"). Deliberately
 * keyword-matching on the raw tag text (not a fixed lookup table) since
 * real tags carry production adjectives ("short", "key-lift") the fixed
 * label sets above don't enumerate.
 */

export type LyricsSectionType =
  | 'intro'
  | 'verse'
  | 'pre-chorus'
  | 'chorus'
  | 'post-chorus'
  | 'bridge'
  | 'rap'
  | 'breakdown'
  | 'instrumental'
  | 'final-chorus'
  | 'outro'
  | 'other';

export interface LyricsSection {
  rawTag: string;
  type: LyricsSectionType;
  vocalist?: string;
  lines: string[];
}

/** Same standalone leading meta-tag line lyricMetrics.ts's own VOCAL_META_TAG_LINE recognizes (e.g. `[male vocal]` before any real section) — structure, not a section, and not lyric content either. */
const VOCAL_META_TAG_LINE = /^\[(male vocal|female vocal|children'?s choir|duet vocal|group vocal|mixed vocal)\]$/i;
const SECTION_TAG_LINE = /^\[([^\]]*)\]$/;
const TITLE_LINE = /^title\s*:/i;

function classifySectionType(rawTag: string): LyricsSectionType {
  const t = rawTag.toLowerCase();
  if (t.includes('final') && t.includes('chorus')) return 'final-chorus';
  if (t.includes('pre-chorus') || t.includes('pre chorus') || t.includes('prechorus')) return 'pre-chorus';
  if (t.includes('post-chorus') || t.includes('post chorus') || t.includes('postchorus')) return 'post-chorus';
  if (t.includes('chorus')) return 'chorus';
  if (t.includes('bridge')) return 'bridge';
  if (t.includes('rap')) return 'rap';
  if (t.includes('breakdown')) return 'breakdown';
  if (t.includes('instrumental')) return 'instrumental';
  if (t.includes('intro')) return 'intro';
  if (t.includes('outro') || t === 'end' || t.startsWith('end')) return 'outro';
  if (t.includes('verse')) return 'verse';
  return 'other';
}

/** A tag like "verse 1: male vocal" or "Bridge: C solo" carries the vocalist/part assignment after its own colon — real shape confirmed by core/idolPartPattern.ts's own mapKo templates and core/vocalPlan.ts's applyDuetSectionVocalTags output. */
function extractVocalist(rawTag: string): string | undefined {
  const colonIndex = rawTag.indexOf(':');
  if (colonIndex === -1) return undefined;
  const vocalist = rawTag.slice(colonIndex + 1).trim();
  return vocalist || undefined;
}

/**
 * Splits raw Suno-tagged lyrics into a real section tree. Lines before the
 * first real section tag (after skipping a leading vocal-meta-tag line and
 * a `Title:` line, matching srtExport.ts's own precedent for what to skip)
 * are collected under a synthetic leading 'other' section with rawTag ''
 * only if non-empty — most real lyrics start with a tag, so this is rare.
 */
export function parseLyricsSections(lyrics: string): LyricsSection[] {
  const sections: LyricsSection[] = [];
  let current: LyricsSection | null = null;
  const rawLines = (lyrics ?? '').split('\n');

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (VOCAL_META_TAG_LINE.test(line)) continue;
    if (TITLE_LINE.test(line)) continue;
    const tagMatch = line.match(SECTION_TAG_LINE);
    if (tagMatch) {
      const rawTag = tagMatch[1].trim();
      current = { rawTag, type: classifySectionType(rawTag), vocalist: extractVocalist(rawTag), lines: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { rawTag: '', type: 'other', lines: [] };
      sections.push(current);
    }
    current.lines.push(line);
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Structural checks
// ---------------------------------------------------------------------------

function isEffectivelyEmpty(section: LyricsSection): boolean {
  return section.lines.every(line => !line.trim());
}

/**
 * A `[bridge]`/`[short bridge]` tag with zero lines under it — a real,
 * checkable structural defect (an agent wrote the section marker but never
 * actually wrote the section). Instrumental sections are exempt by design
 * (see instrumentalSectionsAllowedEmpty below) — a bridge is never expected
 * to be a pure instrumental break the way an [instrumental]/[breakdown] tag
 * can legitimately be.
 */
export function findEmptyBridge(sections: LyricsSection[]): LyricsSection[] {
  return sections.filter(s => s.type === 'bridge' && isEffectivelyEmpty(s));
}

/** Instrumental sections are the one type allowed to have zero lines by design — never flagged as "empty" by any check in this module. */
export function instrumentalSectionsAllowedEmpty(sections: LyricsSection[]): LyricsSection[] {
  return sections.filter(s => s.type === 'instrumental');
}

/**
 * `introMode: 'vocal-immediate'`/`'vocal-after-texture'` both mean a sung
 * line is expected at/near the intro (see types.ts's own IntroMode doc
 * comment) — an `[intro]`-typed section with zero lines under either of
 * those modes means the expected cold-open/early vocal never got written.
 * `'instrumental'` mode is the one case an empty intro is CORRECT (no sung
 * line should appear there at all) — never flagged.
 */
export function coldVocalIntroEmptyWarning(sections: LyricsSection[], introMode: IntroMode | undefined): string | undefined {
  if (introMode !== 'vocal-immediate' && introMode !== 'vocal-after-texture') return undefined;
  const introSection = sections.find(s => s.type === 'intro');
  if (!introSection || !isEffectivelyEmpty(introSection)) return undefined;
  return `introMode is '${introMode}' (a sung line is expected at the intro) but the [${introSection.rawTag}] section has no lines.`;
}

const REQUIRED_SECTION_TYPES: LyricsSectionType[] = ['verse', 'chorus'];

/** Every real song needs at least one verse and one chorus — the two section types with no legitimate "this song just doesn't have one" exemption (unlike bridge/pre-chorus/outro, which real structure templates already omit for some tracks — see core/lyricEngine.ts's STRUCTURE_TEMPLATE_SECTION_NOTES). */
export function missingRequiredSections(sections: LyricsSection[]): LyricsSectionType[] {
  const present = new Set(sections.map(s => s.type));
  return REQUIRED_SECTION_TYPES.filter(type => !present.has(type));
}

/**
 * A rap section with no vocalist assignment at all is invisible to any
 * per-member part-count/budget accounting (see core/idolPartPattern.ts's
 * own member-letter convention) — flagged as a real, checkable gap, not a
 * judgment on lyric content itself.
 */
export function rapSectionsMissingVocalist(sections: LyricsSection[]): LyricsSection[] {
  return sections.filter(s => s.type === 'rap' && !s.vocalist);
}

/**
 * A real duet needs at least 2 DIFFERENT vocalist values across its own
 * sections (mirrors core/vocalPlan.ts's applyDuetSectionVocalTags — real
 * duet tags alternate "male vocal"/"female vocal"/"male and female duet",
 * never one single assignment repeated everywhere). A song whose sections
 * all carry the identical vocalist string (or none at all) never actually
 * distributes the duet the way the vocalGender: 'duet' resolution promised.
 */
export function duetPartDistributionIssue(sections: LyricsSection[], vocalGender: string | undefined): string | undefined {
  if (vocalGender !== 'duet') return undefined;
  const vocalists = new Set(sections.map(s => s.vocalist).filter((v): v is string => Boolean(v)));
  if (vocalists.size >= 2) return undefined;
  return vocalists.size === 0
    ? 'vocalGender is \'duet\' but no section carries a vocalist assignment at all — the two voices are never actually distributed.'
    : `vocalGender is 'duet' but every section shares the same vocalist ("${[...vocalists][0]}") — the two voices are never actually distributed.`;
}
