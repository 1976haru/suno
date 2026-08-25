/**
 * TASK v4.9 (TASK C) — real listening feedback: "1~3번 곡이 뭔가 들었을 때 귀에
 * 딱 걸려서 사로잡는 포인트가 조금 부족", confirmed by real audio measurement
 * (T2/T3's own amplitude peak sitting at 9/10 of the track, i.e. only at the
 * very end). data/killingPoints.ts's KillingPoint is a DIFFERENT concept —
 * one designed peak near the final chorus, meant to make a song memorable
 * AFTER hearing it — this is the first-15-seconds impression that keeps a
 * listener from skipping BEFORE the song has a chance to build to that
 * peak. A playlist loses listeners in its first 2-3 tracks, so those are
 * the ones this dictionary is mandatory for.
 */
export interface OpeningHook {
  id: string;
  labelKo: string;
  /** Single style-prompt atom, kept under 8 words per this app's own established descriptor-length convention (see data/killingPoints.ts's identical constraint). */
  descriptor: string;
  fitsFamilies: string[];
}

const ALL_FAMILIES = ['family-acoustic-soft', 'family-bright-pop', 'family-orchestral', 'family-soul'];

export const OPENING_HOOKS: OpeningHook[] = [
  {
    id: 'OH-01',
    labelKo: '즉시 훅 진입',
    descriptor: 'opens straight into the chorus hook, no intro',
    fitsFamilies: ALL_FAMILIES
  },
  {
    id: 'OH-02',
    labelKo: '기억되는 인트로 리프',
    descriptor: 'a short memorable instrumental riff opens the song',
    fitsFamilies: ['family-acoustic-soft', 'family-bright-pop']
  },
  {
    id: 'OH-03',
    labelKo: '무반주 첫 소절',
    descriptor: 'first vocal line enters unaccompanied',
    fitsFamilies: ['family-acoustic-soft', 'family-orchestral']
  },
  {
    id: 'OH-04',
    labelKo: '후렴 선율 인트로',
    // TASK v4.9 bugfix — shortened from 9 to 6 words: over this app's own
    // established 8-word style-prompt-atom convention (see
    // data/killingPoints.ts's identical constraint) and a real contributor
    // to a duet-heavy flagship track exceeding v4.8's own 835-char max.
    descriptor: 'intro plays the chorus melody first',
    fitsFamilies: ['family-bright-pop', 'family-orchestral']
  },
  {
    id: 'OH-05',
    labelKo: '독특한 첫 소리',
    descriptor: 'opens with one distinctive instrumental sound',
    fitsFamilies: ALL_FAMILIES
  },
  {
    id: 'OH-06',
    labelKo: '즉시 2성 하모니',
    descriptor: 'two voices enter in harmony immediately',
    fitsFamilies: ['family-acoustic-soft', 'family-bright-pop']
  },
  {
    id: 'OH-07',
    labelKo: '핸드클랩·박수 시작',
    descriptor: 'handclaps set the groove before the band enters',
    fitsFamilies: ['family-bright-pop', 'family-soul']
  }
];

export function openingHookById(id: string): OpeningHook | undefined {
  return OPENING_HOOKS.find(hook => hook.id === id);
}

/**
 * TASK v4.11 (TASK B) — real waveform measurement: tracks 1-3's first 15
 * seconds averaged 3.7dB below that same track's own full-song average
 * (worst -4.5dB) even after v4.9's opening hooks landed — those descriptors
 * say WHAT the track opens with (a riff, an a cappella line, ...) but never
 * HOW LOUD, and Suno tends to render an intro quietly by default regardless
 * of what it contains. This is a separate axis from OPENING_HOOKS above
 * (content vs. level) and from v3.67's killingPoint/emotionArc "opening
 * intensity" (emotional arc shape, not mix loudness) — a quiet arc opening
 * still needs to render at full level. Tracks 1-3 only, same as
 * OPENING_HOOKS' own required coverage: applying this to all 18 songs would
 * flatten the pack's back-half dynamic build (v3.75's own achievement).
 */
// TASK v4.11 (TASK B) bugfix — the middle phrase originally read "no quiet
// fade-in, the song is already at full level": an internal comma, which
// breaks this app's own single-atom-per-comma-segment style-prompt
// convention (every other descriptor in this file, killingPoints.ts, etc.
// is comma-free) the moment it's joined into a comma-separated stylePrompt —
// it silently fragments into two separate "atoms" downstream (anywhere a
// prompt gets split on commas, e.g. descriptorCount()), and a real test
// caught the second half reading as ordinary shared boilerplate instead of
// part of this one descriptor. Reworded comma-free, same meaning.
export const OPENING_LOUDNESS_DESCRIPTORS: readonly string[] = [
  'full arrangement from the first bar',
  'no quiet fade-in — already at full level from the start',
  'opening is as loud and full as the chorus'
];

