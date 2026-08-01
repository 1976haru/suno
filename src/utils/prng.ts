/**
 * v4.2 (TASK A3) — hashSeed/mulberry32/shuffle used to live only inside
 * core/lyricEngine.ts (mulberry32 unexported, shuffle exported). Pulled out
 * so data/titlePatterns.ts can seed its own pattern selection without
 * importing core/lyricEngine.ts (which will import data/titlePatterns.ts
 * back for titleFromHook — a data/ -> core/ -> data/ cycle otherwise).
 * lyricEngine.ts re-exports all three so every existing `from './lyricEngine'`
 * import keeps working unchanged.
 */
export function hashSeed(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
