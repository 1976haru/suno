import { eraCanonPalettesForGenreId, type EraCanonPalette } from '../data/eraCanonPalettes';
import { shuffle } from './lyricEngine';

/** TASK v4.6 (§1-4) — "같은 팔레트 최대 6곡". */
const MAX_SONGS_PER_PALETTE = 6;
/** TASK v4.6 (§1-4) — "사용 팔레트 종류 최소 3종". Only enforced when the pack's own genre mix actually reaches 3+ distinct eligible palettes — see buildEraCanonPalettePlan's own doc comment. */
const MIN_PALETTE_TYPES = 3;

function pickOne<T>(items: readonly T[], seed: number): T {
  const index = Math.abs(seed) % items.length;
  return items[index];
}

/**
 * Deterministic (seeded) per-song palette assignment: each song can only
 * draw from palettes whose fitsGenreIds includes that song's own genreId
 * (an oldpop-soft-rock-am track never gets a British-beat palette), so this
 * is a constrained pick, not a free rotation like buildHookDevicePlan/
 * buildIntroTexturePlan. Songs whose genre matches no palette (every
 * non-oldpop workspace) get undefined — rotatingEraPaletteAtoms below
 * already treats that as "no atoms," so callers never need to branch on it.
 *
 * Repair passes are best-effort, not exhaustive optimization: (1) cap each
 * palette at MAX_SONGS_PER_PALETTE by reassigning the latest-index excess
 * occurrences to another eligible palette for that same song, when one
 * exists; (2) if the whole plan still uses fewer than MIN_PALETTE_TYPES
 * distinct palettes, reassign one song per missing palette (the first song
 * whose own eligible set includes it) to pull it in. Both passes only ever
 * reassign a song to a palette that already fits its own genreId — this
 * never puts a British-beat descriptor on a folk-rock track.
 */
export function buildEraCanonPalettePlan(genrePlan: readonly (string | undefined)[], seed: number): (EraCanonPalette | undefined)[] {
  const eligibleByIndex = genrePlan.map(genreId => eraCanonPalettesForGenreId(genreId));
  const plan: (EraCanonPalette | undefined)[] = eligibleByIndex.map((eligible, idx) => {
    if (!eligible.length) return undefined;
    const shuffled = shuffle(eligible, seed + idx * 337);
    return shuffled[0];
  });

  // Pass 1 — cap at MAX_SONGS_PER_PALETTE.
  const countById = new Map<string, number>();
  for (const palette of plan) {
    if (!palette) continue;
    countById.set(palette.id, (countById.get(palette.id) ?? 0) + 1);
  }
  for (let idx = 0; idx < plan.length; idx++) {
    const current = plan[idx];
    if (!current) continue;
    if ((countById.get(current.id) ?? 0) <= MAX_SONGS_PER_PALETTE) continue;
    const alternative = eligibleByIndex[idx].find(candidate => candidate.id !== current.id && (countById.get(candidate.id) ?? 0) < MAX_SONGS_PER_PALETTE);
    if (!alternative) continue;
    countById.set(current.id, (countById.get(current.id) ?? 0) - 1);
    countById.set(alternative.id, (countById.get(alternative.id) ?? 0) + 1);
    plan[idx] = alternative;
  }

  // Pass 2 — diversity floor, only when the pack's own genre mix actually
  // offers MIN_PALETTE_TYPES distinct options at all (a channel using only
  // 1-2 oldpop sub-genres can never reach 3 regardless of reassignment).
  const reachablePaletteIds = new Set(eligibleByIndex.flat().map(p => p.id));
  if (reachablePaletteIds.size >= MIN_PALETTE_TYPES) {
    let usedPaletteIds = new Set(plan.filter((p): p is EraCanonPalette => !!p).map(p => p.id));
    for (const paletteId of reachablePaletteIds) {
      if (usedPaletteIds.size >= MIN_PALETTE_TYPES) break;
      if (usedPaletteIds.has(paletteId)) continue;
      const targetIdx = eligibleByIndex.findIndex((eligible, idx) => {
        const current = plan[idx];
        return eligible.some(p => p.id === paletteId) && (!current || (countById.get(current.id) ?? 0) > 1);
      });
      if (targetIdx === -1) continue;
      const palette = eligibleByIndex[targetIdx].find(p => p.id === paletteId)!;
      const previous = plan[targetIdx];
      if (previous) countById.set(previous.id, (countById.get(previous.id) ?? 0) - 1);
      countById.set(paletteId, (countById.get(paletteId) ?? 0) + 1);
      plan[targetIdx] = palette;
      usedPaletteIds = new Set(plan.filter((p): p is EraCanonPalette => !!p).map(p => p.id));
    }
  }

  return plan;
}

/**
 * TASK v4.6 (§1-4) — "각 축에서 1개씩, 총 3~4개 서술어". Always draws
 * instrumentation/harmonyTraits/vocalTraits (3 atoms); productionTraits is
 * added on roughly half of songs (seed-parity) to land the total at 3-4 as
 * specified, rather than always 4 (which would compete harder against the
 * concept atom's own budget floor — see localGenerator.ts's CONCEPT_FLOOR_ATOMS).
 */
export function rotatingEraPaletteAtoms(palette: EraCanonPalette | undefined, seed: number, index: number): string[] {
  if (!palette) return [];
  const base = seed + index * 97;
  const atoms = [
    pickOne(palette.instrumentation, base + 11),
    pickOne(palette.harmonyTraits, base + 23),
    pickOne(palette.vocalTraits, base + 41)
  ];
  if (Math.abs(base + 59) % 2 === 0) atoms.push(pickOne(palette.productionTraits, base + 59));
  return atoms;
}
