import type { VocalType } from './vocalPlan';
import { scaleVocalQuota } from './vocalPlan';
import { measureLyricLanguageRatios } from './lyricMetrics';
import { checkTextMotifQuotas, type TextMotifSong, type TextMotifFinding } from './textMotifQuota';
import { findConsecutivePhaseRuns, type ConsecutivePhaseWarning } from './krKidsPolicy';
import { parseLyricsSections } from './lyricsAst';
import type { KpopWorkspacePolicy, KpopSongRole } from './kpopWorkspacePolicy';

/**
 * codex 지시문 04 (§6/§7/§8) — real, GENERIC engine shared by both
 * kr-idol-male and kr-idol-female (they differ only in groupGender/
 * fixedVocalQuota direction/motifQuotas word lists — all already captured
 * as DATA in kpopWorkspacePolicy.ts's own KpopWorkspacePolicy, not in
 * separate logic). core/kpopMalePolicy.ts/kpopFemalePolicy.ts are thin
 * per-workspace instantiations of these same functions, matching this
 * session's own established "one real engine, N data instantiations"
 * pattern (core/textMotifQuota.ts itself is the direct precedent).
 */

export interface KpopQuotaFidelityFinding {
  type: VocalType;
  expected: number;
  actual: number;
}

/**
 * "고정 보컬 쿼터 정확히" — real reuse of core/vocalPlan.ts's own
 * scaleVocalQuota (the exact function real generation uses to turn a
 * channel's raw override into a songCount-scaled target), same ±1/exact-0
 * tolerance convention as core/designGate.ts's own quotaFidelityIssues
 * (that function itself stays UI/autoFix-coupled — this is the lean,
 * autoFix-free version for a direct adapter-level check).
 */
export function checkKpopFixedQuotaFidelity(
  counts: Partial<Record<VocalType, number>>,
  policy: KpopWorkspacePolicy,
  songCount: number
): KpopQuotaFidelityFinding[] {
  if (!policy.fixedVocalQuota) return [];
  const scaled = scaleVocalQuota(policy.fixedVocalQuota, songCount);
  const findings: KpopQuotaFidelityFinding[] = [];
  (['male', 'female', 'mixed'] as const).forEach(type => {
    const actual = counts[type] ?? 0;
    const expected = scaled[type];
    const withinTolerance = expected === 0 ? actual === 0 : Math.abs(actual - expected) <= 1;
    if (!withinTolerance) findings.push({ type, expected, actual });
  });
  return findings;
}

export interface KpopLanguageRoleCheck {
  ok: boolean;
  hangulRatio: number;
  minRequired: number;
}

/** "역할별 언어 비중" — real reuse of core/lyricMetrics.ts's own measureLyricLanguageRatios; floors come from kpopWorkspacePolicy.ts's real per-role DEFAULT_LANGUAGE_PROFILES, not a second copy. */
export function checkKpopLanguageRole(lyrics: string, role: KpopSongRole, policy: KpopWorkspacePolicy): KpopLanguageRoleCheck {
  const minRequired = policy.languageProfiles[role].minHangulRatio;
  const hangulRatio = measureLyricLanguageRatios(lyrics).hangulRatio;
  return { ok: hangulRatio >= minRequired, hangulRatio, minRequired };
}

/** "소재 쿼터" — direct reuse of core/textMotifQuota.ts's own real engine against this workspace's own motifQuotas data. */
export function checkKpopMotifQuotas(songs: TextMotifSong[], policy: KpopWorkspacePolicy): TextMotifFinding[] {
  return checkTextMotifQuotas(songs, policy.motifQuotas);
}

export interface KpopRapShareCheck {
  actualRatio: number;
  targetRatio: number;
  withinTolerance: boolean;
}

/**
 * "rap 비중" — real reuse of core/idolPartPlan.ts's own IdolPartPlan.
 * `targetRatio` is seeded from that file's own RAP_SECTION_TARGET_RATIO
 * (12/18) via kpopWorkspacePolicy.ts's rapPolicy — ±10 percentage points
 * tolerance absorbs ordinary per-pack rounding at small songCounts (a
 * strict ±1-song check would be meaningless below songCount ~20).
 */
