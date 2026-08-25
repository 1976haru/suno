import type { SongIdea, WorkspaceId } from '../types';
import { attributesFromSong, recordRating, type RatingRecord, type SongRating } from './ratingLedger';
import { listFullPacksForWorkspace } from './library';
import { currentWorkspaceId } from './workspaceScope';

/**
 * TASK v5.20 (독립 수노모드 뷰어, TASK C-3, "앱에서 가져오기") — the counterpart
 * to core/sunoViewerExport.ts's exportRatings: reads a ratings_<setName>_
 * <date>.json file the viewer produced and merges it into ratingLedger.ts,
 * the same store the in-app rating UI already writes to (verifiedCombos.ts
 * and every other consumer of "what did a human actually think of this
 * song" reads from there, never from a separate viewer-specific store).
 *
 * Matching, in priority order:
 *  1. songId, when the viewer's export carried a real one (only possible
 *     when the opened lyrics/*.json file itself had real songIds — true for
 *     a file re-exported FROM this app, false for a fresh Codex bridge
 *     output, which never has songId at all; see
 *     sunoViewerExport.ts's normalizeSong).
 *  2. channelId + packGeneratedAt (this export's own additive fields, not
 *     part of the task doc's literal minimal shape — see
 *     sunoViewerExport.ts's exportRatings doc comment for why setName alone
 *     is NOT reliable: a bridge-imported pack is saved under
 *     buildDefaultPackName's own "<channel name> - <project title> - <date>"
 *     scheme, which is a DIFFERENT string than the lyrics file's own
 *     meta.setName — a literal setName match would silently fail for the
 *     app's own default save flow, the common case). blueprint.generatedAt
 *     is captured once from the SAME bridge-import meta.generatedAt this
 *     export's packGeneratedAt is sourced from (core/bridgeImport.ts), so an
 *     exact match here reliably identifies "the same generation", not just
 *     "a plausibly similar one".
 *  3. setName === pack.name, kept as a last-resort fallback for the cases
 *     that DO align (a manually renamed pack, or a future save flow that
 *     adopts setName directly) — never assumed to be the common case.
 * A rating whose track matches none of these is skipped, not guessed at;
 * see ViewerRatingsImportResult.skipped/warnings for what to tell the user.
 */

export interface ViewerRatingEntry {
  trackNo?: number;
  songId?: string;
  rating?: string;
  ratedAt?: string;
}

export interface ViewerRatingsExport {
  setName?: string;
  exportedAt?: string;
  source?: string;
  viewerVersion?: string;
  /** TASK v5.20 — additive, not part of the task doc's own minimal shape; see this module's own doc comment on why they make matching reliable where a bare setName can't. */
  channelId?: string;
  packGeneratedAt?: string;
  ratings?: ViewerRatingEntry[];
}

export interface ViewerRatingsImportResult {
  matched: number;
  skipped: number;
  warnings: string[];
}

const VALID_RATINGS = new Set<SongRating>(['good', 'ok', 'bad']);

interface PackSongMatch {
  song: SongIdea;
  packId: string;
  channelId: string;
}

/**
 * Parses and merges a viewer ratings-export file. Never throws on malformed
 * input — returns { matched: 0, skipped: 0, warnings: [...] } instead, same
 * "explain, don't crash" contract as core/importInspection.ts's own
 * inspectImportReport.
 */
export async function importViewerRatings(raw: unknown, workspaceId: WorkspaceId = currentWorkspaceId()): Promise<ViewerRatingsImportResult> {
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { matched: 0, skipped: 0, warnings: ['가져오기 파일 형식이 올바르지 않습니다 — 뷰어의 [평가 내보내기] 파일인지 확인하세요.'] };
  }
  const data = raw as ViewerRatingsExport;

  // TASK v5.20 (TASK D-3) — this export format never carries API keys; a
  // tampered/malformed file might. Ignored either way (never read below),
  // but surfaced so the user knows a field was dropped rather than silently
  // ignored.
  if (Object.prototype.hasOwnProperty.call(data as Record<string, unknown>, 'apiKey')) {
    warnings.push('가져온 파일에 apiKey 필드가 있어 무시했습니다.');
  }

  const entries = Array.isArray(data.ratings) ? data.ratings : [];
  if (!entries.length) {
    return { matched: 0, skipped: 0, warnings: [...warnings, '가져올 평가 항목이 없습니다.'] };
  }

  const packs = await listFullPacksForWorkspace(workspaceId);

  const bySongId = new Map<string, PackSongMatch>();
  for (const pack of packs) {
    for (const song of pack.blueprint.songs) {
      if (song.songId) bySongId.set(song.songId, { song, packId: pack.id, channelId: pack.channelId });
    }
  }

  function findByChannelAndGeneratedAt(trackNo: number | undefined): PackSongMatch | undefined {
    if (!trackNo || !data.channelId || !data.packGeneratedAt) return undefined;
    for (const pack of packs) {
      if (pack.channelId !== data.channelId) continue;
      if (pack.blueprint.generatedAt !== data.packGeneratedAt) continue;
      const song = pack.blueprint.songs.find(s => s.trackNo === trackNo);
      if (song) return { song, packId: pack.id, channelId: pack.channelId };
    }
    return undefined;
  }

  function findBySetName(trackNo: number | undefined): PackSongMatch | undefined {
    if (!trackNo || !data.setName) return undefined;
    for (const pack of packs) {
      if (pack.name !== data.setName) continue;
      const song = pack.blueprint.songs.find(s => s.trackNo === trackNo);
      if (song) return { song, packId: pack.id, channelId: pack.channelId };
    }
    return undefined;
  }

  // "중복이면 최신 우선" (TASK C-3) — sort so the first time this loop
  // resolves a given real songId, it's already the entry with the latest
  // ratedAt; every later duplicate for that same song is then skipped.
  const sorted = [...entries].sort((a, b) => String(b.ratedAt || '').localeCompare(String(a.ratedAt || '')));

  let matched = 0;
  let skipped = 0;
  const recordedSongIds = new Set<string>();

  for (const entry of sorted) {
    const rating = typeof entry.rating === 'string' ? entry.rating : '';
    if (!VALID_RATINGS.has(rating as SongRating)) {
      skipped++;
      continue;
    }
    const match =
      (entry.songId ? bySongId.get(entry.songId) : undefined) ||
      findByChannelAndGeneratedAt(entry.trackNo) ||
      findBySetName(entry.trackNo);
    if (!match || !match.song.songId) {
      skipped++;
      continue;
    }
    if (recordedSongIds.has(match.song.songId)) continue;
    recordedSongIds.add(match.song.songId);

    const record: RatingRecord = {
      songId: match.song.songId,
      packId: match.packId,
      rating: rating as SongRating,
      ratedAt: typeof entry.ratedAt === 'string' && entry.ratedAt ? entry.ratedAt : new Date().toISOString(),
      attributes: attributesFromSong(match.song, match.channelId)
    };
    await recordRating(record);
    matched++;
  }

  if (skipped > 0) {
    warnings.push(`${skipped}건은 저장된 팩에서 일치하는 곡을 찾지 못해 건너뛰었습니다.`);
  }

  return { matched, skipped, warnings };
}
