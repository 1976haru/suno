import { hookDevices } from '../data/hookDevices';
import { buildStridePlan, repairAdjacentRepeats } from './stridePlan';

/**
 * Deterministic per-track hook-device plan. v3.47 uses the shared stride
 * helper so adjacent songs walk through the pool structurally instead of
 * relying on shuffled laps and repair.
 */
export function buildHookDevicePlan(songCount: number, seed: number): string[] {
  const ids = hookDevices.map(device => device.id);
  if (!ids.length || songCount <= 0) return [];

  return repairAdjacentRepeats(buildStridePlan(ids, songCount, Math.abs(seed) % ids.length));
}