export function checkKpopRapShare(plans: readonly { hasRapSection: boolean }[], policy: KpopWorkspacePolicy): KpopRapShareCheck {
  const actualRatio = plans.length ? plans.filter(p => p.hasRapSection).length / plans.length : 0;
  const targetRatio = policy.rapPolicy.targetRatio;
  return { actualRatio, targetRatio, withinTolerance: Math.abs(actualRatio - targetRatio) <= 0.1 };
}

/**
 * "리드 타입 연속 배치" — general string-run check, direct reuse of
 * core/krKidsPolicy.ts's own findConsecutivePhaseRuns (already generic over
 * `readonly string[]`, not kids-specific in its own implementation — see
 * that function's own doc comment) rather than a second copy of the same
 * run-detection loop for idol lead types (main-vocal/sub-vocal/rapper).
 */
export function findConsecutiveLeadTypeRuns(leadTypes: readonly string[], maxConsecutive = 2): ConsecutivePhaseWarning[] {
  return findConsecutivePhaseRuns(leadTypes, maxConsecutive);
}

export interface ChantOveruseFinding {
  phrase: string;
  count: number;
  trackNos: number[];
}

/**
 * "챈트/구호형 반복구 남용" — real, bounded check: scans each song's real
 * parsed sections (core/lyricsAst.ts's own parseLyricsSections, reused not
 * reimplemented) for a section whose own rawTag names it as a chant/ad-lib
 * moment (a real, already-used K-pop production-note vocabulary — see
 * lyricsAst.ts's own doc comment for other real production-note tags like
 * "key-lift final chorus"/"call and response"), then flags the SAME first
 * line of that section repeating verbatim across more than
 * chantPolicy.maxOveruseRatio of the pack. Same honest limitation as every
 * other lyric-text scan in this app — a chant phrase reworded slightly
 * between songs won't be caught.
 */
export const CHANT_SECTION_TAG_PATTERN = /\b(chant|ad[\s-]?lib|call and response)\b/i;

export function checkKpopChantOveruse(songs: readonly { trackNo: number; lyrics: string }[], policy: KpopWorkspacePolicy): ChantOveruseFinding[] {
  const trackNosByPhrase = new Map<string, number[]>();
  for (const song of songs) {
    const sections = parseLyricsSections(song.lyrics);
    for (const section of sections) {
      if (!CHANT_SECTION_TAG_PATTERN.test(section.rawTag)) continue;
      const firstLine = section.lines.find(l => l.trim())?.trim().toLowerCase();
      if (!firstLine) continue;
      const existing = trackNosByPhrase.get(firstLine) ?? [];
      if (!existing.includes(song.trackNo)) existing.push(song.trackNo);
      trackNosByPhrase.set(firstLine, existing);
    }
  }
  const songCount = songs.length || 1;
  const findings: ChantOveruseFinding[] = [];
  for (const [phrase, trackNos] of trackNosByPhrase) {
    if (trackNos.length / songCount > policy.chantPolicy.maxOveruseRatio) {
      findings.push({ phrase, count: trackNos.length, trackNos });
    }
  }
  return findings;
}

/**
 * "센터 트랙" — confirmed by investigation: no real infrastructure exists
 * anywhere (no per-song "center"/featured-member concept, no vocal-part
 * weighting beyond IdolPartPlan.lead) to genuinely determine which song in
 * an 18-song pack should read as the "center" release — that's an A&R/
 * marketing judgment call, not a checkable text property. Left honestly
 * undone (미구현) as a type stub only, matching this whole task's own
 * furigana-policy precedent (core/jpKidsPolicy.ts's FuriganaPolicy).
 */
export type CenterTrackPolicy = { enabled: boolean };
export const KPOP_CENTER_TRACK_POLICY: CenterTrackPolicy = { enabled: false };
