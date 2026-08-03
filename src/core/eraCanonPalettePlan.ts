import { eraCanonPalettesForGenreId, partialPaletteForGenreId, type EraCanonPalette } from '../data/eraCanonPalettes';
import { shuffle } from './lyricEngine';

/** TASK v4.6 (§1-4) — "같은 팔레트 최대 6곡". */
const MAX_SONGS_PER_PALETTE = 6;
/** TASK v4.6 (§1-4) — "사용 팔레트 종류 최소 3종". Only enforced when the pack's own genre mix actually reaches 3+ distinct eligible palettes — see buildEraCanonPalettePlan's own doc comment. */
const MIN_PALETTE_TYPES = 3;

/**
 * TASK v4.7 (TASK B, §2-3) — `partial: true` for a genre that has no direct
 * eraCanonPalette match (data/eraCanonPalettes.ts's PARTIAL_PALETTE_FALLBACK,
 * e.g. chanson/bossa-cafe) but borrows a nearby palette's productionTraits
 * only — see rotatingEraPaletteAtoms below, which emits just 1 atom (not
 * 3-4) for a partial assignment so a chanson track never gets a British-beat
 * palette's full instrumentation/harmony/vocal description.
 */
export interface PaletteAssignment {
  palette: EraCanonPalette;
  partial: boolean;
}

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
export function buildEraCanonPalettePlan(genrePlan: readonly (string | undefined)[], seed: number): (PaletteAssignment | undefined)[] {
  const eligibleByIndex = genrePlan.map(genreId => eraCanonPalettesForGenreId(genreId));
  const partialByIndex = genrePlan.map(genreId => partialPaletteForGenreId(genreId));

  const plan: (PaletteAssignment | undefined)[] = eligibleByIndex.map((eligible, idx) => {
    if (eligible.length) {
      const shuffled = shuffle(eligible, seed + idx * 337);
      return { palette: shuffled[0], partial: false };
    }
    const partial = partialByIndex[idx];
    return partial ? { palette: partial, partial: true } : undefined;
  });

  // Pass 1 — cap at MAX_SONGS_PER_PALETTE. Partial assignments (§2-3
  // fallback) don't compete for this cap or the diversity floor below —
  // they're a last-resort substitute for a genre with no real palette fit,
  // not a genuine member of that palette's own rotation.
  const countById = new Map<string, number>();
  for (const assignment of plan) {
    if (!assignment || assignment.partial) continue;
    countById.set(assignment.palette.id, (countById.get(assignment.palette.id) ?? 0) + 1);
  }
  for (let idx = 0; idx < plan.length; idx++) {
    const current = plan[idx];
    if (!current || current.partial) continue;
    if ((countById.get(current.palette.id) ?? 0) <= MAX_SONGS_PER_PALETTE) continue;
    const alternative = eligibleByIndex[idx].find(candidate => candidate.id !== current.palette.id && (countById.get(candidate.id) ?? 0) < MAX_SONGS_PER_PALETTE);
    if (!alternative) continue;
    countById.set(current.palette.id, (countById.get(current.palette.id) ?? 0) - 1);
    countById.set(alternative.id, (countById.get(alternative.id) ?? 0) + 1);
    plan[idx] = { palette: alternative, partial: false };
  }

  // Pass 2 — diversity floor, only when the pack's own genre mix actually
  // offers MIN_PALETTE_TYPES distinct options at all (a channel using only
  // 1-2 oldpop sub-genres can never reach 3 regardless of reassignment).
  const reachablePaletteIds = new Set(eligibleByIndex.flat().map(p => p.id));
  if (reachablePaletteIds.size >= MIN_PALETTE_TYPES) {
    let usedPaletteIds = new Set(plan.filter((a): a is PaletteAssignment => !!a && !a.partial).map(a => a.palette.id));
    for (const paletteId of reachablePaletteIds) {
      if (usedPaletteIds.size >= MIN_PALETTE_TYPES) break;
      if (usedPaletteIds.has(paletteId)) continue;
      const targetIdx = eligibleByIndex.findIndex((eligible, idx) => {
        const current = plan[idx];
        return eligible.some(p => p.id === paletteId) && (!current || current.partial || (countById.get(current.palette.id) ?? 0) > 1);
      });
      if (targetIdx === -1) continue;
      const palette = eligibleByIndex[targetIdx].find(p => p.id === paletteId)!;
      const previous = plan[targetIdx];
      if (previous && !previous.partial) countById.set(previous.palette.id, (countById.get(previous.palette.id) ?? 0) - 1);
      countById.set(paletteId, (countById.get(paletteId) ?? 0) + 1);
      plan[targetIdx] = { palette, partial: false };
      usedPaletteIds = new Set(plan.filter((a): a is PaletteAssignment => !!a && !a.partial).map(a => a.palette.id));
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
export function rotatingEraPaletteAtoms(assignment: PaletteAssignment | undefined, seed: number, index: number): string[] {
  if (!assignment) return [];
  const { palette, partial } = assignment;
  const base = seed + index * 97;
  // TASK v4.7 (TASK B, §2-3) — a partial (fallback) assignment only borrows
  // productionTraits: the genre's own real instrumentation/harmony/vocal
  // character (chanson's accordion, bossa's clave) must not be overwritten
  // by a palette it doesn't actually belong to.
  if (partial) return [pickOne(palette.productionTraits, base + 59)];
  const atoms = [
    pickOne(palette.instrumentation, base + 11),
    pickOne(palette.harmonyTraits, base + 23),
    pickOne(palette.vocalTraits, base + 41)
  ];
  if (Math.abs(base + 59) % 2 === 0) atoms.push(pickOne(palette.productionTraits, base + 59));
  return atoms;
}
