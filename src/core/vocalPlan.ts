import type { GenerationOptions } from '../types';
import { shuffle } from './lyricEngine';

/**
 * TASK v3.38 Part B2 — per-song vocal-type quota for the 'kids' channel
 * archetype, mirroring core/moneyChordPlan.ts's activation pattern: only
 * ever engages for the 'kids' archetype (no other channel has a vocalQuota
 * concept), so every other channel's per-song vocal atom is completely
 * unaffected — see localGenerator.ts's wiring.
 */
export function usesVocalQuota(opts: Pick<GenerationOptions, 'channel'>): boolean {
  return opts.channel.archetype === 'kids';
}

export type VocalType = 'male' | 'female' | 'mixed';

export interface VocalQuota {
  male: number;
  female: number;
  mixed: number;
}

/** TASK v3.38 Part B2 — the 6/6/6-of-18 default; scaleVocalQuota below applies this as a ratio at any songCount, not a literal must-equal-18 requirement. */
export const DEFAULT_KIDS_VOCAL_QUOTA: VocalQuota = { male: 6, female: 6, mixed: 6 };

const VOCAL_DESCRIPTIONS: Record<VocalType, string> = {
  male: 'bright friendly young male voice, clear diction, warm and playful',
  female: 'bright cheerful female voice, gentle and clear, nursery-friendly',
  mixed: "children's choir with a warm adult lead, call-and-response, singalong"
};

export function vocalDescriptionFor(type: VocalType): string {
  return VOCAL_DESCRIPTIONS[type];
}

const VOCAL_TYPES: VocalType[] = ['male', 'female', 'mixed'];

/**
 * TASK v3.38 Part B2 — scales the quota's proportions to the actual
 * songCount (largest-remainder method, so the three counts always sum to
 * exactly songCount even when songCount isn't a multiple of the quota's
 * total). This is what makes "쿼터는 UI에서 조정 가능(18곡 외 다른 곡수에도
 * 비율 적용)" work: a 6/6/6 quota at songCount=9 becomes 3/3/3, not a
 * literal slice of the 18-song default.
 */
export function scaleVocalQuota(quota: VocalQuota, songCount: number): VocalQuota {
  const total = quota.male + quota.female + quota.mixed;
  if (total <= 0 || songCount <= 0) return { male: 0, female: 0, mixed: Math.max(0, songCount) };

  const raw: Record<VocalType, number> = {
    male: (quota.male / total) * songCount,
    female: (quota.female / total) * songCount,
    mixed: (quota.mixed / total) * songCount
  };
  const floors: Record<VocalType, number> = {
    male: Math.floor(raw.male),
    female: Math.floor(raw.female),
    mixed: Math.floor(raw.mixed)
  };
  let remainder = songCount - (floors.male + floors.female + floors.mixed);
  const byRemainderDesc = VOCAL_TYPES.slice().sort((a, b) => (raw[b] - floors[b]) - (raw[a] - floors[a]));

  const result = { ...floors };
  let i = 0;
  while (remainder > 0) {
    result[byRemainderDesc[i % byRemainderDesc.length]] += 1;
    remainder -= 1;
    i += 1;
  }
  return result;
}

/**
 * TASK v3.38 Part B2 — deterministic (seeded) per-trackNo vocal-type plan.
 * Builds a flat pool from the scaled quota, shuffles it, then repairs any
 * run of 4+ consecutive same-type entries by swapping forward to the next
 * differing type (or, failing that, backward past the run) — "같은 타입 4곡
 * 연속 금지" from the spec.
 */
export function buildVocalPlan(quota: VocalQuota, songCount: number, seed: number): VocalType[] {
  const counts = scaleVocalQuota(quota, songCount);
  const pool: VocalType[] = [
    ...Array<VocalType>(counts.male).fill('male'),
    ...Array<VocalType>(counts.female).fill('female'),
    ...Array<VocalType>(counts.mixed).fill('mixed')
  ];
  const plan = shuffle(pool, seed);

  for (let i = 3; i < plan.length; i++) {
    const runsFour = plan[i] === plan[i - 1] && plan[i] === plan[i - 2] && plan[i] === plan[i - 3];
    if (!runsFour) continue;
    let swapIndex = -1;
    for (let j = i + 1; j < plan.length; j++) {
      if (plan[j] !== plan[i]) { swapIndex = j; break; }
    }
    if (swapIndex === -1) {
      for (let j = 0; j < i - 3; j++) {
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
