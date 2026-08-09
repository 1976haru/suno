import type { PlaylistBlueprint, SongIdea, WorkspaceId } from '../types';
import { BUILD_INFO } from './buildInfo';
import type { AudioArchiveEntry } from './audioArchive';
import type { AudioTake } from './audioTakes';
import { getTakes } from './audioTakes';
import type { RatingRecord, SongRating } from './ratingLedger';
import { getRatings } from './ratingLedger';
import { listFullPacksForWorkspace } from './library';
import { currentWorkspaceId } from './workspaceScope';
import { buildSetName } from '../utils/setNaming';
import { buildSongCode, buildTakeCode } from './setCode';
import { lyricWordAndSectionCounts } from './compositionScorer';
import { eraBucketForGenreId } from '../data/eraExclusions';
import { TEMPO_LOW_CONFIDENCE_THRESHOLD } from './audioAnalysis';
import { evaluateGenerationGate } from './generationGate';
import { auditPromises } from './promiseAudit';
import { downloadBlob } from '../utils/exporters';

/**
 * v3.79 (TASK D) — 하루님's own request: "음원분석도 데이터잖아... 엑셀 등으로
 * 출력도 하면 좋을 것 같아... 통계적으로 관리가 되어야 하잖아." Two CSV sheets:
 * a per-take ledger (Sheet 1) and a cumulative per-set summary (Sheet 2).
 * Hand-rolled CSV (no xlsx/sheetjs/papaparse — this app stays a single
 * dependency-light build), UTF-8 with a BOM prefix so Excel opens Korean
 * text correctly without a manual encoding step.
 */

// ---------------------------------------------------------------------------
// CSV primitives (RFC 4180-ish: quote a field only when it needs it, double
// any embedded quote, CRLF row separators — the format Excel expects).
// ---------------------------------------------------------------------------

