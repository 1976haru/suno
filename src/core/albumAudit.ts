import type { GenerationOptions, SongIdea } from '../types';
import { findArtistReferenceLeaks } from './artistReferenceDecomposer';
import { SUNO_COPY_LIMIT } from './promptBudget';
import { MAX_GENRE_SHARE } from './conceptAgent';
import { hookSceneTimeOfDayWarning, scenePropContradictionWarning, titleHookOverlapWarning } from './quality';
import { sanitizePublicYoutubeTags } from './exportCompliance';
import { audienceProfileForAgeGroup } from '../data/audienceProfiles';
import { affectedTrackRatio, ARRANGEMENT_VOCABULARY_SET_ERROR_RATIO, findArrangementVocabularyInLyrics } from './lyricVocabularyGuard';

export interface AlbumAuditReport {
  songCount: number;
  /** Blocking issues — a bridge/UI caller should refuse to hand this pack's content to Suno while any of these remain. */
  errors: string[];
  /** Non-blocking, worth-a-look issues — surfaced but never gate a copy/export action. */
  warnings: string[];
  /** TASK v3.59 (TASK C-9) — songs[].qualityScore average across the pack, when present. */
  avgQualityScore?: number;
  /** TASK v3.59 (TASK C-9) — songs[].qualityScore minimum across the pack, when present. */
  minQualityScore?: number;
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

  // TASK v3.59 (TASK C-9) — auditAlbum previously only ever computed its
  // own pack-level checks; a real pack measured every song's own
  // scoreSong() warnings (quality.ts) at 4 each and qualityScore in the
  // 52-58 range while this function still reported passed:true/warnings:0,
  // because it never looked at song.warnings/song.qualityScore at all.
  // Aggregated as warnings only — never errors (a verbose style prompt
  // shouldn't block the Suno copy button; see TASK 7-7's own per-song
  // scoring for where the real penalty already lives).
  const perSongWarningTrackNos = new Map<string, number[]>();
  for (const song of songs) {
    for (const warning of song.warnings || []) {
      const trackNos = perSongWarningTrackNos.get(warning) || [];
      trackNos.push(song.trackNo);
      perSongWarningTrackNos.set(warning, trackNos);
    }
  }
  for (const [warning, trackNos] of perSongWarningTrackNos) {
    warnings.push(`${trackNos.length}곡에 "${warning}" — 트랙 ${trackNos.join(', ')}`);
  }

  const qualityScores = songs.map(song => song.qualityScore).filter((score): score is number => typeof score === 'number');
  let avgQualityScore: number | undefined;
  let minQualityScore: number | undefined;
  if (qualityScores.length) {
    avgQualityScore = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
    minQualityScore = Math.min(...qualityScores);
    if (avgQualityScore < 80) {
      warnings.push(`평균 qualityScore ${avgQualityScore.toFixed(1)}점 (최저 ${minQualityScore}점) — 80점 미만`);
    }
  }

  for (const title of duplicateValues(songs.map(song => song.title))) {
    errors.push(`Duplicate title across the pack: "${title}"`);
  }
  for (const hook of duplicateValues(songs.map(song => song.hookPhrase))) {
    errors.push(`Duplicate hook phrase across the pack: "${hook}"`);
  }

  // TASK v3.60 (TASK A-3) — a real bridge-imported pack sang its own
  // arrangement/production instructions as if they were lyrics ("The
  // straight-pop drums move softly") in 15/17 songs (88%): the bridge
  // instruction told the agent to weave these terms into the *style
  // prompt* verbatim, but nothing said they must never also appear as the
  // subject of a *lyric* line (see lyricVocabularyGuard.ts). At that
  // affected rate the instruction was systematically ignored, not
  // incidentally slipped once or twice, so this escalates to a blocking
  // error past ARRANGEMENT_VOCABULARY_SET_ERROR_RATIO (30%) — below that,
  // individual songs are still usable and this stays informational.
  const vocabFindings = findArrangementVocabularyInLyrics(songs);
  if (vocabFindings.length) {
    const linesByTrack = new Map<number, string[]>();
    for (const finding of vocabFindings) {
      const lines = linesByTrack.get(finding.trackNo) || [];
      lines.push(finding.line);
      linesByTrack.set(finding.trackNo, lines);
    }
    const affectedTracks = linesByTrack.size;
    const ratio = affectedTrackRatio(vocabFindings, songs.length);
    const detail = [...linesByTrack.entries()]
      .map(([trackNo, lines]) => `트랙 ${trackNo}: "${lines[0]}"${lines.length > 1 ? ` 외 ${lines.length - 1}줄` : ''}`)
      .join(' / ');
    const message = `${affectedTracks}/${songs.length}곡(${Math.round(ratio * 100)}%)의 가사에 편곡/악기 어휘가 문장의 주어로 등장합니다 — ${detail}`;
    if (ratio > ARRANGEMENT_VOCABULARY_SET_ERROR_RATIO) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  for (const song of songs) {
    const leaks = findArtistReferenceLeaks(song.stylePrompt);
    if (leaks.length) {
      errors.push(`Track ${song.trackNo}: style prompt contains an artist-name leak (${leaks.map(leak => leak.surface).join(', ')}).`);
    }
    // TASK v3.58 — a real generated pack was found singing the user's raw
    // customConcept free text verbatim (artist name included) as a chorus/
    // verse line, entirely outside the style prompt (see
    // conceptDiversity.ts's fallbackConcept fix); the lyrics themselves need
    // the same leak scan, not just the style prompt.
    const lyricLeaks = findArtistReferenceLeaks(song.lyrics);
    if (lyricLeaks.length) {
      errors.push(`Track ${song.trackNo}: lyrics contain an artist-name leak (${lyricLeaks.map(leak => leak.surface).join(', ')}).`);
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

    // TASK v3.60 (TASK E) — a real bridge-imported pack paired a morning
    // listener scene with a "Tonight" hook (and, on another track, a sunset
    // scene with a "Morning Train" hook). listenerSituation and hookPhrase
    // are chosen independently (see batchPreallocation.ts), so nothing
    // compared them before this.
    const timeOfDayWarning = hookSceneTimeOfDayWarning(song.hookPhrase, song.listenerSituation);
    if (timeOfDayWarning) warnings.push(`Track ${song.trackNo}: ${timeOfDayWarning}`);

    const propWarning = scenePropContradictionWarning(song.listenerSituation, song.lyrics);
    if (propWarning) warnings.push(`Track ${song.trackNo}: ${propWarning}`);

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

  return { songCount: songs.length, errors, warnings, avgQualityScore, minQualityScore, passed: errors.length === 0 };
}
