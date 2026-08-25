import type { WorkspaceId } from '../types';
import type { SongAudioMetrics, TempoEstimate, VocalMetrics } from './audioAnalysis';
import { TEMPO_LOW_CONFIDENCE_THRESHOLD } from './audioAnalysis';
import { ARCHIVES_STORE, withAudioStore } from './audioDb';
import { currentWorkspaceId, DEFAULT_WORKSPACE_ID, scopeFilter } from './workspaceScope';

/**
 * TASK v4.15 (TASK B) — "음원 분석 아카이브": 하루님's own naming convention
 * ("oldpoplounge2st" = oldpoplounge 채널, 2번째 영상) preserved verbatim as the
 * primary key, with a best-effort channelSlug/sequence parse attached
 * alongside for filtering — never replacing the raw label, and never
 * blocking a save when parsing fails (§5 "이름 파싱이 실패해도 저장을 막지 말
 * 것"). Only measurement VALUES are stored, never the audio file itself
 * (§5 "음원 파일을 저장소에 저장하지 말 것" — 18 songs × 2 versions × ~5MB would
 * be ~180MB, the same math core/audioTakes.ts's own doc comment already
 * made for the same reason).
 *
 * Storage: a new 'archives' object store in the EXISTING suno-weaver-audio
 * database (not a new database) — see core/audioDb.ts's own doc comment for
 * why that DB's open/upgrade step had to move to a shared module once a
 * second store was added.
 */

export interface AudioArchiveTrackEntry {
  trackNo?: number;
  fileName: string;
  /** 'A'/'B'/... — see core/audioTrackMatch.ts's deriveVersionLabel. */
  version?: string;
  adopted?: boolean;
  durationSec: number;
  dynamicRange: number;
  peakPosition: number;
  spectralCentroid: number;
  vocalBandCentroid: number;
  tempoEstimate?: number;
  rating?: 'good' | 'ok' | 'bad';
}

export interface AudioArchiveSummary {
  avgDuration: number;
  durationRange: [number, number];
  inTargetRange: number;
  avgDynamicRange: number;
  /** peakPosition >= 0.75 — same "late lift" threshold audioSetReport.ts already established. */
  lateRiseCount: number;
  tempoRange: [number, number];
}

export interface AudioArchiveEntry {
  /** 하루님이 입력한 이름 그대로. */
  archiveLabel: string;
  /** 파싱 결과. 실패해도 archiveLabel 은 보존. */
  channelSlug?: string;
  sequence?: number;

  workspaceId: WorkspaceId;
  packId?: string;
  setName?: string;

  analyzedAt: string;
  trackCount: number;

  tracks: AudioArchiveTrackEntry[];
  summary: AudioArchiveSummary;
}

// ---------------------------------------------------------------------------
// Pure — label parsing, summary/track-entry construction. No IndexedDB, so
// fully unit-testable under vitest's node environment.
// ---------------------------------------------------------------------------

export interface ParsedArchiveLabel {
  channelSlug?: string;
  sequence?: number;
}

/**
 * §2-2 — "oldpoplounge2st" -> channelSlug 'oldpoplounge', sequence 2 (the
 * trailing 'st' is just part of 하루님's own label text, not a separate
 * field — archiveLabel keeps it verbatim). Non-greedy leading-letters match
 * so the FIRST digit run found is treated as the sequence number, matching
 * the one real example this task's own spec gives. Returns {} (both fields
 * undefined) for anything that doesn't fit — e.g. a label with no digits at
 * all — never throws; the caller always keeps archiveLabel regardless.
 */
const ARCHIVE_LABEL_PATTERN = /^([a-zA-Z][a-zA-Z0-9]*?)(\d+)([a-zA-Z0-9]*)$/;

export function parseArchiveLabel(archiveLabel: string): ParsedArchiveLabel {
  const match = ARCHIVE_LABEL_PATTERN.exec(archiveLabel.trim());
  if (!match) return {};
  const [, channelSlug, sequenceStr] = match;
  const sequence = Number.parseInt(sequenceStr, 10);
  if (!channelSlug || !Number.isFinite(sequence)) return {};
  return { channelSlug, sequence };
}

const LATE_RISE_THRESHOLD = 0.75;

/** Pure — one track's archive row from the same FullAudioAnalysis shape AudioAnalysisPanel/audioTakes.ts already compute per file, so this needs no separate measurement pass. */
export function buildArchiveTrackEntry(
  full: { metrics: SongAudioMetrics; vocalMetrics: VocalMetrics; tempoEstimate: TempoEstimate },
  options: { trackNo?: number; version?: string; adopted?: boolean; rating?: 'good' | 'ok' | 'bad' } = {}
): AudioArchiveTrackEntry {
  return {
    trackNo: options.trackNo,
    fileName: full.metrics.fileName,
    version: options.version,
    adopted: options.adopted,
    durationSec: full.metrics.durationSec,
    dynamicRange: full.metrics.dynamicRange,
    peakPosition: full.metrics.peakPosition,
    spectralCentroid: full.metrics.spectralCentroid,
    vocalBandCentroid: full.vocalMetrics.vocalCentroid,
    tempoEstimate: full.tempoEstimate.confidence >= TEMPO_LOW_CONFIDENCE_THRESHOLD ? full.tempoEstimate.bpm : undefined,
    rating: options.rating
  };
}