const NEEDS_QUOTING = /[",\r\n]/;

export function csvField(value: string | number): string {
  const text = String(value);
  if (!NEEDS_QUOTING.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function csvRow(fields: readonly (string | number)[]): string {
  return fields.map(csvField).join(',');
}

export function buildCsvText(header: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  return [csvRow(header), ...rows.map(csvRow)].join('\r\n');
}

/** UTF-8 BOM (U+FEFF) — Excel needs this leading byte sequence to open a CSV with Korean text without a manual "파일 > 가져오기 > 인코딩 선택" step. */
const UTF8_BOM = '﻿';

/** Pure — kept separate from downloadCsv (below) so the BOM-prepend step is unit-testable without a browser DOM (this app's test environment is plain Node — see vitest.config.ts). */
export function withUtf8Bom(csvText: string): string {
  return UTF8_BOM + csvText;
}

/**
 * v5.14 — a leading `#`-comment line carrying this build's version identity
 * (same shape as utils/exporters.ts's exportCsv metaLine), so a take-ledger
 * or set-summary sheet opened months later can be traced back to the app
 * version/commit/schema that produced it. Deliberately NOT folded into
 * buildTakeLedgerCsv/buildSetSummaryCsv/buildArchiveTrackCsv/
 * buildChannelArchiveSummaryCsv themselves — those functions' return values
 * are asserted on by line-index/line-count in tests/csvExport.test.ts
 * (header at line 0, first data row at line 1, exact `toHaveLength` counts);
 * adding a line there would break every one of those assertions for no
 * benefit. Applied once, here, at the point where a CSV actually leaves the
 * browser — kept pure (no BOM) for the same unit-testability reason as
 * withUtf8Bom above.
 */
export function withBuildInfoComment(csvText: string): string {
  const { appVersion, commitSha, schemaVersion, builtAt } = BUILD_INFO;
  return `# haru-studio ${appVersion} · commit ${commitSha} · schema ${schemaVersion} · built ${builtAt}\r\n${csvText}`;
}

/** The one non-pure function in this module: hands the BOM-prefixed, build-info-commented CSV text off to utils/exporters.ts's existing downloadBlob (Blob + anchor-click download). */
export function downloadCsv(filename: string, csvText: string): void {
  downloadBlob(filename, new Blob([withUtf8Bom(withBuildInfoComment(csvText))], { type: 'text/csv;charset=utf-8' }));
}

// ---------------------------------------------------------------------------
// Shared context: everything Sheet 1 and Sheet 2 both need about one set,
// whether it's the pack currently open in the editor (not yet reloaded from
// storage) or a historical SavedPack loaded from core/library.ts.
// ---------------------------------------------------------------------------

export interface SetContext {
  blueprint: PlaylistBlueprint;
  channelName: string;
  customConcept: string;
  workspaceId: WorkspaceId;
  /** ISO timestamp — savePack's savedAt for a historical pack, "now" for a set still only open in the editor. Only used as a fallback when blueprint.generatedAt is absent. */
  savedAt: string;
}

/**
 * The composite key both core/audioTakes.ts's AudioTake.packId and
 * core/ratingLedger.ts's RatingRecord.packId are actually keyed by in this
 * app (see src/components/steps/Step4Result.tsx's own `packId` — this is
 * that exact formula, duplicated rather than imported since Step4Result.tsx
 * doesn't export it; it's one stable line already relied on by two other
 * storage modules).
 */
export function packIdForBlueprint(blueprint: Pick<PlaylistBlueprint, 'channelName' | 'projectTitle' | 'songs'>): string {
  return `${blueprint.channelName}::${blueprint.projectTitle}::${blueprint.songs.length}`;
}

function resolvedConceptLabel(ctx: SetContext): string {
  return ctx.customConcept?.trim() || ctx.blueprint.oneLineConcept || ctx.blueprint.projectTitle;
}

function resolvedSetName(ctx: SetContext): string {
  return buildSetName({
    date: new Date(ctx.blueprint.generatedAt || ctx.savedAt),
    channelLabel: ctx.channelName,
    conceptLabel: resolvedConceptLabel(ctx)
  });
}

// ---------------------------------------------------------------------------
// Sheet 1 — take ledger (one row per AudioTake).
// ---------------------------------------------------------------------------

export const TAKE_LEDGER_HEADER = [
  '테이크코드', '세트코드', '트랙번호', '버전', '채택여부', '평가',
  '세트명', '컨셉', '워크스페이스', '제목', '훅', '장르ID', '시대버킷',
  '보컬타입', '보컬서술', '킬링포인트ID', '아크구간', '지시BPM', '실측BPM',
  '지시길이', '실측길이(초)', '진폭(dB)', '최대구간(1~10)', '믹스중심(Hz)',
  '저역비중(%)', '가사단어수', '섹션수', '분석일시',
  // v5.11 (TASK L) — SongIdea's always-populated "what actually went into
  // this song" fields (types.ts's own doc comment on each). Appended at the
  // end (never inserted mid-row) so every existing positional column index
  // this file's own tests already assert on (보컬타입 at 13, 실측BPM at 18,
  // etc.) stays unchanged. `워크스페이스` above already carries
  // ctx.workspaceId (the same value as song.workspaceId for a real
  // generated song, since a pack's songs all belong to the one workspace it
  // was generated in) — song.workspaceId itself is deliberately NOT
  // duplicated as its own column for that reason.
  '실제머니코드ID', '실제보컬프리셋ID', '실제장르ID목록', '실제채널아키타입'
] as const;

const RATING_LABEL: Record<SongRating, string> = { good: '좋음', ok: '보통', bad: '별로' };

/** male->남 / female->여 / mixed->듀엣 — matches this app's own established convention that a 'mixed' adult vocalType means duet, not a choir (see core/localGenerator.ts's "'mixed' means duet there, not choir"). */
const VOCAL_TYPE_LABEL: Record<string, string> = { male: '남', female: '여', mixed: '듀엣' };

export function takeLedgerFileName(setCode: string): string {
  return `${setCode}_테이크.csv`;
}

/** Y (this take is the adopted one) / N (a different take of the same song was adopted instead) / 미정 (no take of this song has been adopted yet). */
function adoptedFlag(take: AudioTake, sameSongTakes: readonly AudioTake[]): 'Y' | 'N' | '미정' {
  if (take.adopted) return 'Y';
  return sameSongTakes.some(t => t.adopted) ? 'N' : '미정';
}

function takeLedgerRow(ctx: SetContext, take: AudioTake, song: SongIdea, ratings: readonly RatingRecord[], sameSongTakes: readonly AudioTake[]): (string | number)[] {
  const setCode = ctx.blueprint.meta!.setCode!;
  const songCode = song.songCode || buildSongCode(setCode, take.trackNo);
  const rating = ratings.find(r => r.songId === take.songId);
  const eraBucket = eraBucketForGenreId(take.directives.genreId) ?? eraBucketForGenreId(song.genreId) ?? '-';
  const vocalLabel = VOCAL_TYPE_LABEL[take.directives.vocalType] ?? '-';
  const reliableBpm = take.tempoEstimate.confidence >= TEMPO_LOW_CONFIDENCE_THRESHOLD ? Math.round(take.tempoEstimate.bpm) : null;
  const { words, sections } = lyricWordAndSectionCounts(song.lyrics);
  return [
    buildTakeCode(songCode, take.versionLabel),
    setCode,
    take.trackNo,
    take.versionLabel,
    adoptedFlag(take, sameSongTakes),
    rating ? RATING_LABEL[rating.rating] : '미평가',
    resolvedSetName(ctx),
    resolvedConceptLabel(ctx),
    ctx.workspaceId,
    song.title,
    song.hookPhrase,
    take.directives.genreId,
    eraBucket,
    vocalLabel,
    take.directives.vocalDescriptor,
    take.directives.killingPointId || '-',
    take.directives.arcPhase || '-',
    take.directives.targetBpm || song.bpm || '-',
    reliableBpm === null ? '-' : reliableBpm,
    `${take.directives.targetDurationSec[0]}~${take.directives.targetDurationSec[1]}초`,
    take.metrics.durationSec.toFixed(1),
    take.metrics.overallLevel.toFixed(1),
    // v3.79 (TASK D) — "최대구간(1~10)": peakPosition (0..1, see
    // core/audioAnalysis.ts) rescaled to a 1-10 reading by simple
    // multiplication rather than bucketing into the 20-segment RMS curve —
    // reads just as sensibly and needs no second constant imported from
    // audioAnalysis.ts. Clamped up to 1 so a peak at the very first segment
    // (peakPosition 0) still reads as segment 1, never 0.
    Math.max(1, Math.round(take.metrics.peakPosition * 10)),
    Math.round(take.vocalMetrics.vocalCentroid),
    Math.round(take.metrics.lowBandRatio * 100),
    words,
    sections,
    take.analyzedAt,
    // v5.11 (TASK L) — see TAKE_LEDGER_HEADER's own doc comment for why
    // these 4 (not 5 — workspaceId is intentionally not duplicated) are
    // appended here. `song` already carries real, always-populated values
    // for every song that went through either real generation path (see
    // core/localGenerator.ts's generateLocalBlueprint / core/
    // batchPreallocation.ts's reconcileWithPreassignedSlot) — no extra
    // threading needed, `song` was already in scope in this function.
    song.effectiveMoneyChordId || '-',
    song.effectiveVocalPresetId || '-',
    song.effectiveGenreIds?.length ? song.effectiveGenreIds.join(' · ') : '-',
    song.effectiveArchetype || '-'
  ];
}

/**
 * One row per AudioTake — a song never audio-analyzed simply doesn't appear
 * (this is a ledger of actual takes, not a full song roster). Returns a
 * header-only CSV if the set has no assigned setCode yet (not saved) or no
 * takes at all.
 */
export function buildTakeLedgerCsv(ctx: SetContext, takes: readonly AudioTake[], ratings: readonly RatingRecord[]): string {
  const setCode = ctx.blueprint.meta?.setCode;
  if (!setCode) return buildCsvText(TAKE_LEDGER_HEADER, []);

  const songById = new Map(ctx.blueprint.songs.filter(s => s.songId).map(s => [s.songId as string, s]));
  const songByTrackNo = new Map(ctx.blueprint.songs.map(s => [s.trackNo, s]));

  const rows = takes
    .map(take => {
      const song = (take.songId && songById.get(take.songId)) || songByTrackNo.get(take.trackNo);
      if (!song) return null;
      const sameSongTakes = takes.filter(t => t.songId === take.songId);
      return takeLedgerRow(ctx, take, song, ratings, sameSongTakes);
    })
    .filter((row): row is (string | number)[] => row !== null);

  return buildCsvText(TAKE_LEDGER_HEADER, rows);
}

// ---------------------------------------------------------------------------
// Sheet 2 — cumulative set summary (one row per set).
// ---------------------------------------------------------------------------

export const SET_SUMMARY_HEADER = [
  '세트코드', '세트명', '컨셉', '워크스페이스', '생성일',
  '곡수', '테이크수', '채택수', '평가완료수',
  '관문1통과', '관문2통과', '약속이행도',
  '평균길이(초)', '길이표준편차', 'BPM평균', 'BPM표준편차', 'BPM범위',
  '보컬서술종류', '보컬타입분포', '장르종류', '시대분포',
  '평균진폭(dB)', '후반상승곡수', '좋음비율', '채택률'
] as const;

export const SET_SUMMARY_FILENAME = '세트요약.csv';

function mean(values: readonly number[]): number | null {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

/** Population standard deviation — descriptive-only (this is one set's own realized measurements, not a generalized inference), so no sample-vs-population distinction matters here. */
function stddev(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values)!;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length);
}

function percent(count: number, total: number): string {
  return total > 0 ? `${Math.round((count / total) * 100)}%` : '-';
}

function distributionLabel(counts: Map<string, number>): string {
  return [...counts.entries()].map(([label, count]) => `${label} ${count}`).join(' / ') || '-';
}

export interface SetSummaryRow {
  setCode: string;
  cells: (string | number)[];
}

/**
 * Builds one Sheet-2 row for a set. `gate1Passed` (core/designGate.ts's
 * evaluateDesignGate) is always '-': it needs PreassignedSongSlot[], the
 * pre-generation slot data this app never persists onto a saved
 * SongIdea/blueprint — there is no synthetic input that would make that
 * column honest after the fact, so it stays blank rather than guessed (see
 * this task's own explicit instruction). `gate2Passed`/`promiseFulfillment`
 * ARE computable from the persisted SongIdea[] + concept text alone, so
 * they're real, not blank.
 */
export function buildSetSummaryRow(ctx: SetContext, takes: readonly AudioTake[], ratings: readonly RatingRecord[]): SetSummaryRow | null {
  const setCode = ctx.blueprint.meta?.setCode;
  if (!setCode) return null;

  const songs = ctx.blueprint.songs;
  const conceptLabel = resolvedConceptLabel(ctx);
  const adoptedCount = takes.filter(t => t.adopted).length;

  const gate2 = songs.length ? evaluateGenerationGate(songs, { conceptLabel }) : null;
  const promiseReport = songs.length && conceptLabel.trim() ? auditPromises(songs, conceptLabel) : null;
  const promiseFulfillment = promiseReport && promiseReport.promises.length
    ? `${Math.round(promiseReport.overallFulfillment * 100)}%`
    : '-';

  const durations = takes.map(t => t.metrics.durationSec);
  const amplitudes = takes.map(t => t.metrics.overallLevel);
  const reliableBpms = takes.filter(t => t.tempoEstimate.confidence >= TEMPO_LOW_CONFIDENCE_THRESHOLD).map(t => t.tempoEstimate.bpm);
  // v3.79 (TASK D) — "후반상승곡수": reuses core/audioAnalysis.ts's own
  // documented reading of peakPosition ("`>= 0.75 reads as a late/
  // killing-point-style lift`"), the same threshold that field's own doc
  // comment already establishes — not a new number invented for this sheet.
  const lateLiftCount = takes.filter(t => t.metrics.peakPosition >= 0.75).length;

  const vocalDescriptors = new Set(takes.map(t => t.directives.vocalDescriptor).filter(Boolean));
  const vocalTypeCounts = new Map<string, number>();
  for (const song of songs) {
    const label = (song.vocalType && VOCAL_TYPE_LABEL[song.vocalType]) || '-';
    vocalTypeCounts.set(label, (vocalTypeCounts.get(label) || 0) + 1);
  }
  const genreVariety = new Set(songs.map(s => s.genreId).filter(Boolean)).size;
  const eraCounts = new Map<string, number>();
  for (const song of songs) {
    const bucket = eraBucketForGenreId(song.genreId) ?? '기타';
    eraCounts.set(bucket, (eraCounts.get(bucket) || 0) + 1);
  }

  const durationMean = mean(durations);
  const durationStd = stddev(durations);
  const bpmMean = mean(reliableBpms);
  const bpmStd = stddev(reliableBpms);
  const amplitudeMean = mean(amplitudes);

  return {
    setCode,
    cells: [
      setCode,
      resolvedSetName(ctx),
      conceptLabel,
      ctx.workspaceId,
      (ctx.blueprint.generatedAt || ctx.savedAt).slice(0, 10),
      songs.length,
      takes.length,
      adoptedCount,
      ratings.length,
      '-',
      gate2 ? (gate2.passed ? 'Y' : 'N') : '-',
      promiseFulfillment,
      durationMean === null ? '-' : durationMean.toFixed(1),
      durationStd === null ? '-' : durationStd.toFixed(1),
      bpmMean === null ? '-' : Math.round(bpmMean),
      bpmStd === null ? '-' : bpmStd.toFixed(1),
      reliableBpms.length ? `${Math.min(...reliableBpms)}~${Math.max(...reliableBpms)}` : '-',
      vocalDescriptors.size,
      distributionLabel(vocalTypeCounts),
      genreVariety,
      distributionLabel(eraCounts),
      amplitudeMean === null ? '-' : amplitudeMean.toFixed(1),
      lateLiftCount,
      percent(ratings.filter(r => r.rating === 'good').length, ratings.length),
      percent(adoptedCount, takes.length)
    ]
  };
}

export function buildSetSummaryCsv(rows: readonly SetSummaryRow[]): string {
  return buildCsvText(SET_SUMMARY_HEADER, rows.map(row => row.cells));
}

/**
 * v3.79 (TASK D) — "전체 누적": rather than persisting a running list of
 * past CSV exports (a new IndexedDB store, or asking the user to re-upload
 * their last export), every "전체 누적" click recomputes Sheet 2 fresh from
 * every saved pack that already has a setCode, in the current workspace.
 * This is simpler than either option the spec sketched, needs no new
 * storage, and can never drift or double-count a set across repeated
 * exports the way an append-only running list could — the tradeoff is
 * recomputing gate2/promise-audit for every historical set on every export,
 * cheap enough for the pack counts this app actually deals with (dozens,
 * not thousands).
 */
export async function gatherAllSetSummaryRows(): Promise<SetSummaryRow[]> {
  const workspaceId = currentWorkspaceId();
  const [packs, allTakes, allRatings] = await Promise.all([
    listFullPacksForWorkspace(workspaceId),
    getTakes(),
    getRatings()
  ]);

  const rows: SetSummaryRow[] = [];
  for (const pack of packs) {
    if (pack.isAutosave || !pack.blueprint.meta?.setCode) continue;
    const packId = packIdForBlueprint(pack.blueprint);
    const ctx: SetContext = {
      blueprint: pack.blueprint,
      channelName: pack.channelName,
      customConcept: pack.options?.customConcept ?? '',
      workspaceId,
      savedAt: pack.savedAt
    };
    const row = buildSetSummaryRow(
      ctx,
      allTakes.filter(t => t.packId === packId),
      allRatings.filter(r => r.packId === packId)
    );
    if (row) rows.push(row);
  }
  return rows.sort((a, b) => a.setCode.localeCompare(b.setCode));
}

// ---------------------------------------------------------------------------
// v4.15 (TASK B) — 음원 분석 아카이브 CSV (§2-7): reuses buildCsvText/
// withUtf8Bom above rather than a third hand-rolled CSV writer. Sheet 1 is
// one archive's own tracks; Sheet 2 is every archive saved for one channel,
// appended to as new sets get analyzed (see gatherAllSetSummaryRows's own
// doc comment above for why "recompute fresh from storage" beats persisting
// a running list — the same reasoning applies here).
// ---------------------------------------------------------------------------

export const ARCHIVE_TRACK_HEADER = [
  '트랙번호', '파일명', '버전', '채택여부', '평가',
  '길이(초)', '진폭(dB)', '최대구간(0~1)', '믹스중심(Hz)', '보컬대역중심(Hz)', '실측BPM'
] as const;

export function archiveTrackCsvFileName(archiveLabel: string): string {
  return `${archiveLabel}_테이크.csv`;
}

export function buildArchiveTrackCsv(entry: AudioArchiveEntry): string {
  const rows = entry.tracks.map(t => [
    t.trackNo ?? '-',
    t.fileName,
    t.version ?? '-',
    t.adopted === undefined ? '-' : t.adopted ? 'Y' : 'N',
    t.rating ? RATING_LABEL[t.rating] : '미평가',
    t.durationSec.toFixed(1),
    t.dynamicRange.toFixed(1),
    t.peakPosition.toFixed(2),
    Math.round(t.spectralCentroid),
    Math.round(t.vocalBandCentroid),
    t.tempoEstimate === undefined ? '-' : Math.round(t.tempoEstimate)
  ]);
  return buildCsvText(ARCHIVE_TRACK_HEADER, rows);
}

export const CHANNEL_ARCHIVE_SUMMARY_HEADER = [
  '아카이브명', '채널', '회차', '워크스페이스', '분석일시',
  '곡수', '평균길이(초)', '길이범위', '목표범위내곡수', '평균진폭(dB)', '후반상승곡수', 'BPM범위'
] as const;

export function channelArchiveSummaryCsvFileName(channelSlug: string): string {
  return `${channelSlug}_세트요약.csv`;
}

/** One row per archive, in the order given (callers pass listArchives()'s already-chronological result, same "recompute fresh" shape as gatherAllSetSummaryRows). */
export function buildChannelArchiveSummaryCsv(archives: readonly AudioArchiveEntry[]): string {
  const rows = archives.map(a => {
    const [tempoLo, tempoHi] = a.summary.tempoRange;
    return [
      a.archiveLabel,
      a.channelSlug ?? '-',
      a.sequence ?? '-',
      a.workspaceId,
      a.analyzedAt,
      a.trackCount,
      a.summary.avgDuration.toFixed(1),
      `${a.summary.durationRange[0].toFixed(0)}~${a.summary.durationRange[1].toFixed(0)}`,
      a.summary.inTargetRange,
      a.summary.avgDynamicRange.toFixed(1),
      a.summary.lateRiseCount,
      tempoLo || tempoHi ? `${Math.round(tempoLo)}~${Math.round(tempoHi)}` : '-'
    ];
  });
  return buildCsvText(CHANNEL_ARCHIVE_SUMMARY_HEADER, rows);
}
