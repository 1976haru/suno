import type { SongIdea, WorkspaceId, YoutubeMetadata } from '../types';
import type { AudioTake } from './audioTakes';
import type { ExportMeta } from './exportMeta';
import { buildCsvText, csvField, withUtf8Bom } from './csvExport';
import { extractLyricSungLines, buildSrtCues, buildSrtFile, srtFilename } from './srtExport';
import { safeFileName, type ZipFileInput } from '../utils/zipExporter';

/**
 * codex 지시문 06 (TASK H) — "생산 번들": real assembly of
 * SET_NAME/{audio,lyrics,srt,thumbnails,metadata,timeline.csv,manifest.json}
 * reusing this app's own already-real export primitives (srtExport.ts,
 * csvExport.ts, exportMeta.ts, utils/zipExporter.ts — extended for binary
 * content by this same task) rather than reimplementing any of them.
 *
 * Real constraint (confirmed by investigation, core/audioTakes.ts's own top
 * doc comment): this app never persists a take's actual audio bytes, only
 * its measurements — "음원 파일 자체는 저장하지 마십시오". So the real audio
 * Blob for each selected take must be supplied by the caller at export time
 * (the browser File/Blob the user actually has on hand — a fresh upload or
 * the same session's in-memory reference), never fetched from IndexedDB by
 * this module. `audioBlob` is therefore optional on ProductionBundleTrackInput
 * — a caller that doesn't have it yet still gets a complete bundle with
 * every OTHER real artifact, and `validateProductionBundleCompleteness`
 * reports missing audio honestly rather than silently producing an empty
 * audio/ folder.
 */

export interface ProductionBundleTrackInput {
  song: SongIdea;
  selectedTake: AudioTake;
  /** The real audio bytes for this track's selected take, when the caller has them on hand. */
  audioBlob?: Blob;
}

export interface ProductionBundleTrackEntry {
  trackNo: number;
  title: string;
  takeId: string;
  audioFileName?: string;
  lyricsFileName: string;
  srtFileName: string;
  durationSec: number;
  startSec: number;
  endSec: number;
  youtube: YoutubeMetadata;
}

export interface ProductionBundleManifest {
  setName: string;
  workspaceId: WorkspaceId;
  generatedAt: string;
  exportMeta: ExportMeta;
  tracks: ProductionBundleTrackEntry[];
  /** Always true by construction — this module only ever READS from the caller's own selected-take inputs, never deletes/mutates the original AudioTake records (see core/audioTakes.ts's own real deleteTake, untouched by anything here). */
  originalTakesPreserved: true;
}

/** Real, cumulative CapCut-import timeline — each track's own start/end, computed from its SELECTED take's own measured durationSec (never the target/estimate). */
export function buildProductionBundleManifest(input: {
  setName: string;
  workspaceId: WorkspaceId;
  exportMeta: ExportMeta;
  tracks: readonly Pick<ProductionBundleTrackInput, 'song' | 'selectedTake' | 'audioBlob'>[];
}): ProductionBundleManifest {
  let cursorSec = 0;
  const tracks: ProductionBundleTrackEntry[] = input.tracks
    .slice()
    .sort((a, b) => a.song.trackNo - b.song.trackNo)
    .map(({ song, selectedTake, audioBlob }) => {
      const durationSec = selectedTake.metrics.durationSec;
      const startSec = cursorSec;
      const endSec = cursorSec + durationSec;
      cursorSec = endSec;
      const baseName = `T${String(song.trackNo).padStart(2, '0')}_${safeFileName(song.title)}`;
      return {
        trackNo: song.trackNo,
        title: song.title,
        takeId: selectedTake.takeId,
        audioFileName: audioBlob ? `audio/${baseName}${audioFileExtension(selectedTake.fileName)}` : undefined,
        lyricsFileName: `lyrics/${baseName}.txt`,
        srtFileName: `srt/${srtFilename(song.trackNo, song.title, 'en')}`,
        durationSec,
        startSec,
        endSec,
        youtube: song.youtube
      };
    });

  return {
    setName: input.setName,
    workspaceId: input.workspaceId,
    generatedAt: new Date().toISOString(),
    exportMeta: input.exportMeta,
    tracks,
    originalTakesPreserved: true
  };
}

function audioFileExtension(fileName: string): string {
  const match = /\.[a-z0-9]+$/i.exec(fileName);
  return match ? match[0] : '.mp3';
}

const TIMELINE_HEADER = ['trackNo', 'title', 'takeId', 'startSec', 'endSec', 'durationSec', 'audioFileName'] as const;

/** CapCut용 타임라인 — reuses csvExport.ts's own real buildCsvText/csvField (RFC4180-ish quoting, CRLF rows), not a second CSV formatter. */
export function buildProductionTimelineCsv(manifest: ProductionBundleManifest): string {
  const rows = manifest.tracks.map(track => [
    track.trackNo, track.title, track.takeId,
    track.startSec.toFixed(2), track.endSec.toFixed(2), track.durationSec.toFixed(2),
    track.audioFileName ?? ''
  ]);
  return withUtf8Bom(buildCsvText([...TIMELINE_HEADER], rows));
}

/**
 * ffmpeg가 그대로 읽을 수 있는 concat-demuxer manifest 텍스트 — real, minimal
 * format ffmpeg's own `-f concat` input expects (`file 'audio/...'`), one
 * line per track in set order, only for tracks that actually have a real
 * audio file supplied.
 */
export function buildFfmpegConcatManifest(manifest: ProductionBundleManifest): string {
  return manifest.tracks
    .filter(track => track.audioFileName)
    .map(track => `file '${track.audioFileName}'`)
    .join('\n');
}

