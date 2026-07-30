/**
 * TASK v3.58 — raised 2 -> 4 (3 -> 5 total selected genres). A concept
 * recommendation's genreAllocation (core/conceptAgent.ts) needs a pool of
 * at least ceil(songCount / floor(songCount * 0.28)) genres to keep any
 * single genre under its 28%-of-pack cap — for the default 18-song pack
 * that's 4 genres, and the brief's own worked example (1960s pop split
 * across beat-pop/doo-wop/soft-rock/vocal-jazz/AM-radio-pop) uses 5. The
 * old cap of 3 made that allocation mathematically impossible to honor:
 * applying a concept recommendation would truncate its 4th+ genre right
 * back off, silently re-collapsing the pool this whole fix exists to
 * avoid. This also relaxes the manual chip-picker's own limit (a user can
 * now hand-pick up to 5 genres instead of 3) — a strict capability
 * increase, never a regression, since nothing forces picking more than
 * before.
 */
export const MAX_SECONDARY_GENRES = 4;
export const MAX_SELECTED_GENRES = 1 + MAX_SECONDARY_GENRES;

export function normalizeGenreSelection(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean))).slice(0, MAX_SELECTED_GENRES);
}

export function toggleGenreSelection(currentIds: string[], id: string) {
  const current = normalizeGenreSelection(currentIds);
  if (current.includes(id)) return current.filter(item => item !== id);
  if (current.length >= MAX_SELECTED_GENRES) return current;
  return [...current, id];
}
