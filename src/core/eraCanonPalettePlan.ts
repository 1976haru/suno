import { eraCanonPalettesForGenreId, partialPaletteForGenreId, type EraCanonPalette } from '../data/eraCanonPalettes';
import { shuffle } from './lyricEngine';
import { hashSeed } from '../utils/prng';

/** TASK v4.6 (§1-4) — "같은 팔레트 최대 6곡". */
const MAX_SONGS_PER_PALETTE = 6;
/**
 * TASK v4.6 (§1-4) — "사용 팔레트 종류 최소 3종". Only enforced when the
 * pack's own genre mix actually reaches this many distinct eligible palettes
 * — see buildEraCanonPalettePlan's own doc comment. Fallback default only:
 * data/channelSoundFloor.ts's own `minPaletteVariety` (2 since v4.9, that
 * field's own doc comment) is the real, current policy number and should be
 * threaded in by both real callers (designGate.ts/localGenerator.ts) via
 * buildEraCanonPalettePlan's minPaletteTypes parameter — this constant only
 * covers a caller that genuinely has no ChannelSoundFloor to read from.
 */
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
 * 정합성 점검 §1 결함1/palette-variety-max fix — real measured bug: the
 * initial assignment used to draw independently per song (seeded shuffle,
 * first pick), with zero awareness of what earlier songs in the SAME pack
 * already picked. Several eraCanonPalettes.ts palettes cover multiple genre
 * ids at once (e.g. canon-soft-pop-duo fits both oldpop-soft-rock-am and
 * oldpop-adult-contemporary-80s) specifically so a pack mixing those genres
 * CAN consolidate onto one palette — but independent-per-song drawing never
 * exploited that, so widening a pack's genre selection (e.g. designGate.ts's
 * 'variety' breadth, which legitimately wants 6+ distinct genres) routinely
 * pushed distinctPaletteIds.size past data/channelSoundFloor.ts's own
 * maxPaletteVariety (4 for senior-morning) even when the actual selected
 * genres could have consolidated to 3. Now prefers a palette this song is
 * ALREADY eligible for AND that's already in use elsewhere in the pack
 * (ties broken toward the most-used one, then id order, both deterministic)
 * before falling back to the original seeded shuffle — this never assigns a
 * palette the song's own genre doesn't fit, only changes WHICH of its
 * already-eligible palettes gets picked first.
 *
 * Repair passes are best-effort, not exhaustive optimization: (1) cap each
 * palette at MAX_SONGS_PER_PALETTE by reassigning the latest-index excess
 * occurrences to another eligible palette for that same song, when one
 * exists; (2) if the whole plan still uses fewer than minPaletteTypes
 * distinct palettes, reassign one song per missing palette (the first song
 * whose own eligible set includes it) to pull it in. Both passes only ever
 * reassign a song to a palette that already fits its own genreId — this
 * never puts a British-beat descriptor on a folk-rock track.
 */
export function buildEraCanonPalettePlan(
  genrePlan: readonly (string | undefined)[],
  seed: number,
  /**
   * 정합성 점검 §1 결함1/palette-variety-max fix — data/channelSoundFloor.ts's
   * own `minPaletteVariety` (2 for senior-morning since v4.9) is the real,
   * current policy number; this module's own MIN_PALETTE_TYPES constant (3)
   * had drifted stale relative to it (never updated when that field was
   * lowered) and was actively forcing MORE distinct palettes than the
   * current policy wants — fighting the consolidation fix above. Defaults to
   * the module constant only for a caller with no ChannelSoundFloor to read.
   */
  minPaletteTypes: number = MIN_PALETTE_TYPES
): (PaletteAssignment | undefined)[] {
  const eligibleByIndex = genrePlan.map(genreId => eraCanonPalettesForGenreId(genreId));
  const partialByIndex = genrePlan.map(genreId => partialPaletteForGenreId(genreId));

  const plan: (PaletteAssignment | undefined)[] = [];
  const countById = new Map<string, number>();
  for (let idx = 0; idx < eligibleByIndex.length; idx++) {
    const eligible = eligibleByIndex[idx];
    if (eligible.length) {
      const reused = eligible
        .filter(candidate => (countById.get(candidate.id) ?? 0) > 0 && (countById.get(candidate.id) ?? 0) < MAX_SONGS_PER_PALETTE)
        .sort((a, b) => (countById.get(b.id) ?? 0) - (countById.get(a.id) ?? 0) || a.id.localeCompare(b.id))[0];
      const chosen = reused ?? shuffle(eligible, seed + idx * 337)[0];
      plan.push({ palette: chosen, partial: false });
      countById.set(chosen.id, (countById.get(chosen.id) ?? 0) + 1);
      continue;
    }
    const partial = partialByIndex[idx];
    plan.push(partial ? { palette: partial, partial: true } : undefined);
  }

  // Pass 1 — cap at MAX_SONGS_PER_PALETTE. Partial assignments (§2-3
  // fallback) don't compete for this cap or the diversity floor below —
  // they're a last-resort substitute for a genre with no real palette fit,
  // not a genuine member of that palette's own rotation. countById already
  // reflects the initial assignment above (built incrementally, including
  // the reuse preference), so it's reused as-is rather than recomputed.
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
  // offers minPaletteTypes distinct options at all (a channel using only 1-2
  // oldpop sub-genres can never reach the floor regardless of reassignment).
  const reachablePaletteIds = new Set(eligibleByIndex.flat().map(p => p.id));
  if (reachablePaletteIds.size >= minPaletteTypes) {
    let usedPaletteIds = new Set(plan.filter((a): a is PaletteAssignment => !!a && !a.partial).map(a => a.palette.id));
    for (const paletteId of reachablePaletteIds) {
      if (usedPaletteIds.size >= minPaletteTypes) break;
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
 *
 * TASK v4.7 (팔레트 커버리지 확장) — `genreId` folded into the selection seed:
 * several v4.7 palettes now cover MULTIPLE genre ids at once (e.g.
 * canon-doowop-girlgroup spans oldpop-doowop-harmony/oldpop-brill-building/
 * oldpop-girl-group-wall). Before this, two songs sharing a palette at the
 * same track index picked the exact same atoms (selection only varied by
 * pack seed + track index, never by which genre was actually playing),
 * which collapsed those genres' style prompts toward each other — a real
 * regression caught by tests/oldpopGenreFamily.test.ts's pre-existing
 * cross-genre similarity check once coverage widened enough for two genres
 * in the same test pack to share a palette. Hashing genreId in means
 * different genres drawing the same palette still pick different specific
 * descriptors from it.
 */
export function rotatingEraPaletteAtoms(assignment: PaletteAssignment | undefined, seed: number, index: number, genreId?: string): string[] {
  if (!assignment) return [];
  const { palette, partial } = assignment;
  const genreSalt = genreId ? hashSeed(genreId) : 0;
  const base = seed + index * 97 + genreSalt;
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