/** Pure — the set-level summary block, against `targetRangeSec` (the caller's own AudienceProfile.songLengthSecondsRange, same target buildAudioSetReport judges duration against). */
export function buildArchiveSummary(tracks: readonly AudioArchiveTrackEntry[], targetRangeSec: [number, number]): AudioArchiveSummary {
  const durations = tracks.map(t => t.durationSec);
  const dynamicRanges = tracks.map(t => t.dynamicRange);
  const tempos = tracks.map(t => t.tempoEstimate).filter((t): t is number => t !== undefined);
  const [lo, hi] = targetRangeSec;

  return {
    avgDuration: mean(durations),
    durationRange: durations.length ? [Math.min(...durations), Math.max(...durations)] : [0, 0],
    inTargetRange: durations.filter(d => d >= lo && d <= hi).length,
    avgDynamicRange: mean(dynamicRanges),
    lateRiseCount: tracks.filter(t => t.peakPosition >= LATE_RISE_THRESHOLD).length,
    tempoRange: tempos.length ? [Math.min(...tempos), Math.max(...tempos)] : [0, 0]
  };
}

function mean(values: readonly number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/** Pure — assembles a full AudioArchiveEntry from already-measured tracks. Never throws on an unparseable archiveLabel (channelSlug/sequence just stay undefined; archiveLabel is stored as given). */
export function buildArchiveEntry(params: {
  archiveLabel: string;
  workspaceId?: WorkspaceId;
  packId?: string;
  setName?: string;
  tracks: AudioArchiveTrackEntry[];
  targetRangeSec: [number, number];
  analyzedAt?: string;
}): AudioArchiveEntry {
  const parsed = parseArchiveLabel(params.archiveLabel);
  return {
    archiveLabel: params.archiveLabel,
    channelSlug: parsed.channelSlug,
    sequence: parsed.sequence,
    workspaceId: params.workspaceId ?? currentWorkspaceId(),
    packId: params.packId,
    setName: params.setName,
    analyzedAt: params.analyzedAt ?? new Date().toISOString(),
    trackCount: params.tracks.length,
    tracks: params.tracks,
    summary: buildArchiveSummary(params.tracks, params.targetRangeSec)
  };
}

export interface ArchiveTrendPoint {
  archiveLabel: string;
  analyzedAt: string;
  avgDuration: number;
  avgDynamicRange: number;
  inTargetRange: number;
  trackCount: number;
}

/** Pure — §2-6's "추이" section: the same archives listArchives() already returns, reshaped chronologically into the 3+ metrics the spec calls out (avg length / dynamic range / in-target-range count) plus trackCount for context. */
export function buildArchiveTrend(archives: readonly AudioArchiveEntry[]): ArchiveTrendPoint[] {
  return [...archives]
    .sort((a, b) => a.analyzedAt.localeCompare(b.analyzedAt))
    .map(a => ({
      archiveLabel: a.archiveLabel,
      analyzedAt: a.analyzedAt,
      avgDuration: a.summary.avgDuration,
      avgDynamicRange: a.summary.avgDynamicRange,
      inTargetRange: a.summary.inTargetRange,
      trackCount: a.trackCount
    }));
}

// ---------------------------------------------------------------------------
// IndexedDB — the three functions §2-3 specifies verbatim.
// ---------------------------------------------------------------------------

export async function saveArchive(entry: AudioArchiveEntry): Promise<void> {
  await withAudioStore(ARCHIVES_STORE, 'readwrite', store => store.put({ ...entry, workspaceId: entry.workspaceId ?? currentWorkspaceId() }));
}

export async function listArchives(filter?: { workspaceId?: WorkspaceId; channelSlug?: string }): Promise<AudioArchiveEntry[]> {
  const all = await withAudioStore<AudioArchiveEntry[]>(ARCHIVES_STORE, 'readonly', store => store.getAll());
  return scopeFilter(all, filter?.workspaceId)
    .filter(a => !filter?.channelSlug || a.channelSlug === filter.channelSlug)
    .sort((a, b) => a.analyzedAt.localeCompare(b.analyzedAt));
}

export async function deleteArchive(archiveLabel: string): Promise<void> {
  await withAudioStore(ARCHIVES_STORE, 'readwrite', store => store.delete(archiveLabel));
}

/** §2-5 — "이름이 이미 있으면 '덮어쓸까요?'" — a plain existence check so the UI can gate the overwrite-confirm prompt before calling saveArchive (saveArchive itself always just overwrites — keyPath is archiveLabel, so a second save under the same name is inherently an overwrite either way). */
export async function archiveExists(archiveLabel: string, workspaceId: WorkspaceId = currentWorkspaceId()): Promise<boolean> {
  const existing = await withAudioStore<AudioArchiveEntry | undefined>(ARCHIVES_STORE, 'readonly', store => store.get(archiveLabel));
  return !!existing && (existing.workspaceId ?? DEFAULT_WORKSPACE_ID) === workspaceId;
}