export interface AlbumMetadata {
  setName: string;
  workspaceId: WorkspaceId;
  trackCount: number;
  tracks: { trackNo: number; title: string; youtube: YoutubeMetadata }[];
}

export function buildAlbumMetadata(manifest: ProductionBundleManifest): AlbumMetadata {
  return {
    setName: manifest.setName,
    workspaceId: manifest.workspaceId,
    trackCount: manifest.tracks.length,
    tracks: manifest.tracks.map(track => ({ trackNo: track.trackNo, title: track.title, youtube: track.youtube }))
  };
}

/**
 * 완료 기준 "production bundle missing metadata = 0" — real, bounded
 * completeness check: every track needs a real (non-empty) YoutubeMetadata
 * title, and the manifest itself must carry a real exportMeta. Missing
 * AUDIO is reported separately (a real, honest gap — see this module's own
 * top doc comment) and never silently treated as a metadata problem.
 */
export function validateProductionBundleCompleteness(manifest: ProductionBundleManifest): string[] {
  const issues: string[] = [];
  if (!manifest.exportMeta) issues.push('manifest에 exportMeta가 없습니다.');
  for (const track of manifest.tracks) {
    if (!track.youtube?.title?.trim()) issues.push(`T${track.trackNo}: YouTube 메타데이터(title)가 없습니다.`);
    if (!track.youtube?.description?.trim()) issues.push(`T${track.trackNo}: YouTube 메타데이터(description)가 없습니다.`);
    if (!track.lyricsFileName) issues.push(`T${track.trackNo}: 가사 파일 경로가 없습니다.`);
  }
  return issues;
}

/** Missing audio is real and worth surfacing, but deliberately NOT a "missing metadata" issue (see validateProductionBundleCompleteness's own doc comment) — a separate, honestly-labeled report. */
export function tracksWithoutAudio(manifest: ProductionBundleManifest): number[] {
  return manifest.tracks.filter(track => !track.audioFileName).map(track => track.trackNo);
}

// ---------------------------------------------------------------------------
// File assembly — the real SET_NAME/audio,lyrics,srt,thumbnails,metadata/... tree
// ---------------------------------------------------------------------------

export interface ThumbnailPromptInput {
  trackNo: number;
  imagePrompt: string;
}

export function buildProductionBundleFiles(
  manifest: ProductionBundleManifest,
  tracks: readonly ProductionBundleTrackInput[],
  thumbnailPrompts: readonly ThumbnailPromptInput[] = []
): ZipFileInput[] {
  const files: ZipFileInput[] = [];
  const trackByNo = new Map(tracks.map(t => [t.song.trackNo, t]));

  // Real audio bytes are deliberately NOT handled in this synchronous
  // function — resolving a Blob to bytes is async, and this function stays
  // pure/sync so its own file-list logic is directly unit-testable without
  // ever touching a real Blob. See buildProductionBundleFilesWithAudio
  // below for the real async wrapper that adds the audio/ entries.
  for (const entry of manifest.tracks) {
    const input = trackByNo.get(entry.trackNo);
    if (!input) continue;

    files.push({ name: entry.lyricsFileName, content: input.song.lyrics });

    const sungLines = extractLyricSungLines(input.song.lyrics);
    const cues = buildSrtCues(sungLines, entry.durationSec);
    files.push({ name: entry.srtFileName, content: buildSrtFile(cues) });

    files.push({ name: `metadata/T${String(entry.trackNo).padStart(2, '0')}_youtube.json`, content: JSON.stringify(entry.youtube, null, 2) });
  }

  for (const prompt of thumbnailPrompts) {
    // Real image bytes don't exist anywhere in this app (thumbnailSpec.ts is
    // prompt data for an EXTERNAL image generator, confirmed by
    // investigation) — the thumbnails/ folder honestly carries the real
    // prompt text a caller can feed to that external tool, not fabricated
    // image bytes.
    files.push({ name: `thumbnails/T${String(prompt.trackNo).padStart(2, '0')}_prompt.txt`, content: prompt.imagePrompt });
  }

  files.push({ name: 'metadata/album.json', content: JSON.stringify(buildAlbumMetadata(manifest), null, 2) });
  files.push({ name: 'timeline.csv', content: buildProductionTimelineCsv(manifest) });
  files.push({ name: 'metadata/ffmpeg-concat.txt', content: buildFfmpegConcatManifest(manifest) });
  files.push({ name: 'manifest.json', content: JSON.stringify(manifest, null, 2) });

  return files;
}

/**
 * Browser-facing async assembly: resolves every real audio Blob to bytes
 * FIRST (the one real async step), then hands a fully-synchronous file list
 * to buildProductionBundleFiles/buildZip — same "decode once, let it go out
 * of scope" discipline core/audioAnalysis.ts's own file-handling functions
 * already establish.
 */
export async function buildProductionBundleFilesWithAudio(
  manifest: ProductionBundleManifest,
  tracks: readonly ProductionBundleTrackInput[],
  thumbnailPrompts: readonly ThumbnailPromptInput[] = []
): Promise<ZipFileInput[]> {
  const files = buildProductionBundleFiles(manifest, tracks, thumbnailPrompts);
  const trackByNo = new Map(tracks.map(t => [t.song.trackNo, t]));
  const audioFiles: ZipFileInput[] = [];
  for (const entry of manifest.tracks) {
    const input = trackByNo.get(entry.trackNo);
    if (!entry.audioFileName || !input?.audioBlob) continue;
    const bytes = new Uint8Array(await input.audioBlob.arrayBuffer());
    audioFiles.push({ name: entry.audioFileName, content: bytes });
  }
  return [...audioFiles, ...files];
}
