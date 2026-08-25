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
import type { ChannelArchetype } from '../types';
import { getDefaultGenreIdsForArchetype, getGenreById, isGenreEligibleForArchetype } from '../data/genreLibrary';
import { workspaceForArchetype } from '../data/workspaces';

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

export interface GenreSanitizationResult {
  valid: string[];
  removed: string[];
  recovered: boolean;
}

/**
 * TASK (genre-archetype sanitization) — a genre id can end up attached to a
 * channel's genreIds/preferredGenres despite belonging to a completely
 * different workspace's genre catalog (a mis-created custom channel, a saved
 * pack from before a fix, a cross-workspace data import, a bad concept-agent
 * recommendation, or leftover manual diversity-allocation state — see this
 * task's own background for the real, verified paths). This is the single
 * checkpoint every one of those paths funnels through: keep only ids that
 * data/genreLibrary/index.ts's isGenreEligibleForArchetype (the same
 * predicate core/setDirector.ts's real generation-time candidate filtering
 * already uses — genreMatchesChannel now delegates to it) actually exposes
 * for `archetype`. `removed` records what got filtered so a caller can warn
 * (see genreSanitizationWarningKo below). If filtering would leave a
 * genuinely non-empty selection at zero (every id was foreign), that's worse
 * than picking nothing — recover to this archetype's own core/default genre
 * set (getDefaultGenreIdsForArchetype, the same canonical default
 * applyChannelToOptions/fallbackGenres already fall back to) rather than
 * leaving the channel unable to generate at all. A genuinely empty input
 * (genreIds.length === 0 — nothing was ever selected, e.g. a brand-new
 * unconfigured channel) is left alone: there's nothing to have been
 * contaminated, and forcing a default here would surprise every existing
 * "no selection yet" code path this task never touched.
 */
export function sanitizeGenreIdsForArchetype(genreIds: string[], archetype: ChannelArchetype): GenreSanitizationResult {
  const valid: string[] = [];
  const removed: string[] = [];
  for (const id of genreIds) {
    const genre = getGenreById(id);
    if (genre && isGenreEligibleForArchetype(genre, archetype)) valid.push(id);
    else removed.push(id);
  }
  if (!valid.length && genreIds.length) {
    return { valid: getDefaultGenreIdsForArchetype(archetype), removed, recovered: true };
  }
  return { valid, removed, recovered: false };
}

/**
 * TASK (genre-archetype sanitization) — the one Korean warning string every
 * wired-up entry point shows, so a stripped genre never disappears silently.
 * Format matches the task brief's own worked example: "⚠ 이 채널에서 쓸 수 없는
 * 장르 2개를 제외했습니다 · oldpop-doowop-harmony · oldpop-brill-building (한국
 * 동요 채널)". Returns '' when nothing was removed so a caller can safely do
 * `warning || undefined`/`.filter(Boolean)` without its own extra guard.
 */
export function genreSanitizationWarningKo(removed: string[], archetype: ChannelArchetype): string {
  if (!removed.length) return '';
  const labelKo = workspaceForArchetype(archetype)?.labelKo;
  const suffix = labelKo ? ` (${labelKo} 채널)` : '';
  return `⚠ 이 채널에서 쓸 수 없는 장르 ${removed.length}개를 제외했습니다 · ${removed.join(' · ')}${suffix}`;
}
