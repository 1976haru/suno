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
 * codex 지시문 04 (§7) — kr-idol-female's own thin instantiation of the
 * shared K-pop engine (core/kpopSharedChecks.ts) against its own real
 * policy data (core/kpopWorkspacePolicy.ts's KR_IDOL_FEMALE_MOTIF_QUOTAS /
 * KR_IDOL_FEMALE_FIXED_QUOTA). Mirrors core/kpopMalePolicy.ts exactly —
 * see that file's own doc comment for why no per-gender logic lives here.
 */
export const KR_IDOL_FEMALE_POLICY = kpopWorkspacePolicyFor('kr-idol-female')!;

export function checkKrIdolFemaleFixedQuota(counts: Partial<Record<VocalType, number>>, songCount: number): KpopQuotaFidelityFinding[] {
  return checkKpopFixedQuotaFidelity(counts, KR_IDOL_FEMALE_POLICY, songCount);
}

export function checkKrIdolFemaleLanguageRole(lyrics: string, role: KpopSongRole) {
  return checkKpopLanguageRole(lyrics, role, KR_IDOL_FEMALE_POLICY);
}

export function checkKrIdolFemaleMotifQuotas(songs: TextMotifSong[]) {
  return checkKpopMotifQuotas(songs, KR_IDOL_FEMALE_POLICY);
}

export function checkKrIdolFemaleRapShare(plans: readonly { hasRapSection: boolean }[]) {
  return checkKpopRapShare(plans, KR_IDOL_FEMALE_POLICY);
}

export function findKrIdolFemaleConsecutiveLeadRuns(leadTypes: readonly string[], maxConsecutive = 2) {
  return findConsecutiveLeadTypeRuns(leadTypes, maxConsecutive);
}

export function checkKrIdolFemaleChantOveruse(songs: readonly { trackNo: number; lyrics: string }[]) {
  return checkKpopChantOveruse(songs, KR_IDOL_FEMALE_POLICY);
}
