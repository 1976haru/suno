import { hookDevices } from '../data/hookDevices';
import { shuffle } from './lyricEngine';

/**
 * TASK v3.42 Part B2 — deterministic (seeded) per-trackNo hook-device plan,
 * same shuffle-then-repair shape core/vocalPlan.ts's buildVocalPlan uses:
 * shuffles the full device pool into consecutive laps (reshuffled with a
 * different seed offset each lap once songCount exceeds the pool size), then
 * repairs any adjacent repeat by swapping forward to the next differing
 * device (or, failing that, backward past the run) — "같은 장치 2연속 금지"
 * from the spec. Unlike buildVocalPlan/buildProgressionPlan this applies to
 * every channel unconditionally (no archetype gate, no quota concept): the
 * boilerplate this replaces was identical across every archetype's packs.
 */
export function buildHookDevicePlan(songCount: number, seed: number): string[] {
  const ids = hookDevices.map(device => device.id);
  if (!ids.length || songCount <= 0) return [];

  const plan: string[] = [];
  let lap = 0;
  while (plan.length < songCount) {
    plan.push(...shuffle(ids, seed + lap * 401));
    lap += 1;
  }
  plan.length = songCount;

  for (let i = 1; i < plan.length; i++) {
    if (plan[i] !== plan[i - 1]) continue;
    let swapIndex = -1;
    for (let j = i + 1; j < plan.length; j++) {
      if (plan[j] !== plan[i]) { swapIndex = j; break; }
    }
    if (swapIndex === -1) {
      for (let j = 0; j < i - 1; j++) {
        if (plan[j] !== plan[i]) { swapIndex = j; break; }
      }
    }
    if (swapIndex !== -1) {
      const tmp = plan[i];
      plan[i] = plan[swapIndex];
      plan[swapIndex] = tmp;
    }
  }
  return plan;
}
