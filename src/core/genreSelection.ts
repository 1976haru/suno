export const MAX_SECONDARY_GENRES = 2;
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
