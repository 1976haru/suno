import type { PerceivedEnergy, WorkspaceId } from '../types';
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

/**
 * 지시문 43 (TASK A-3) — "체감 에너지 목표". core/perceivedEnergy.ts가 실제로
 * 계산한 song.perceivedEnergy를 이 목표와 비교하는 건 fullAudit.ts의 advisory
 * 항목뿐(§7 "실측 없이 blocking 을 만들지 않는다") — 생성 자체를 이 숫자에
 * 강제로 맞추는 새 배분 엔진은 만들지 않는다. distribution은 15곡 기준
 * (하루의 후보 표 그대로: E1 0 · E2 2 · E3 5 · E4 6 · E5 2).
 */
export interface EnergyTargetPolicy {
  targetAverage: number;
  maxEnergy: PerceivedEnergy;
  /** songCount=15 기준 분포 — advisory 비교 표시에만 쓰인다(강제 배분 아님). */
  distributionOf15: Record<PerceivedEnergy, number>;
  verified: boolean;
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
  energyTarget: EnergyTargetPolicy;
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

/**
 * 지시문 43 (TASK A-3) — verified: false, 15곡 기준 추정치. male/female 동일
 * (에너지 목표는 성별 트레이트가 아니다 — kpopWorkspacePolicy.ts 상단
 * 문서의 groupGender 분리 원칙과 같은 이유).
 *
 * 지시문 50 (TASK B-6) — 하루의 청취가 지시문43의 "E1~E2 도 2곡은 남긴다"를
 * 정정했다: 실제로는 2곡으로 부족했다. B-4가 추가한 68-104 대역 발라드
 * 2종(kridol-emotional-ballad·kridol-midtempo-rnb)이 저에너지 곡 3~4곡에
 * 대응하도록 E1 0→1·E2 2→3으로 올리고, 합계 15를 맞추기 위해 E4를 6→5로
 * 낮춘다(E3=4·E5=2는 그대로). targetAverage는 이 분포의 실제 가중평균
 * (1·1+2·3+3·4+4·5+5·2)/15=49/15≈3.27을 반올림한 3.2 — E4·E5(활기찬 쪽)는
 * 여전히 7곡으로 유지된다(§하지 말 것 "발라드를 넣는다고 에너지 정책
 * 전체를 낮추지 말 것" — 하루는 "붕 뜬 느낌"을 말했지 "잔잔하게"를
 * 말하지 않았다). verified: false — 다음 세트 청취로 재조정.
 */
const KR_IDOL_ENERGY_TARGET: EnergyTargetPolicy = {
  targetAverage: 3.2,
  maxEnergy: 5,
  distributionOf15: { 1: 1, 2: 3, 3: 4, 4: 5, 5: 2 },
  verified: false
};

export const KPOP_WORKSPACE_POLICIES: Partial<Record<WorkspaceId, KpopWorkspacePolicy>> = {
  'kr-idol-male': {
    groupGender: 'male',
    fixedVocalQuota: KR_IDOL_MALE_FIXED_QUOTA,
    allowedPartTypes: DEFAULT_ALLOWED_PART_TYPES,
    languageProfiles: DEFAULT_LANGUAGE_PROFILES,
    motifQuotas: KR_IDOL_MALE_MOTIF_QUOTAS,
    // 지시문 43 (TASK D-2) — 12/18(0.667, 지시문 35 idolPartPlan.ts 원안)에서
    // 이 지시문 자신의 15곡 기준 목표(§D-2 "랩 파트가 있는 곡 12곡 이상
    // (15곡 중)")로 갱신. kpopPartPlan.ts의 useRapper 확률이 이 값을 그대로
    // 읽어(§D-4) 배정 확률과 검사 목표(releaseReadiness.ts checkKpopRapShare)가
    // 항상 같은 값을 공유한다 — 정책값 하나만 바꾸는 원칙(§하지 말 것
    // "지시문 35의 랩 딜리버리 어휘를 다시 만들지 말 것"과 같은 결의 수정).
    rapPolicy: { targetRatio: 12 / 15 },
    chantPolicy: { maxOveruseRatio: 0.4 },
    performancePolicy: { motifFamilyId: 'performance-stage' },
    energyTarget: KR_IDOL_ENERGY_TARGET,
    memberCountRange: [4, 7]
  },
  'kr-idol-female': {
    groupGender: 'female',
    fixedVocalQuota: KR_IDOL_FEMALE_FIXED_QUOTA,
    allowedPartTypes: DEFAULT_ALLOWED_PART_TYPES,
    languageProfiles: DEFAULT_LANGUAGE_PROFILES,
    motifQuotas: KR_IDOL_FEMALE_MOTIF_QUOTAS,
    // 지시문 43 (TASK D-2) — 12/18(0.667, 지시문 35 idolPartPlan.ts 원안)에서
    // 이 지시문 자신의 15곡 기준 목표(§D-2 "랩 파트가 있는 곡 12곡 이상
    // (15곡 중)")로 갱신. kpopPartPlan.ts의 useRapper 확률이 이 값을 그대로
    // 읽어(§D-4) 배정 확률과 검사 목표(releaseReadiness.ts checkKpopRapShare)가
    // 항상 같은 값을 공유한다 — 정책값 하나만 바꾸는 원칙(§하지 말 것
    // "지시문 35의 랩 딜리버리 어휘를 다시 만들지 말 것"과 같은 결의 수정).
    rapPolicy: { targetRatio: 12 / 15 },
    chantPolicy: { maxOveruseRatio: 0.4 },
    performancePolicy: { motifFamilyId: 'performance-stage' },
    energyTarget: KR_IDOL_ENERGY_TARGET,
    memberCountRange: [4, 7]
  }
};

export function kpopWorkspacePolicyFor(workspaceId: WorkspaceId): KpopWorkspacePolicy | undefined {
  return KPOP_WORKSPACE_POLICIES[workspaceId];
}
