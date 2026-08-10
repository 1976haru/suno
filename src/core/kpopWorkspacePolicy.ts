import type { WorkspaceId } from '../types';
import type { VocalQuota } from './vocalPlan';
import type { TextMotifFamily } from './textMotifQuota';

/**
 * codex 지시문 04 (§8) — real, source-mapped aggregation over already-real
 * K-pop-specific mechanisms found by investigation, following the exact
 * same "aggregation registry, not a rewrite" pattern as
 * data/workspaceQualityPolicies.ts (지시문 02 TASK A):
 *  - fixedVocalQuota: the real ChannelProfile.vocalQuotaOverride shape
 *    (core/vocalPlan.ts's VocalQuota) already consumed by
 *    core/designGate.ts's quotaFidelityIssues and
 *    core/compositionScorer.ts's fixedQuotaChannel branch.
 *  - allowedPartTypes: the real vocabulary core/idolPartPattern.ts's own
 *    10 fixed mapKo templates already use (solo/duet/all/rap/ad-lib), now
 *    named as a real type instead of only ever appearing inside literal
 *    template strings.
 *  - rapPolicy: seeded from core/idolPartPlan.ts's real
 *    RAP_SECTION_TARGET_RATIO (12/18).
 *  - motifQuotas: core/textMotifQuota.ts's new TextMotifFamily engine
 *    (confirmed by investigation: none of this task's named word groups —
 *    fire/crown/run/mirror/night/spotlight; queen/diamond/shine/mirror/
 *    fire/runway — map onto data/motifFamilies.ts's frameId-based model).
 *  - languageProfiles: per-KpopSongRole Hangul-ratio floors, seeded from
 *    core/lyricMetrics.ts's real koreanHangulRatioMinForArchetype (0.45
 *    for kr-idol today, flat per-archetype) — widened here into a REAL
 *    per-role table since no per-role language policy existed before this
 *    (confirmed absent by investigation).
 *  - chantPolicy/performancePolicy: genuinely new fields (confirmed no
 *    prior art) — kept deliberately simple/documented rather than
 *    over-built ahead of real usage data.
 *
 * "killing point는 K-pop 전용 하드코딩이 아니라 AudienceProfile/
 * WorkspaceQualityPolicy에서 가져온다" — investigation confirmed there is
 * NO K-pop-specific killing-point hardcode to remove (data/killingPoints.ts
 * has zero idol/kpop branching; KR_IDOL_MALE_AUDIENCE_PROFILE/
 * KR_IDOL_FEMALE_AUDIENCE_PROFILE already carry their own
 * `killingPointSetId`). This requirement is already satisfied — the real,
 * separate, PRE-EXISTING gap (no per-workspace killing-point SET yet
 * exists for any non-senior workspace) was a larger, not-idol-specific
 * limitation out of this task's own scope, left honestly undone here rather
 * than papered over with a fake per-workspace set. 지시문 30 TASK C closed
 * that gap for kr-idol-male/kr-idol-female (data/killingPointsKpop.ts, via
 * data/killingPointWorkspaceSets.ts) — verified:false, genre-convention
 * judgment calls, not a listening-verified set.
 *
 * "fixed quota 경고도 quota-aware 방식으로 바꾼다" — real bug found and
 * fixed by this task (see core/compositionScorer.ts's own updated comment
 * at vocalZoneDistributionWarnings' call site): that check used to fire
 * its generic same-type-overuse advisory unconditionally, even for a
 * legitimate 15-male/0-female/3-mixed fixed-quota pack, where a heavy
 * same-type share is the ENTIRE POINT of the quota, not a defect.
 */

export type KpopPartType = 'solo' | 'duet' | 'all' | 'rap' | 'ad-lib';

export type KpopSongRole = 'vocal-track' | 'rap-heavy' | 'performance' | 'bilingual-hook';

export interface LanguageRatioPolicy {
  minHangulRatio: number;
}

export interface MotifQuota extends TextMotifFamily {}

export interface RapPolicy {
  /** Fraction of the pack expected to carry a real rap section — seeded from core/idolPartPlan.ts's own RAP_SECTION_TARGET_RATIO. */
  targetRatio: number;
}

export interface ChantPolicy {
  /** Fraction of the pack past which the SAME chant/post-chorus device is considered overused. */
  maxOveruseRatio: number;
}

export interface PerformancePolicy {
  /** data/motifFamilies.ts family id this workspace's own real performance/stage vocabulary lives under (see that registry's own 'performance-stage' entry, workspace-scoped to kr-idol-male/kr-idol-female already). */
  motifFamilyId: string;
}

export interface KpopWorkspacePolicy {
  groupGender: 'male' | 'female';
  fixedVocalQuota?: VocalQuota;
  allowedPartTypes: KpopPartType[];
  languageProfiles: Record<KpopSongRole, LanguageRatioPolicy>;
  motifQuotas: MotifQuota[];
  rapPolicy: RapPolicy;
  chantPolicy: ChantPolicy;
  performancePolicy: PerformancePolicy;
  /**
   * 지시문 37 (TASK A-2) — 실제 아이돌 그룹 규모(4~7명), 하루의 장르 지식에
   * 근거한 관행이지 추정치가 아니다. core/kpopPartPlan.ts's
   * buildKpopPartPlan이 이 범위 안에서 트랙별 멤버 수를 결정한다.
   */
  memberCountRange: [number, number];
}

