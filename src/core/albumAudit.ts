import type { GenerationOptions, SongIdea } from '../types';
import { findArtistReferenceLeaks } from './artistReferenceDecomposer';
import { SUNO_COPY_LIMIT } from './promptBudget';
import { MAX_GENRE_SHARE } from './conceptAgent';
import { titleHookOverlapWarning } from './quality';
import { sanitizePublicYoutubeTags } from './exportCompliance';
import { audienceProfileForAgeGroup } from '../data/audienceProfiles';

export interface AlbumAuditReport {
  songCount: number;
  /** Blocking issues — a bridge/UI caller should refuse to hand this pack's content to Suno while any of these remain. */
  errors: string[];
  /** Non-blocking, worth-a-look issues — surfaced but never gate a copy/export action. */
  warnings: string[];
  passed: boolean;
}

function bpmFromStylePrompt(stylePrompt: string): number | null {
  const match = stylePrompt.match(/(\d{2,3})\s*BPM/i);
  return match ? Number(match[1]) : null;
}

function stddev(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

function duplicateValues(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

/**
 * TASK v3.58 (TASK 6) — a whole-pack audit on top of every song's own
 * per-song scoreSong() warnings (quality.ts): this catches cross-song
 * properties no single song's own score can see (duplicate titles/hooks
 * across the pack, one genre dominating past TASK 2's own diversity cap)
 * plus a final defense-in-depth re-check of every fix TASK 1-5 made
 * (artist-name leaks, the Suno char limit, the chorus/verse wording bug,
 * public YouTube tag keyword-stuffing, senior-audience constraint/tempo
 * coverage). `errors` are meant to block a bridge/copy action in the UI;
 * `warnings` are informational only and never block anything (mirrors
 * core/diversityLinter.ts's InPackSimilarityReport `errors`/`warnings`/
 * `passed` shape, the established convention for a pack-wide lint here).
 */
export function auditAlbum(songs: SongIdea[], opts?: Pick<GenerationOptions, 'audience'>): AlbumAuditReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!songs.length) return { songCount: 0, errors, warnings, passed: true };

  for (const title of duplicateValues(songs.map(song => song.title))) {
    errors.push(`Duplicate title across the pack: "${title}"`);
  }
  for (const hook of duplicateValues(songs.map(song => song.hookPhrase))) {
    errors.push(`Duplicate hook phrase across the pack: "${hook}"`);
  }

  for (const song of songs) {
    const leaks = findArtistReferenceLeaks(song.stylePrompt);
    if (leaks.length) {
      errors.push(`Track ${song.trackNo}: style prompt contains an artist-name leak (${leaks.map(leak => leak.surface).join(', ')}).`);
    }
    if (song.stylePrompt.length > SUNO_COPY_LIMIT) {
      errors.push(`Track ${song.trackNo}: style prompt (${song.stylePrompt.length} chars) exceeds Suno's ${SUNO_COPY_LIMIT}-char copy limit.`);
    }
  }

  // TASK 2's MAX_GENRE_SHARE cap governs the concept agent's OWN allocation
  // (conceptAgent.ts's allocateGenreCounts, when it's the one choosing genres
  // from a wider pool) — it was never meant as a blanket rule against a pack
  // whose genreIds a user deliberately narrowed to 2-3 genres, which
  // naturally exceeds 28%/genre under plain even rotation (this app's own
  // fixtures/tests do exactly that throughout). So this stays a warning, not
  // a blocking error, and only fires when there were enough distinct genres
  // in play that a wider spread was actually available.
  const genreCounts = new Map<string, number>();
  for (const song of songs) {
    if (!song.genreId) continue;
    genreCounts.set(song.genreId, (genreCounts.get(song.genreId) || 0) + 1);
  }
  const genreCap = Math.max(1, Math.floor(songs.length * MAX_GENRE_SHARE));
  const distinctGenreCount = genreCounts.size;
  if (distinctGenreCount > Math.ceil(1 / MAX_GENRE_SHARE)) {
    for (const [genreId, count] of genreCounts) {
      if (count > genreCap) {
        warnings.push(`Genre "${genreId}" is used in ${count}/${songs.length} songs, above the ${Math.round(MAX_GENRE_SHARE * 100)}% concentration guideline (max ${genreCap}) despite ${distinctGenreCount} genres being available.`);
      }
    }
  }

  for (const song of songs) {
    const overlapWarning = titleHookOverlapWarning(song.title, song.hookPhrase);
    if (overlapWarning) warnings.push(`Track ${song.trackNo}: ${overlapWarning}`);

    const chorusStyleMatch = song.stylePrompt.match(/chorus style: ([^;,]+)/i);
    if (chorusStyleMatch && /\bverse\b/i.test(chorusStyleMatch[1])) {
      warnings.push(`Track ${song.trackNo}: style prompt's "chorus style" clause still mentions "verse".`);
    }

    const rawTags = song.youtube?.tags || [];
    if (sanitizePublicYoutubeTags(rawTags).length !== rawTags.length) {
      warnings.push(`Track ${song.trackNo}: YouTube tags contain a Suno/AI keyword that shouldn't be public.`);
    }
  }

  const audienceProfile = audienceProfileForAgeGroup(opts?.audience);
  if (audienceProfile.id === 'senior') {
    const missingConstraint = songs.filter(
      song => !audienceProfile.constraints.some(constraint => song.stylePrompt.includes(constraint))
    );
    if (missingConstraint.length) {
      warnings.push(`${missingConstraint.length}/${songs.length} songs are missing a senior-audience constraint phrase in the style prompt.`);
    }

    const bpms = songs.map(song => bpmFromStylePrompt(song.stylePrompt)).filter((value): value is number => value !== null);
    const bpmStddev = stddev(bpms);
    if (bpms.length >= 2 && bpmStddev < 8) {
      warnings.push(`BPM standard deviation (${bpmStddev.toFixed(1)}) is below the senior-pack diversity target of 8.`);
    }
  }

  return { songCount: songs.length, errors, warnings, passed: errors.length === 0 };
}
