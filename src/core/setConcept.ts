import { getCoreGenresForArchetype } from '../data/genreLibrary';
import type { ChannelProfile } from '../types';

/**
 * TASK v3.35 (bridge split) — a lightweight stand-in for v3.33 Part B1's
 * full per-set identity system (lead-genre rotation, mood combo, season-
 * moment clusters, tempo profile — not yet built). Rotates only the lead
 * genre through the channel's core genre list (round-robin, so consecutive
 * sets never repeat as long as the archetype has more than one core genre)
 * so each set's bridge instruction at least nudges the agent toward a
 * different flavor per set; season/mood still come from the channel's own
 * selection, unchanged. Replace with the real Part B1 system (mood combo +
 * season-moment cluster + tempo profile + editable concept) when that lands.
 */
export function buildSetConceptLine(channel: ChannelProfile, seasonLabel: string, setIndex: number, totalSets: number): string {
  const coreGenres = getCoreGenresForArchetype(channel.archetype);
  const leadGenre = coreGenres.length ? coreGenres[setIndex % coreGenres.length] : null;
  const parts = [
    `Set ${setIndex + 1}/${totalSets}`,
    leadGenre ? `lead genre: ${leadGenre.label}` : null,
    `season: ${seasonLabel}`
  ].filter((part): part is string => Boolean(part));
  return parts.join(' — ');
}