const DEFAULT_ALLOWED_PART_TYPES: KpopPartType[] = ['solo', 'duet', 'all', 'rap', 'ad-lib'];

/**
 * Real per-role language floors: 'vocal-track' keeps the existing real
 * 0.45 archetype floor (koreanHangulRatioMinForArchetype's own kr-idol
 * number); 'rap-heavy'/'bilingual-hook' get a real, honestly LOWER floor
 * (rap verses and bilingual hooks legitimately lean English-heavier — this
 * task's own explicit "영어 비중이 높아도 한국어 핵심 정서와 title/hook
 * 연결이 있으면 통과 가능" ask); 'performance' (mostly instrumental/chant
 * cues around the vocal) keeps the same 0.45 floor as a plain vocal track.
 */
const DEFAULT_LANGUAGE_PROFILES: Record<KpopSongRole, LanguageRatioPolicy> = {
  'vocal-track': { minHangulRatio: 0.45 },
  'rap-heavy': { minHangulRatio: 0.3 },
  performance: { minHangulRatio: 0.45 },
  'bilingual-hook': { minHangulRatio: 0.25 }
};

const KR_IDOL_MALE_MOTIF_QUOTAS: MotifQuota[] = [
  { id: 'fire-rise', labelKo: 'fire/rise', patterns: [/\bfire\b/i, /\brise[sn]?\b/i, /\brising\b/i], maxPerPack: 3 },
  { id: 'crown-throne', labelKo: 'crown/throne', patterns: [/\bcrown\b/i, /\bthrone\b/i], maxPerPack: 2 },
  { id: 'run-fly', labelKo: 'run/fly', patterns: [/\brun(ning)?\b/i, /\bfly(ing)?\b/i], maxPerPack: 3 },
  { id: 'mirror', labelKo: 'mirror', patterns: [/\bmirror(s)?\b/i], maxPerPack: 2 },
  { id: 'night-neon', labelKo: 'night/neon', patterns: [/\bneon\b/i, /\bnight\b/i], maxPerPack: 4 },
  { id: 'spotlight-stage', labelKo: 'spotlight/stage', patterns: [/\bspotlight\b/i, /\bstage\b/i], maxPerPack: 3 }
];

const KR_IDOL_FEMALE_MOTIF_QUOTAS: MotifQuota[] = [
  { id: 'queen', labelKo: 'queen', patterns: [/\bqueen(s)?\b/i], maxPerPack: 2 },
  { id: 'diamond', labelKo: 'diamond', patterns: [/\bdiamond(s)?\b/i], maxPerPack: 2 },
  { id: 'shine', labelKo: 'shine', patterns: [/\bshin(e|ing|es)\b/i], maxPerPack: 3 },
  { id: 'mirror', labelKo: 'mirror', patterns: [/\bmirror(s)?\b/i], maxPerPack: 2 },
  { id: 'fire', labelKo: 'fire', patterns: [/\bfire\b/i], maxPerPack: 3 },
  { id: 'runway', labelKo: 'runway', patterns: [/\brunway(s)?\b/i], maxPerPack: 2 }
];

/**
 * codex 지시문 04 (§8) — real gap: this field existed on the interface but
 * was left unset. data/presets.ts's own real channel presets confirm every
 * single kr-idol-male preset sets the identical `{ male: 15, female: 0,
 * mixed: 3 }` override, and every kr-idol-female preset the symmetric
 * `{ male: 0, female: 15, mixed: 3 }` — this is the workspace's own real,
 * consistent default, not a per-channel variation, so it belongs here as
 * the workspace policy's own real fixedVocalQuota.
 */
const KR_IDOL_MALE_FIXED_QUOTA: VocalQuota = { male: 15, female: 0, mixed: 3 };
const KR_IDOL_FEMALE_FIXED_QUOTA: VocalQuota = { male: 0, female: 15, mixed: 3 };

export const KPOP_WORKSPACE_POLICIES: Partial<Record<WorkspaceId, KpopWorkspacePolicy>> = {
  'kr-idol-male': {
    groupGender: 'male',
    fixedVocalQuota: KR_IDOL_MALE_FIXED_QUOTA,
    allowedPartTypes: DEFAULT_ALLOWED_PART_TYPES,
    languageProfiles: DEFAULT_LANGUAGE_PROFILES,
    motifQuotas: KR_IDOL_MALE_MOTIF_QUOTAS,
    rapPolicy: { targetRatio: 12 / 18 },
    chantPolicy: { maxOveruseRatio: 0.4 },
    performancePolicy: { motifFamilyId: 'performance-stage' },
    memberCountRange: [4, 7]
  },
  'kr-idol-female': {
    groupGender: 'female',
    fixedVocalQuota: KR_IDOL_FEMALE_FIXED_QUOTA,
    allowedPartTypes: DEFAULT_ALLOWED_PART_TYPES,
    languageProfiles: DEFAULT_LANGUAGE_PROFILES,
    motifQuotas: KR_IDOL_FEMALE_MOTIF_QUOTAS,
    rapPolicy: { targetRatio: 12 / 18 },
    chantPolicy: { maxOveruseRatio: 0.4 },
    performancePolicy: { motifFamilyId: 'performance-stage' },
    memberCountRange: [4, 7]
  }
};

export function kpopWorkspacePolicyFor(workspaceId: WorkspaceId): KpopWorkspacePolicy | undefined {
  return KPOP_WORKSPACE_POLICIES[workspaceId];
}
