import { kpopWorkspacePolicyFor, type KpopSongRole } from './kpopWorkspacePolicy';
import type { TextMotifSong } from './textMotifQuota';
import {
  checkKpopFixedQuotaFidelity,
  checkKpopLanguageRole,
  checkKpopMotifQuotas,
  checkKpopRapShare,
  findConsecutiveLeadTypeRuns,
  checkKpopChantOveruse,
  type KpopQuotaFidelityFinding
} from './kpopSharedChecks';
import type { VocalType } from './vocalPlan';

/**
 * codex 지시문 04 (§6) — kr-idol-male's own thin instantiation of the
 * shared K-pop engine (core/kpopSharedChecks.ts) against its own real
 * policy data (core/kpopWorkspacePolicy.ts's KR_IDOL_MALE_MOTIF_QUOTAS /
 * KR_IDOL_MALE_FIXED_QUOTA). No male-only logic lives in this file —
 * everything here is a direct pass-through to the shared engine with this
 * workspace's own policy bound in.
 */
export const KR_IDOL_MALE_POLICY = kpopWorkspacePolicyFor('kr-idol-male')!;

export function checkKrIdolMaleFixedQuota(counts: Partial<Record<VocalType, number>>, songCount: number): KpopQuotaFidelityFinding[] {
  return checkKpopFixedQuotaFidelity(counts, KR_IDOL_MALE_POLICY, songCount);
}

export function checkKrIdolMaleLanguageRole(lyrics: string, role: KpopSongRole) {
  return checkKpopLanguageRole(lyrics, role, KR_IDOL_MALE_POLICY);
}

export function checkKrIdolMaleMotifQuotas(songs: TextMotifSong[]) {
  return checkKpopMotifQuotas(songs, KR_IDOL_MALE_POLICY);
}

export function checkKrIdolMaleRapShare(plans: readonly { hasRapSection: boolean }[]) {
  return checkKpopRapShare(plans, KR_IDOL_MALE_POLICY);
}

export function findKrIdolMaleConsecutiveLeadRuns(leadTypes: readonly string[], maxConsecutive = 2) {
  return findConsecutiveLeadTypeRuns(leadTypes, maxConsecutive);
}

export function checkKrIdolMaleChantOveruse(songs: readonly { trackNo: number; lyrics: string }[]) {
  return checkKpopChantOveruse(songs, KR_IDOL_MALE_POLICY);
}
