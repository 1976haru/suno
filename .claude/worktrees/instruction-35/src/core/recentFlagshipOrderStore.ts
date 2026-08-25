import { scopedKey } from './workspaceScope';
import type { VocalType } from './vocalPlan';

/**
 * v3.80 (TASK A-3) — real listening feedback found T2 (the first flagship
 * slot) landing male by pure accident of the existing vocal-type rotation,
 * with no memory of which vocal-type order the previous set used. Mirrors
 * core/recentGenreStore.ts's own localStorage/scopedKey pattern exactly
 * (sync, best-effort, never blocks generation on storage failure) rather
 * than core/vocalComboLedger.ts's async IndexedDB pattern — this only ever
 * needs "what was the last order", not a ledger of many past combos.
 */
const STORAGE_KEY = 'suno-weaver-recent-flagship-order-v1';

type RecentFlagshipOrderMap = Record<string, VocalType[]>;

function readMap(): RecentFlagshipOrderMap {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(scopedKey(STORAGE_KEY)) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: RecentFlagshipOrderMap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(map));
  } catch {
    // Recent flagship order is a convenience; blocked storage should not break generation.
  }
}

export function readRecentFlagshipOrder(channelId: string): VocalType[] | undefined {
  const map = readMap();
  const order = map[channelId];
  return Array.isArray(order) && order.length === 3 ? order : undefined;
}

export function rememberFlagshipOrder(channelId: string, order: VocalType[]) {
  const map = readMap();
  map[channelId] = [...order];
  writeMap(map);
}
