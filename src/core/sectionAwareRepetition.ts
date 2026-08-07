import type { LyricsSection, LyricsSectionType } from './lyricsAst';
import { KIDS_AGE_TIERS, DEFAULT_KIDS_AGE_TIER_ID, type KidsAgeTierId } from '../data/kidsAgeTiers';

/**
 * codex 지시문 03 (TASK F) — real gap confirmed by investigation: no
 * section-aware repetition check exists anywhere today. The only existing
 * repetition-related logic is either pack-WIDE word-frequency counting
 * (core/lyricVocabularyRepetition.ts — counts individual words across an
 * entire pack, not sentences within one song) or CROSS-song line collision
 * (core/lyricLineLedger.ts/duplicationGate.ts — a different song than
 * this one, a different problem). Nothing compares two SECTIONS within the
 * SAME song, and nothing distinguishes "chorus repeated verbatim" (by
 * design — every real Suno song does this) from "verse/bridge repeated
 * verbatim" (a real defect — an agent copy-pasted instead of writing a
 * second verse).
 */

const CHORUS_FAMILY: ReadonlySet<LyricsSectionType> = new Set(['chorus', 'final-chorus', 'post-chorus']);

/** Same window-size sliding-match technique as core/lyricMetrics.ts's own verbatimSceneCopyWarning (codex 지시문 02 TASK D) — proven pattern for "does a real N-word run repeat verbatim," reused here for a different pair of texts (two lyric sections, not a scene description vs. lyrics). */
const NEAR_DUPLICATE_WINDOW_WORDS = 6;
const NEAR_DUPLICATE_MIN_WORDS = 6;

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function sectionText(section: LyricsSection): string {
  return section.lines.join(' ');
}

function shareVerbatimRun(a: string, b: string, windowSize = NEAR_DUPLICATE_WINDOW_WORDS): string | undefined {
  const wordsA = normalize(a).split(' ').filter(Boolean);
  const wordsB = normalize(b).split(' ').filter(Boolean);
  if (wordsA.length < NEAR_DUPLICATE_MIN_WORDS || wordsB.length < NEAR_DUPLICATE_MIN_WORDS) return undefined;
  const size = Math.min(windowSize, wordsA.length);
  const setB = normalize(b);
  for (let i = 0; i + size <= wordsA.length; i++) {
    const window = wordsA.slice(i, i + size).join(' ');
    if (setB.includes(window)) return window;
  }
  return undefined;
}

export interface SectionRepetitionFinding {
  kind: 'long-text-copy' | 'excess-line-repeat';
  sectionsInvolved: { rawTag: string; type: LyricsSectionType }[];
  detail: string;
}

/**
 * BLOCK — Verse↔Verse / Bridge↔Verse (or any two DIFFERENT non-chorus
 * sections) sharing a real 6+ word verbatim run. Chorus-family sections
 * (chorus/final-chorus/post-chorus) are explicitly exempt — repeating the
 * chorus verbatim 2-4 times is this app's own by-design convention (see
 * core/lyricLineLedger.ts's own doc comment excluding hookPhrase from its
 * cross-pack ledger for the identical reason, one level up).
 *
 * Two sections sharing the IDENTICAL raw tag (e.g. two separate
 * `[call and response]` instances in the same song) are also exempt — a
 * repeated section TAG is itself the real signal that the content is meant
 * to recur (this task's own explicit "call-and-response"/"K-pop post-chorus
 * chant" allow-list items are exactly this shape, real-measured on a kids
 * fixture during this task's own test run), as opposed to two DIFFERENTLY
 * -tagged sections (e.g. `[verse 1]` vs `[short bridge]`) sharing text,
 * which is the actual copy-paste defect this check exists to catch.
 */
