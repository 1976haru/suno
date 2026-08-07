import type { SceneSignature } from './situationLedger';
import { SLOT_PLAN_LEDGER_POLICY } from './seniorOldpopPolicy';

/**
 * 지시문 10 (TASK B-4-2) — "배정표 이력. 같은 배정표가 재사용되는 것을 탐지할
 * 방법이 지금 없다." Real measured problem: two real, concept-distinct packs
 * ("60년대 올드팝 명곡" / "70년대 올드팝 명곡") landed 18/18 same-trackNo
 * lyricTheme duplication and 14/18 same-trackNo listenerSituation
 * duplication — not random collision, the same slot-assignment table reused
 * wholesale. This module is the pure comparison logic (real, tested); the
 * actual IndexedDB read (core/situationLedger.ts's recentSceneSignatures)
 * stays the caller's job, same pure-core/impure-shell split every other real
 * ledger consumer in this codebase already follows.
 */
export interface SlotPlanEntry {
  trackNo: number;
  lyricTheme?: string;
  situation?: string;
}

export interface SlotPlanMatch {
  packId: string;
  /** trackNos where this new set's theme OR situation matches that SAME trackNo in this recent pack. */
  matchedTrackNos: number[];
  overlapShare: number;
}

export interface SlotPlanOverlapResult {
  /** The single recent pack with the highest overlap share, if any recent packs were supplied. */
  worstMatch: SlotPlanMatch | undefined;
  verdict: 'ok' | 'warn' | 'block';
}

/**
 * Pure. `recentSignatures` is the flat cross-pack list core/situationLedger.ts's
 * recentSceneSignatures already returns (multiple packs' worth); this groups
 * it back into per-pack slot tables internally. A trackNo counts as
 * "matched" against a given recent pack when EITHER its lyricTheme OR its
 * situation is identical at that SAME trackNo — either alone is real
 * evidence of the same assignment table, not just topical similarity.
 */
export function computeSlotPlanOverlap(newSet: readonly SlotPlanEntry[], recentSignatures: readonly SceneSignature[]): SlotPlanOverlapResult {
  const byPack = new Map<string, SceneSignature[]>();
  for (const sig of recentSignatures) {
    const list = byPack.get(sig.packId) ?? [];
    list.push(sig);
    byPack.set(sig.packId, list);
  }

  const total = newSet.length || 1;
  const matches: SlotPlanMatch[] = [];
  for (const [packId, entries] of byPack) {
    const byTrackNo = new Map(entries.map(e => [e.trackNo, e]));
    const matchedTrackNos = newSet
      .filter(slot => {
        const recent = byTrackNo.get(slot.trackNo);
        if (!recent) return false;
        const themeMatch = Boolean(slot.lyricTheme) && slot.lyricTheme === recent.lyricTheme;
        const situationMatch = Boolean(slot.situation) && slot.situation === recent.situation;
        return themeMatch || situationMatch;
      })
      .map(slot => slot.trackNo);
    if (matchedTrackNos.length) {
      matches.push({ packId, matchedTrackNos, overlapShare: matchedTrackNos.length / total });
    }
  }

  const worstMatch = matches.sort((a, b) => b.overlapShare - a.overlapShare)[0];
  const share = worstMatch?.overlapShare ?? 0;
  const verdict: SlotPlanOverlapResult['verdict'] =
    share >= SLOT_PLAN_LEDGER_POLICY.blockShare ? 'block' : share >= SLOT_PLAN_LEDGER_POLICY.warnShare ? 'warn' : 'ok';

  return { worstMatch, verdict };
}