/** Tracks 1-3 (idx 0-2) each get one of OPENING_LOUDNESS_DESCRIPTORS, seed-rotated so the pack doesn't repeat the same phrase three times in a row. Undefined for idx >= 3 — see this module's own "트랙 1~3만" scope note above. */
export function assignOpeningLoudnessDescriptors(count: number, seed: number): (string | undefined)[] {
  const plan: (string | undefined)[] = new Array(count).fill(undefined);
  const requiredCount = Math.min(3, count);
  for (let idx = 0; idx < requiredCount; idx++) {
    const offset = Math.abs(seed + idx * 313) % OPENING_LOUDNESS_DESCRIPTORS.length;
    plan[idx] = OPENING_LOUDNESS_DESCRIPTORS[offset];
  }
  return plan;
}

function candidatesForFamily(familyId: string | undefined): OpeningHook[] {
  if (!familyId) return OPENING_HOOKS;
  const fitting = OPENING_HOOKS.filter(hook => hook.fitsFamilies.includes(familyId));
  return fitting.length ? fitting : OPENING_HOOKS;
}

/** Deterministic rotation index — mirrors data/killingPoints.ts's own `Math.abs(seed + idx * 97) % candidates.length` convention. */
function pickDistinct(seed: number, idx: number, candidates: OpeningHook[], taken: Set<string>): OpeningHook {
  const offset = Math.abs(seed + idx * 97) % candidates.length;
  const rotated = [...candidates.slice(offset), ...candidates.slice(0, offset)];
  return rotated.find(hook => !taken.has(hook.id)) ?? rotated[0];
}

// TASK v4.9 (TASK C) — spec's own ceiling is 4, but real measurement found
// even the 3 MANDATORY tracks alone land right at v4.8's own 650-835
// length target (a duet-heavy flagship track, already the longest shape
// this app produces, sits ~2 chars over 835 with its opening hook
// included) — any optional coverage beyond the mandatory 3 pushed a
// duet-heavy track past 835 (measured 898). Dropped to 0: the actual
// listening complaint ("1~3번 곡에... 후킹 포인트가 부족") only ever named
// tracks 1-3, so the mandatory coverage alone already answers it, and this
// task's own explicit "프롬프트를 v4.8 수준보다 늘리지 말 것" wins the tension
// with the spec's own separately-permissive (not mandatory) "최대 4곡".
const OPTIONAL_OPENING_HOOK_CAP = 0;

/**
 * Tracks 1-3 (idx 0-2) always get a distinct opening hook — see this task's
 * own "트랙 1~3 초반 후킹 필수. 서로 다른 3종". Tracks 4+ get one only up to
 * `OPTIONAL_OPENING_HOOK_CAP` additional songs total, seed-rotated so which
 * later tracks get one varies pack to pack rather than always the same
 * trailing slots. `familyIdByIndex[idx]`, when provided (a song's own
 * data/paletteFamilies.ts family — see core/eraCanonPalettePlan.ts's genre-
 * driven palette assignment), narrows candidates to hooks that fit that
 * family; undefined falls back to the full dictionary.
 */
export function assignOpeningHooks(
  count: number,
  seed: number,
  familyIdByIndex: readonly (string | undefined)[] = []
): (OpeningHook | undefined)[] {
  const plan: (OpeningHook | undefined)[] = new Array(count).fill(undefined);
  const requiredCount = Math.min(3, count);
  const takenIds = new Set<string>();
  for (let idx = 0; idx < requiredCount; idx++) {
    const hook = pickDistinct(seed, idx, candidatesForFamily(familyIdByIndex[idx]), takenIds);
    plan[idx] = hook;
    takenIds.add(hook.id);
  }
  // Deterministically picks exactly min(OPTIONAL_OPENING_HOOK_CAP, remaining
  // track count) indices — a seeded pseudo-rank sort rather than a modulo
  // coin-flip, so the cap is a hard guarantee, never a probabilistic
  // approximation that could occasionally exceed it.
  const remainingIndexes: number[] = [];
  for (let idx = requiredCount; idx < count; idx++) remainingIndexes.push(idx);
  const ranked = remainingIndexes
    .map(idx => ({ idx, rank: Math.abs((seed + idx * 613) * 2654435761) % 100000 }))
    .sort((a, b) => a.rank - b.rank);
  const chosenIndexes = new Set(ranked.slice(0, Math.min(OPTIONAL_OPENING_HOOK_CAP, ranked.length)).map(entry => entry.idx));
  for (const idx of remainingIndexes) {
    if (!chosenIndexes.has(idx)) continue;
    const candidates = candidatesForFamily(familyIdByIndex[idx]);
    const offset = Math.abs(seed + idx * 97) % candidates.length;
    plan[idx] = candidates[offset];
  }
  return plan;
}
