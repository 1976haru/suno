import { MOTIF_FAMILIES, motifFamilyIdForFrameId } from '../data/motifFamilies';
import type { SceneSignature } from './situationLedger';

/**
 * codex 지시문 02 (TASK C) — the real consumer of data/motifFamilies.ts's
 * registry: a within-pack quota check (replaces core/releaseReadiness.ts's
 * old exact-lyricTheme-id approximation — see that registry's own top doc
 * comment for why grouping by the raw theme id almost never fired) and a
 * NEW cross-pack cooldown check, built on top of the SAME ledger data
 * core/situationLedger.ts's recentSceneSignatures already returns (its own
 * `frameId` field — see that function's TASK B doc comment for how it
 * started actually being populated) rather than a new IndexedDB store; a
 * motif family's cross-pack history is nothing more than "which frameIds
 * appeared in which recent packs," already fully derivable from data this
 * app already records.
 *
 * Simplification, documented honestly: cooldown checking uses whatever
 * window the caller already fetched recentSceneSignatures with (the caller
 * decides "how many recent packs," same as every other duplicationHistory
 * axis in this app) rather than re-fetching a separate, exact
 * family.recentPackCooldown-sized window per family — a real, useful
 * cross-pack signal, just not independently sized per family.
 */

export interface MotifFamilyQuotaFinding {
  familyId: string;
  labelKo: string;
  count: number;
  maxPerPack: number;
  trackNos: number[];
}

/** Within-pack cap — a real family-based replacement for the old exact-theme-id approximation. */
export function checkMotifFamilyQuota(currentPackSongs: { trackNo: number; frameId?: string }[]): MotifFamilyQuotaFinding[] {
  const byFamily = new Map<string, number[]>();
  for (const song of currentPackSongs) {
    const familyId = motifFamilyIdForFrameId(song.frameId);
    if (!familyId) continue;
    if (!byFamily.has(familyId)) byFamily.set(familyId, []);
    byFamily.get(familyId)!.push(song.trackNo);
  }
  const findings: MotifFamilyQuotaFinding[] = [];
  for (const [familyId, trackNos] of byFamily) {
    const family = MOTIF_FAMILIES.find(f => f.id === familyId);
    if (!family || trackNos.length <= family.maxPerPack) continue;
    findings.push({ familyId, labelKo: family.labelKo, count: trackNos.length, maxPerPack: family.maxPerPack, trackNos });
  }
  return findings;
}

/** Which motif families appear in the given (already cross-pack) history, and in how many distinct packs each does. */
export function motifFamilyUsageAcrossPacks(signatures: SceneSignature[]): Map<string, Set<string>> {
  const usage = new Map<string, Set<string>>();
  for (const sig of signatures) {
    const familyId = motifFamilyIdForFrameId(sig.frameId);
    if (!familyId) continue;
    if (!usage.has(familyId)) usage.set(familyId, new Set());
    usage.get(familyId)!.add(sig.packId);
  }
  return usage;
}

export interface MotifFamilyCooldownFinding {
  familyId: string;
  labelKo: string;
  trackNos: number[];
  recentPackCount: number;
}

/** Cross-pack — a family this pack leans on that ALSO appeared somewhere in the caller-fetched recent history, for a family whose own recentPackCooldown is > 0 (0 opts a family out of cross-pack tracking entirely — currently none do, kept as a real per-family override, not a global toggle). */
export function checkMotifFamilyCooldown(
  currentPackSongs: { trackNo: number; frameId?: string }[],
  recentHistory: SceneSignature[]
): MotifFamilyCooldownFinding[] {
  const recentUsage = motifFamilyUsageAcrossPacks(recentHistory);
  const currentByFamily = new Map<string, number[]>();
  for (const song of currentPackSongs) {
    const familyId = motifFamilyIdForFrameId(song.frameId);
    if (!familyId) continue;
    if (!currentByFamily.has(familyId)) currentByFamily.set(familyId, []);
    currentByFamily.get(familyId)!.push(song.trackNo);
  }
  const findings: MotifFamilyCooldownFinding[] = [];
  for (const [familyId, trackNos] of currentByFamily) {
    const family = MOTIF_FAMILIES.find(f => f.id === familyId);
    if (!family || family.recentPackCooldown <= 0) continue;
    const recentPackCount = recentUsage.get(familyId)?.size ?? 0;
    if (recentPackCount > 0) findings.push({ familyId, labelKo: family.labelKo, trackNos, recentPackCount });
  }
  return findings;
}