export function findLongTextCopyAcrossSections(sections: LyricsSection[]): SectionRepetitionFinding[] {
  const nonChorus = sections.filter(s => !CHORUS_FAMILY.has(s.type));
  const findings: SectionRepetitionFinding[] = [];
  for (let i = 0; i < nonChorus.length; i++) {
    for (let j = i + 1; j < nonChorus.length; j++) {
      const a = nonChorus[i];
      const b = nonChorus[j];
      if (a.rawTag.toLowerCase() === b.rawTag.toLowerCase()) continue;
      const match = shareVerbatimRun(sectionText(a), sectionText(b));
      if (match) {
        findings.push({
          kind: 'long-text-copy',
          sectionsInvolved: [{ rawTag: a.rawTag, type: a.type }, { rawTag: b.rawTag, type: b.type }],
          detail: `[${a.rawTag}] and [${b.rawTag}] share a near-verbatim run: "${match}"`
        });
      }
    }
  }
  return findings;
}

/**
 * kids workspaces legitimately repeat an instructional/educational line
 * MORE than a default pack tolerates (call-and-response, counting songs) —
 * reuses data/kidsAgeTiers.ts's own real minHookRepeats (6/5/4 for
 * T1/T2/T3 — younger tiers get MORE, not less) as the allowed-repetition
 * ceiling, rather than inventing a new number. Every other workspace uses
 * this task's own literal "3개 이상" default.
 */
export function maxNonChorusLineRepeatsAllowed(kidsAgeTierId?: KidsAgeTierId): number {
  if (!kidsAgeTierId) return 2;
  return (KIDS_AGE_TIERS[kidsAgeTierId] ?? KIDS_AGE_TIERS[DEFAULT_KIDS_AGE_TIER_ID]).minHookRepeats ?? 2;
}

/**
 * BLOCK — the identical sentence appearing 3+ times ACROSS DIFFERENT
 * non-chorus SECTION TAGS (kids gets a real, per-age-tier-higher ceiling —
 * see maxNonChorusLineRepeatsAllowed above). A line repeated multiple times
 * WITHIN its own single section (a chant, a call-and-response couplet), or
 * across multiple INSTANCES of the same recurring tag (e.g. two separate
 * `[call and response]` sections — the same real device
 * findLongTextCopyAcrossSections's own doc comment exempts, one level up),
 * is never flagged here — only spread across genuinely DIFFERENT structural
 * roles counts, since that's the real "this reads like the same line got
 * pasted everywhere" defect this task's own spec names, not a legitimate
 * repetition device.
 */
export function findExcessNonChorusLineRepeats(sections: LyricsSection[], kidsAgeTierId?: KidsAgeTierId): SectionRepetitionFinding[] {
  const limit = maxNonChorusLineRepeatsAllowed(kidsAgeTierId);
  const nonChorus = sections.filter(s => !CHORUS_FAMILY.has(s.type));
  const sectionsByLine = new Map<string, LyricsSection[]>();
  for (const section of nonChorus) {
    const seenInThisSection = new Set<string>();
    for (const line of section.lines) {
      const key = normalize(line);
      if (!key || key.split(' ').length < 3) continue; // short fragments/ad-libs aren't a real "sentence" to track
      if (seenInThisSection.has(key)) continue; // only count each section once per distinct line
      seenInThisSection.add(key);
      const existing = sectionsByLine.get(key) ?? [];
      // Same recurring tag as an already-counted section for this line -> presumed the same intentional device, not a new spread.
      if (existing.some(s => s.rawTag.toLowerCase() === section.rawTag.toLowerCase())) continue;
      sectionsByLine.set(key, [...existing, section]);
    }
  }
  const findings: SectionRepetitionFinding[] = [];
  for (const [line, involvedSections] of sectionsByLine) {
    if (involvedSections.length > limit) {
      findings.push({
        kind: 'excess-line-repeat',
        sectionsInvolved: involvedSections.map(s => ({ rawTag: s.rawTag, type: s.type })),
        detail: `"${line}" appears in ${involvedSections.length} different non-chorus sections (limit ${limit}): ${involvedSections.map(s => `[${s.rawTag}]`).join(', ')}`
      });
    }
  }
  return findings;
}

export function checkSectionAwareRepetition(sections: LyricsSection[], kidsAgeTierId?: KidsAgeTierId): SectionRepetitionFinding[] {
  return [...findLongTextCopyAcrossSections(sections), ...findExcessNonChorusLineRepeats(sections, kidsAgeTierId)];
}
