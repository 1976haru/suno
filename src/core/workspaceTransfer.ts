import type { ChannelProfile, SavedPack, WorkspaceId } from '../types';
import { getWorkspace, workspaceDefinitions } from '../data/workspaces';
import { currentWorkspaceId, scopedKey } from './workspaceScope';
import { findPackByName, listFullPacksForWorkspace, putFullPack } from './library';
import { type HookUsage, listAllHooksForWorkspace, putHookRecord } from './hookLedger';
import { type SituationUsage, listAllSituationsForWorkspace, putSituationRecord } from './situationLedger';
import { type LyricLineUsage, listAllLyricLinesForWorkspace, putLyricLineRecord } from './lyricLineLedger';
import { getRatingForSong, listAllRatingsForWorkspace, recordRating, type RatingRecord } from './ratingLedger';
import { listAllVideosForWorkspace, putVideoRecordIfNewer, type VideoRecord } from './videoLedger';
import { listAllUsageForWorkspace, putUsageRecord, type UsageRecord } from './usageLedger';
import { type AudioTake, listAllTakesForWorkspace, putTakeIfNewer } from './audioTakes';
import { mergeStoredChannels, readStoredChannelsForWorkspace } from '../utils/channelProfile';
import { genreSanitizationWarningKo, sanitizeGenreIdsForArchetype } from './genreSelection';
import { getSetting, setSetting } from './settingsStore';
import type { DiversityAllocationTemplate } from './diversityAllocationStore';
import type { ThumbnailBrandTemplate } from '../types';
import { parseJsonFileResponsive } from './backupImportClient';
import { APP_VERSION, BUILT_AT, COMMIT_SHA } from './buildInfo';
import { EXPORT_SCHEMA_VERSION } from './exportMeta';
import { scrubBlueprintSnapshotSecrets } from './generationSnapshot';

/**
 * v4.1 (TASK A2) — "워크스페이스 데이터 이동": A1 gave every workspace its own
 * isolated slice of storage; this makes that slice portable between
 * computers (and between family members) as one human-readable JSON file.
 *
 * Deliberately generalized over `workspaceId` (this task's own §11 "특정
 * 워크스페이스에만 맞는 코드를 쓰지 마십시오") — every function here takes an
 * explicit `WorkspaceId` and works identically for all 5, including the 4
 * still-skeletal ones (they simply export near-empty files today).
 *
 * `suno-weaver-batch`(일시적 상태) and `suno-weaver-cache`(재생성 가능)는
 * 스펙 §1-1이 명시적으로 제외한 대상이라 이 파일 어디에도 다루지 않습니다.
 */

export const TRANSFER_FORMAT = 'suno-weaver-workspace';
export const TRANSFER_BUNDLE_FORMAT = 'suno-weaver-workspace-bundle';
export const TRANSFER_FORMAT_VERSION = 1;
/**
 * v4.0 (TASK C) — this used to be its own hardcoded '4.1' because
 * package.json's own "version" had gone stale (3.6.0, vs the actual commit
 * history at v3.79) — this task's whole point is making package.json
 * authoritative again (bumped to 4.0.0, kept in sync going forward), so
 * this now reads the real thing instead of shadowing it with a second,
 * independently-maintained number.
 */
export const CURRENT_APP_VERSION = APP_VERSION;

// Raw settingsStore/localStorage key names, duplicated here (not imported)
// because diversityAllocationStore.ts/thumbnailBrandStore.ts/recentGenreStore.ts/
// Step1Channel.tsx don't export them — they're private implementation detail
// in those modules. A future rename of any of these keys must be mirrored
// here too; documented as a known coupling point (see docs/v4.1-a2-report.md).
const DIVERSITY_ALLOCATION_INDEX_KEY = 'diversityAllocationChannels';
const THUMBNAIL_BRAND_INDEX_KEY = 'thumbnailBrandChannels';
const RECENT_GENRES_KEY = 'suno-weaver-recent-genres-v1';
const KIDS_BANNER_DISMISSED_KEY = 'kidsChannelBannerDismissed';
const API_KEY_SETTINGS_KEYS = ['byok:openai', 'byok:anthropic', 'byok:qwen', 'byok:gemini'] as const;

export interface ExportInclude {
  packs: boolean;
  hooks: boolean;
  /** v5.22 (AXIS 1) — same category as hooks (a generation-history ledger), always exported/imported together with it. */
  situations: boolean;
  lyricLines: boolean;
  ratings: boolean;
  takes: boolean;
  videos: boolean;
  settings: boolean;
  channels: boolean;
  /** default false — spec §1-1 "⚪ 선택" */
  usage: boolean;
  /** default false — spec §2-1 "경고 필수". Never true unless the caller explicitly sets it. */
  apiKeys: boolean;
}

export const DEFAULT_EXPORT_INCLUDE: ExportInclude = {
  packs: true, hooks: true, situations: true, lyricLines: true, ratings: true, takes: true, videos: true, settings: true, channels: true, usage: false, apiKeys: false
};

export interface ExportOptions {
  workspaceId: WorkspaceId;
  include?: Partial<ExportInclude>;
}

interface DiversityAllocationSettingsBundle {
  channelIds: string[];
  templates: Record<string, DiversityAllocationTemplate>;
}

interface ThumbnailBrandSettingsBundle {
  channelNames: string[];
  templates: Record<string, ThumbnailBrandTemplate>;
}

export interface WorkspaceExportData {
  packs?: SavedPack[];
  hooks?: HookUsage[];
  situations?: SituationUsage[];
  lyricLines?: LyricLineUsage[];
  ratings?: RatingRecord[];
  takes?: AudioTake[];
  videos?: VideoRecord[];
  usage?: UsageRecord[];
  settings?: { diversityAllocation?: DiversityAllocationSettingsBundle; thumbnailBrand?: ThumbnailBrandSettingsBundle };
  channels?: ChannelProfile[];
  localKeys?: { recentGenres?: string; kidsBannerDismissed?: string };
  /** Present only when the exporter explicitly opted in (§2-1's apiKeys:true) — absent, not empty, is the normal/expected case. */
  apiKeys?: Record<string, string>;
}

export interface WorkspaceExportFile {
  format: typeof TRANSFER_FORMAT;
  formatVersion: number;
  appVersion: string;
  /** v4.0 (TASK C) — see core/exportMeta.ts's own doc comment on why this is separate from formatVersion/appVersion. */
  schemaVersion: number;
  commitSha: string;
  /** v5.14 — when this build was produced; 'dev' outside a real `npm run build`. Optional-in-practice on older exported files, which predate this field. */
  builtAt?: string;
  workspaceId: WorkspaceId;
  workspaceLabel: string;
  exportedAt: string;
  counts: Record<string, number>;
  data: WorkspaceExportData;
}

export interface WorkspaceBundleFile {
  format: typeof TRANSFER_BUNDLE_FORMAT;
  formatVersion: number;
  appVersion: string;
  schemaVersion: number;
  commitSha: string;
  /** v5.14 — see WorkspaceExportFile.builtAt's own doc comment. */
  builtAt?: string;
  exportedAt: string;
  workspaces: Record<WorkspaceId, WorkspaceExportFile>;
}

async function gatherDiversityAllocationSettings(workspaceId: WorkspaceId): Promise<DiversityAllocationSettingsBundle | undefined> {
  const channelIds = (await getSetting<string[]>(scopedKey(DIVERSITY_ALLOCATION_INDEX_KEY, workspaceId))) ?? [];
  if (!channelIds.length) return undefined;
  const templates: Record<string, DiversityAllocationTemplate> = {};
  for (const channelId of channelIds) {
    const template = await getSetting<DiversityAllocationTemplate>(scopedKey(`diversityAllocation:${channelId}`, workspaceId));
    if (template) templates[channelId] = template;
  }
  return { channelIds, templates };
}

async function gatherThumbnailBrandSettings(workspaceId: WorkspaceId): Promise<ThumbnailBrandSettingsBundle | undefined> {
  const channelNames = (await getSetting<string[]>(scopedKey(THUMBNAIL_BRAND_INDEX_KEY, workspaceId))) ?? [];
  if (!channelNames.length) return undefined;
  const templates: Record<string, ThumbnailBrandTemplate> = {};
  for (const channelName of channelNames) {
    const template = await getSetting<ThumbnailBrandTemplate>(scopedKey(`thumbnailBrand:${channelName}`, workspaceId));
    if (template) templates[channelName] = template;
  }
  return { channelNames, templates };
}

function readRawLocalKey(rawKey: string, workspaceId: WorkspaceId): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage.getItem(scopedKey(rawKey, workspaceId)) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeRawLocalKey(rawKey: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(scopedKey(rawKey), value);
  } catch {
    // Storage can be blocked in private/embedded contexts; import already succeeded for everything else.
  }
}

export async function exportWorkspace(opts: ExportOptions): Promise<WorkspaceExportFile> {
  const include: ExportInclude = { ...DEFAULT_EXPORT_INCLUDE, ...opts.include };
  const workspace = getWorkspace(opts.workspaceId);
  const data: WorkspaceExportData = {};
  const counts: Record<string, number> = {};

  if (include.packs) {
    const packs = await listFullPacksForWorkspace(opts.workspaceId);
    // v5.17 (TASK A §1-3 item 2) — belt-and-suspenders: listFullPacksForWorkspace
    // already scrubs generationSnapshot secrets via normalizeSavedPack, but
    // this is the one function that actually PRODUCES the backup file a user
    // hands off, so it re-checks independently rather than trusting an
    // upstream call site to have done it — a future refactor that bypasses
    // normalizeSavedPack must not silently reopen this leak.
    data.packs = packs.map(pack => {
      if (!pack.blueprint) return pack;
      const { blueprint, scrubbed } = scrubBlueprintSnapshotSecrets(pack.blueprint);
      return scrubbed ? { ...pack, blueprint } : pack;
    });
    counts.packs = packs.length;
  }
  if (include.hooks) {
    const hooks = await listAllHooksForWorkspace(opts.workspaceId);
    data.hooks = hooks;
    counts.hooks = hooks.length;
  }
  if (include.situations) {
    const situations = await listAllSituationsForWorkspace(opts.workspaceId);
    data.situations = situations;
    counts.situations = situations.length;
  }
  if (include.lyricLines) {
    const lyricLines = await listAllLyricLinesForWorkspace(opts.workspaceId);
    data.lyricLines = lyricLines;
    counts.lyricLines = lyricLines.length;
  }
  if (include.ratings) {
    const ratings = await listAllRatingsForWorkspace(opts.workspaceId);
    data.ratings = ratings;
    counts.ratings = ratings.length;
  }
  if (include.takes) {
    const takes = await listAllTakesForWorkspace(opts.workspaceId);
    data.takes = takes;
    counts.takes = takes.length;
  }
  if (include.videos) {
    const videos = await listAllVideosForWorkspace(opts.workspaceId);
    data.videos = videos;
    counts.videos = videos.length;
  }
  if (include.usage) {
    const usage = await listAllUsageForWorkspace(opts.workspaceId);
    data.usage = usage;
    counts.usage = usage.length;
  }
  if (include.channels) {
    const channels = readStoredChannelsForWorkspace(opts.workspaceId);
    data.channels = channels;
    counts.channels = channels.length;
  }
  if (include.settings) {
    const diversityAllocation = await gatherDiversityAllocationSettings(opts.workspaceId);
    const thumbnailBrand = await gatherThumbnailBrandSettings(opts.workspaceId);
    if (diversityAllocation || thumbnailBrand) data.settings = { diversityAllocation, thumbnailBrand };
    const recentGenres = readRawLocalKey(RECENT_GENRES_KEY, opts.workspaceId);
    const kidsBannerDismissed = readRawLocalKey(KIDS_BANNER_DISMISSED_KEY, opts.workspaceId);
    if (recentGenres !== undefined || kidsBannerDismissed !== undefined) data.localKeys = { recentGenres, kidsBannerDismissed };
  }
  if (include.apiKeys) {
    const apiKeys: Record<string, string> = {};
    for (const key of API_KEY_SETTINGS_KEYS) {
      const value = await getSetting<string>(key);
      if (value) apiKeys[key] = value;
    }
    if (Object.keys(apiKeys).length) data.apiKeys = apiKeys;
  }

  return {
    format: TRANSFER_FORMAT,
    formatVersion: TRANSFER_FORMAT_VERSION,
    appVersion: CURRENT_APP_VERSION,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    commitSha: COMMIT_SHA,
    builtAt: BUILT_AT,
    workspaceId: opts.workspaceId,
    workspaceLabel: workspace.labelKo,
    exportedAt: new Date().toISOString(),
    counts,
    data
  };
}

export async function exportWorkspaceBlob(opts: ExportOptions): Promise<Blob> {
  const file = await exportWorkspace(opts);
  return new Blob([JSON.stringify(file, null, 2)], { type: 'application/json;charset=utf-8' });
}

/**
 * §11 "5개 워크스페이스 전부 같은 함수로 처리" — iterates workspaceDefinitions
 * itself rather than a hardcoded list, so a 6th workspace added by a future
 * document is automatically included with zero changes here.
 */
export async function exportAllWorkspaces(include?: Partial<ExportInclude>): Promise<WorkspaceBundleFile> {
  const workspaces = {} as Record<WorkspaceId, WorkspaceExportFile>;
  for (const workspace of workspaceDefinitions) {
    workspaces[workspace.id] = await exportWorkspace({ workspaceId: workspace.id, include });
  }
  return {
    format: TRANSFER_BUNDLE_FORMAT,
    formatVersion: TRANSFER_FORMAT_VERSION,
    appVersion: CURRENT_APP_VERSION,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    commitSha: COMMIT_SHA,
    builtAt: BUILT_AT,
    exportedAt: new Date().toISOString(),
    workspaces
  };
}

export async function exportAllWorkspacesBlob(include?: Partial<ExportInclude>): Promise<Blob> {
  const bundle = await exportAllWorkspaces(include);
  return new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' });
}

// ---------------------------------------------------------------------------
// Filenames — §2-3 "v3.69의 setNaming 규칙과 같은 계열" (date token +
// underscore-separated segments + an optional 2-digit same-day sequence),
// deliberately its own small scheme rather than reusing utils/setNaming.ts's
// parseSetName (that one expects the date FIRST; this format leads with a
// fixed "workspace" tag instead, so the two aren't drop-in compatible).
// ---------------------------------------------------------------------------

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateToken(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

export function buildTransferFileName(workspaceId: WorkspaceId | 'ALL', date: Date = new Date(), sequence?: number): string {
  const base = `workspace_${workspaceId}_${formatDateToken(date)}`;
  return sequence && sequence > 1 ? `${base}_${pad2(sequence)}.json` : `${base}.json`;
}

/**
 * A browser has no visibility into what's already in the Downloads folder,
 * so "same-day repeat" is tracked as an in-app counter (localStorage, not
 * workspace-scoped — it's a naming nicety, not user data), reset implicitly
 * by the date token itself changing each day.
 */
function nextExportSequenceToday(counterKey: string): number {
  if (typeof window === 'undefined') return 1;
  try {
    const today = formatDateToken(new Date());
    const raw = window.localStorage.getItem(counterKey);
    const parsed = raw ? (JSON.parse(raw) as { date: string; count: number }) : null;
    const count = parsed && parsed.date === today ? parsed.count + 1 : 1;
    window.localStorage.setItem(counterKey, JSON.stringify({ date: today, count }));
    return count;
  } catch {
    return 1;
  }
}

export function nextTransferFileName(workspaceId: WorkspaceId | 'ALL'): string {
  const sequence = nextExportSequenceToday(`suno-weaver-export-seq::${workspaceId}`);
  return buildTransferFileName(workspaceId, new Date(), sequence);
}

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (typeof document === 'undefined') return; // Node/test environment -- nothing to trigger a download in.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Import — TASK B
// ---------------------------------------------------------------------------

export interface ImportPlan {
  packs: { new: number; skipped: number; conflicted: string[] };
  hooks: { new: number; existing: number };
  situations: { new: number; existing: number };
  lyricLines: { new: number; existing: number };
  ratings: { new: number; updated: number; skipped: number };
  takes: { new: number; updated: number };
  videos: { new: number; updated: number };
  channels: { new: number; skipped: number };
}

export interface ImportPreview {
  fileWorkspaceId: WorkspaceId;
  fileWorkspaceLabel: string;
  exportedAt: string;
  appVersion: string;
  counts: Record<string, number>;
  plan: ImportPlan;
  warnings: string[];
  isCrossWorkspace: boolean;
  isFutureFormatVersion: boolean;
  hasSettings: boolean;
  hasLocalKeys: boolean;
  hasApiKeys: boolean;
}

export class ImportFormatError extends Error {}

async function parseTransferFile(file: File): Promise<WorkspaceExportFile> {
  // v4.0 (TASK A) — file.text()+JSON.parse() moved off the main thread (see
  // backupImportClient.ts's own doc comment); a large library export was a
  // real freeze risk this task exists to fix. Any failure (malformed JSON,
  // or a worker infrastructure problem) is wrapped in the same
  // ImportFormatError this function always threw for a bad file, so every
  // existing caller (DataManagementPanel.tsx's instanceof check,
  // tests/workspaceTransfer.test.ts's own "rejects malformed JSON" case)
  // sees identical behavior.
  let parsed: unknown;
  try {
    parsed = await parseJsonFileResponsive(file);
  } catch (error) {
    throw new ImportFormatError(error instanceof Error ? error.message : '이 파일은 올바른 JSON이 아닙니다.');
  }
  const candidate = parsed as Partial<WorkspaceExportFile>;
  if (candidate.format !== TRANSFER_FORMAT) {
    throw new ImportFormatError('이 파일은 워크스페이스 내보내기 파일이 아닙니다.');
  }
  if (typeof candidate.formatVersion !== 'number' || candidate.formatVersion > TRANSFER_FORMAT_VERSION) {
    throw new ImportFormatError('이 파일은 더 최신 앱에서 만들어졌습니다. 앱을 업데이트한 뒤 다시 시도하세요.');
  }
  // v4.0 (TASK C-4) — schemaVersion didn't exist before this task; a file
  // exported by an older app simply has no field here, which is a LOWER
  // version by definition (implicitly migrated to EXPORT_SCHEMA_VERSION —
  // there is nothing to actually transform yet at schema version 1, see
  // core/exportMeta.ts's own doc comment). Only an explicit, HIGHER number
  // is a real rejection case: this app genuinely cannot read that shape.
  if (typeof candidate.schemaVersion === 'number' && candidate.schemaVersion > EXPORT_SCHEMA_VERSION) {
    throw new ImportFormatError('이 파일은 더 최신 앱에서 만든 파일입니다. 앱을 업데이트한 뒤 다시 시도하세요.');
  }
  if (!candidate.workspaceId || !candidate.data) {
    throw new ImportFormatError('이 파일의 내용이 손상되었거나 비어 있습니다.');
  }
  return candidate as WorkspaceExportFile;
}

async function buildImportPlan(fileData: WorkspaceExportData, targetWorkspaceId: WorkspaceId): Promise<ImportPlan> {
  const plan: ImportPlan = {
    packs: { new: 0, skipped: 0, conflicted: [] },
    hooks: { new: 0, existing: 0 },
    situations: { new: 0, existing: 0 },
    lyricLines: { new: 0, existing: 0 },
    ratings: { new: 0, updated: 0, skipped: 0 },
    takes: { new: 0, updated: 0 },
    videos: { new: 0, updated: 0 },
    channels: { new: 0, skipped: 0 }
  };

  if (fileData.packs) {
    for (const pack of fileData.packs) {
      const existing = await findPackByName(targetWorkspaceId, pack.name);
      if (existing) {
        plan.packs.skipped += 1;
        plan.packs.conflicted.push(pack.name);
      } else {
        plan.packs.new += 1;
      }
    }
  }

  if (fileData.hooks) {
    const existingHooks = new Set((await listAllHooksForWorkspace(targetWorkspaceId)).map(h => `${h.packId}:${h.trackNo}`));
    for (const hook of fileData.hooks) {
      if (existingHooks.has(`${hook.packId}:${hook.trackNo}`)) plan.hooks.existing += 1;
      else plan.hooks.new += 1;
    }
  }

  if (fileData.situations) {
    const existingSituations = new Set((await listAllSituationsForWorkspace(targetWorkspaceId)).map(s => `${s.packId}:${s.trackNo}`));
    for (const situation of fileData.situations) {
      if (existingSituations.has(`${situation.packId}:${situation.trackNo}`)) plan.situations.existing += 1;
      else plan.situations.new += 1;
    }
  }

  if (fileData.lyricLines) {
    const existingLyricLines = new Set((await listAllLyricLinesForWorkspace(targetWorkspaceId)).map(l => `${l.packId}:${l.trackNo}:${l.lineIndex}`));
    for (const line of fileData.lyricLines) {
      if (existingLyricLines.has(`${line.packId}:${line.trackNo}:${line.lineIndex}`)) plan.lyricLines.existing += 1;
      else plan.lyricLines.new += 1;
    }
  }

  if (fileData.ratings) {
    for (const rating of fileData.ratings) {
      const existing = await getRatingForSong(rating.songId);
      if (!existing) plan.ratings.new += 1;
      else if (rating.ratedAt > existing.ratedAt) plan.ratings.updated += 1;
      else plan.ratings.skipped += 1;
    }
  }

  if (fileData.takes) {
    const existingTakes = new Map((await listAllTakesForWorkspace(targetWorkspaceId)).map(t => [t.takeId, t]));
    for (const take of fileData.takes) {
      const existing = existingTakes.get(take.takeId);
      if (!existing) plan.takes.new += 1;
      else if (take.analyzedAt > existing.analyzedAt) plan.takes.updated += 1;
    }
  }

  if (fileData.videos) {
    const existingVideos = new Map((await listAllVideosForWorkspace(targetWorkspaceId)).map(v => [v.packId, v]));
    for (const video of fileData.videos) {
      const existing = existingVideos.get(video.packId);
      if (!existing) plan.videos.new += 1;
      else if (video.scheduledAt > existing.scheduledAt) plan.videos.updated += 1;
    }
  }

  if (fileData.channels) {
    const existingIds = new Set(readStoredChannelsForWorkspace(targetWorkspaceId).map(c => c.id));
    for (const channel of fileData.channels) {
      if (existingIds.has(channel.id)) plan.channels.skipped += 1;
      else plan.channels.new += 1;
    }
  }

  return plan;
}

/**
 * Read-only dry run — computes exactly what applyImport() would do without
 * writing anything (spec §3-3 "previewImport 가 핵심입니다"). Always previews
 * against the CURRENT workspace as the import target, since that's what
 * applyImport() will actually write into.
 */
export async function previewImport(file: File): Promise<ImportPreview> {
  const parsedFile = await parseTransferFile(file);
  const targetWorkspaceId = currentWorkspaceId();
  const plan = await buildImportPlan(parsedFile.data, targetWorkspaceId);

  const warnings: string[] = [];
  const isCrossWorkspace = parsedFile.workspaceId !== targetWorkspaceId;
  if (isCrossWorkspace) {
    warnings.push(`이 파일은 "${parsedFile.workspaceLabel}"(${parsedFile.workspaceId}) 워크스페이스에서 내보낸 파일입니다. 현재 워크스페이스(${getWorkspace(targetWorkspaceId).labelKo})와 다릅니다.`);
  }
  if (plan.packs.conflicted.length) {
    warnings.push(`이름이 같은 팩 ${plan.packs.conflicted.length}개는 건너뜁니다(덮어쓰기를 선택하면 교체됩니다): ${plan.packs.conflicted.slice(0, 5).join(', ')}${plan.packs.conflicted.length > 5 ? ' 외' : ''}`);
  }
  // v5.17 (TASK A §1-3 item 3) — preview-time heads-up; applyImport() strips
  // and warns again at write time regardless of whether the user saw this.
  const packsWithLeakedSecrets = (parsedFile.data.packs ?? []).filter(
    pack => pack.blueprint && scrubBlueprintSnapshotSecrets(pack.blueprint).scrubbed
  ).length;
  if (packsWithLeakedSecrets) {
    warnings.push(`이 파일의 팩 ${packsWithLeakedSecrets}개에 저장되면 안 되는 비밀 정보(API 키 등)가 남아 있습니다. 가져올 때 자동으로 제거됩니다.`);
  }

  return {
    fileWorkspaceId: parsedFile.workspaceId,
    fileWorkspaceLabel: parsedFile.workspaceLabel,
    exportedAt: parsedFile.exportedAt,
    appVersion: parsedFile.appVersion,
    counts: parsedFile.counts,
    plan,
    warnings,
    isCrossWorkspace,
    isFutureFormatVersion: false, // parseTransferFile already threw if it were
    hasSettings: Boolean(parsedFile.data.settings),
    hasLocalKeys: Boolean(parsedFile.data.localKeys),
    hasApiKeys: Boolean(parsedFile.data.apiKeys)
  };
}

export interface ApplyImportOptions {
  /** Required to proceed when the file's workspaceId differs from the current one (spec §3-1 rule 1). */
  allowCrossWorkspace?: boolean;
  /** "가져온 설정 사용" — settings are skipped by default even in 'replace' mode (spec §3-2's own explicit carve-out). */
  importSettings?: boolean;
  importLocalKeys?: boolean;
  /** Never imported unless explicitly requested, even if present in the file. */
  importApiKeys?: boolean;
}

export interface ImportResult {
  packs: { added: number; replaced: number; skipped: number };
  hooks: { written: number };
  situations: { written: number };
  lyricLines: { written: number };
  ratings: { added: number; updated: number; skipped: number };
  takes: { new: number; updated: number };
  videos: { new: number; updated: number };
  usage: { added: number };
  channels: { added: number; skipped: number };
  settingsImported: boolean;
  localKeysImported: boolean;
  apiKeysImported: boolean;
  /** The safety snapshot taken of the CURRENT workspace before any write — always produced, regardless of options, per spec §3-1 rule 3. */
  preImportBackup: WorkspaceExportFile;
  /**
   * TASK (genre-archetype sanitization) — an imported pack's/channel's own
   * genreIds/preferredGenres can belong to a completely different
   * workspace's genre catalog (the whole point of a cross-workspace import
   * — see core/genreSelection.ts's sanitizeGenreIdsForArchetype doc
   * comment); this records what got stripped from each written pack/channel
   * so DataManagementPanel.tsx's "done" stage can show it, the same
   * "import-warning" paragraph previewImport's own `warnings` already uses.
   */
  warnings: string[];
}

/**
 * Applies an import. `mode: 'replace'` only changes PACKS behavior (same-name
 * pack is overwritten instead of skipped) — every other category already has
 * its own fixed merge rule (union / latest-wins / skip-existing) per spec
 * §3-2's table, independent of this top-level toggle. Custom channels are
 * always skip-existing in both modes ("사용자 설정을 지우지 않음").
 */
export async function applyImport(file: File, mode: 'merge' | 'replace', options: ApplyImportOptions = {}): Promise<ImportResult> {
  const parsedFile = await parseTransferFile(file);
  const targetWorkspaceId = currentWorkspaceId();

  if (parsedFile.workspaceId !== targetWorkspaceId && !options.allowCrossWorkspace) {
    throw new ImportFormatError(
      `이 파일은 다른 워크스페이스(${parsedFile.workspaceLabel})에서 내보낸 파일입니다. 현재 워크스페이스로 가져오려면 "다른 워크스페이스로 가져오기"를 명시적으로 선택하세요.`
    );
  }

  // Safety net (spec §3-1 rule 3) — always taken, before any write below.
  // Scoped to exactly the categories present in the incoming file: that's
  // precisely what this import could touch, so it's what needs protecting —
  // a file with only `packs` never needed a hooks/ratings/videos snapshot to
  // begin with.
  const { data: importedData } = parsedFile;
  const backupInclude: Partial<ExportInclude> = {
    packs: Boolean(importedData.packs),
    hooks: Boolean(importedData.hooks),
    situations: Boolean(importedData.situations),
    lyricLines: Boolean(importedData.lyricLines),
    ratings: Boolean(importedData.ratings),
    takes: Boolean(importedData.takes),
    videos: Boolean(importedData.videos),
    usage: Boolean(importedData.usage),
    channels: Boolean(importedData.channels),
    settings: Boolean(importedData.settings || importedData.localKeys),
    apiKeys: false
  };
  const preImportBackup = await exportWorkspace({ workspaceId: targetWorkspaceId, include: backupInclude });
  await downloadBlob(
    new Blob([JSON.stringify(preImportBackup, null, 2)], { type: 'application/json;charset=utf-8' }),
    `workspace_${targetWorkspaceId}_${formatDateToken(new Date())}_가져오기전백업.json`
  );

  const result: ImportResult = {
    packs: { added: 0, replaced: 0, skipped: 0 },
    hooks: { written: 0 },
    situations: { written: 0 },
    lyricLines: { written: 0 },
    ratings: { added: 0, updated: 0, skipped: 0 },
    takes: { new: 0, updated: 0 },
    videos: { new: 0, updated: 0 },
    usage: { added: 0 },
    channels: { added: 0, skipped: 0 },
    settingsImported: false,
    localKeysImported: false,
    apiKeysImported: false,
    preImportBackup,
    warnings: []
  };

  const { data } = parsedFile;

  if (data.packs) {
    for (const pack of data.packs) {
      const existing = await findPackByName(targetWorkspaceId, pack.name);
      if (existing && mode === 'merge') {
        result.packs.skipped += 1;
        continue;
      }
      // 'replace' with an existing same-name pack reuses that pack's own id
      // so it's a true in-place replace, not a second same-named pack.
      const withoutSecrets = pack.blueprint ? (() => {
        // v5.17 (TASK A §1-3 item 3) — an external file (from before this
        // fix, or hand-edited) can still carry a real apiKey/accessToken/
        // proxyEndpoint on its generationSnapshot; ignored and stripped
        // before it ever reaches this workspace's storage, never imported
        // even in 'replace' mode.
        const { blueprint, scrubbed } = scrubBlueprintSnapshotSecrets(pack.blueprint);
        if (scrubbed && !result.warnings.some(w => w.includes('비밀 정보'))) {
          result.warnings.push('가져온 파일 일부에 저장되면 안 되는 비밀 정보(API 키 등)가 있어 무시했습니다.');
        }
        return scrubbed ? { ...pack, blueprint } : pack;
      })() : pack;
      const toWrite = existing ? { ...withoutSecrets, id: existing.id } : withoutSecrets;
      // TASK (genre-archetype sanitization) — a pack imported from another
      // workspace's export can carry genreIds that belong to that other
      // workspace's genre catalog entirely (the real, verified "cross-
      // workspace data import" contamination path — see
      // core/genreSelection.ts's sanitizeGenreIdsForArchetype doc comment).
      const packArchetype = toWrite.options.channel.archetype || 'senior-morning';
      const { valid: sanitizedPackGenreIds, removed: removedPackGenreIds } = sanitizeGenreIdsForArchetype(
        toWrite.options.genreIds,
        packArchetype
      );
      const sanitizedToWrite = removedPackGenreIds.length
        ? { ...toWrite, options: { ...toWrite.options, genreIds: sanitizedPackGenreIds } }
        : toWrite;
      if (removedPackGenreIds.length) {
        result.warnings.push(`"${pack.name}": ${genreSanitizationWarningKo(removedPackGenreIds, packArchetype)}`);
      }
      await putFullPack(sanitizedToWrite);
      if (existing) result.packs.replaced += 1;
      else result.packs.added += 1;
    }
  }

  if (data.hooks) {
    for (const hook of data.hooks) {
      await putHookRecord(hook);
      result.hooks.written += 1;
    }
  }

  if (data.situations) {
    for (const situation of data.situations) {
      await putSituationRecord(situation);
      result.situations.written += 1;
    }
  }

  if (data.lyricLines) {
    for (const line of data.lyricLines) {
      await putLyricLineRecord(line);
      result.lyricLines.written += 1;
    }
  }

  if (data.ratings) {
    for (const rating of data.ratings) {
      const existing = await getRatingForSong(rating.songId);
      if (!existing) {
        await recordRating({ ...rating, workspaceId: targetWorkspaceId });
        result.ratings.added += 1;
      } else if (rating.ratedAt > existing.ratedAt) {
        await recordRating({ ...rating, workspaceId: targetWorkspaceId });
        result.ratings.updated += 1;
      } else {
        result.ratings.skipped += 1;
      }
    }
  }

  if (data.takes) {
    // Captured BEFORE any writes below, so new-vs-updated accounting reflects
    // what actually existed going into this import, not what exists after.
    const beforeIds = new Set((await listAllTakesForWorkspace(targetWorkspaceId)).map(t => t.takeId));
    for (const take of data.takes) {
      const outcome = await putTakeIfNewer(take);
      if (outcome !== 'written') continue;
      if (beforeIds.has(take.takeId)) result.takes.updated += 1;
      else result.takes.new += 1;
    }
  }

  if (data.videos) {
    const beforePackIds = new Set((await listAllVideosForWorkspace(targetWorkspaceId)).map(v => v.packId));
    for (const video of data.videos) {
      const outcome = await putVideoRecordIfNewer(video);
      if (outcome !== 'written') continue;
      if (beforePackIds.has(video.packId)) result.videos.updated += 1;
      else result.videos.new += 1;
    }
  }

  if (data.usage) {
    for (const usage of data.usage) {
      await putUsageRecord(usage);
      result.usage.added += 1;
    }
  }

  if (data.channels) {
    // TASK (genre-archetype sanitization) — mirrors the packs loop above:
    // an imported custom channel's own preferredGenres can carry another
    // workspace's genre ids. mergeStoredChannels() itself stays untouched
    // (it's also called from useChannelManager's own local-storage write
    // path, which never carries foreign-workspace data) — sanitized here,
    // right before the incoming array is handed to it.
    const sanitizedChannels = data.channels.map(channel => {
      const channelArchetype = channel.archetype || 'senior-morning';
      const { valid, removed } = sanitizeGenreIdsForArchetype(channel.preferredGenres, channelArchetype);
      if (removed.length) {
        result.warnings.push(`"${channel.name}": ${genreSanitizationWarningKo(removed, channelArchetype)}`);
        return { ...channel, preferredGenres: valid };
      }
      return channel;
    });
    result.channels.added = mergeStoredChannels(sanitizedChannels);
    result.channels.skipped = data.channels.length - result.channels.added;
  }

  if (options.importSettings && data.settings) {
    if (data.settings.diversityAllocation) {
      const { channelIds, templates } = data.settings.diversityAllocation;
      await setSetting(scopedKey(DIVERSITY_ALLOCATION_INDEX_KEY), channelIds);
      for (const [channelId, template] of Object.entries(templates)) {
        await setSetting(scopedKey(`diversityAllocation:${channelId}`), template);
      }
    }
    if (data.settings.thumbnailBrand) {
      const { channelNames, templates } = data.settings.thumbnailBrand;
      await setSetting(scopedKey(THUMBNAIL_BRAND_INDEX_KEY), channelNames);
      for (const [channelName, template] of Object.entries(templates)) {
        await setSetting(scopedKey(`thumbnailBrand:${channelName}`), template);
      }
    }
    result.settingsImported = true;
  }

  if (options.importLocalKeys && data.localKeys) {
    if (data.localKeys.recentGenres !== undefined) writeRawLocalKey(RECENT_GENRES_KEY, data.localKeys.recentGenres);
    if (data.localKeys.kidsBannerDismissed !== undefined) writeRawLocalKey(KIDS_BANNER_DISMISSED_KEY, data.localKeys.kidsBannerDismissed);
    result.localKeysImported = true;
  }

  if (options.importApiKeys && data.apiKeys) {
    for (const [key, value] of Object.entries(data.apiKeys)) {
      await setSetting(key, value);
    }
    result.apiKeysImported = true;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Auto-backup tracking — TASK C. Per workspace (the data-management screen
// shows "현재 워크스페이스: ... 마지막 백업: N일 전" for whichever workspace is
// open), not global.
// ---------------------------------------------------------------------------

const LAST_BACKUP_KEY = 'suno-weaver-last-backup-at';
const STALE_BACKUP_DAYS = 7;

export function recordBackupNow(workspaceId: WorkspaceId = currentWorkspaceId()): void {
  writeRawLocalKeyFor(LAST_BACKUP_KEY, new Date().toISOString(), workspaceId);
}

function writeRawLocalKeyFor(rawKey: string, value: string, workspaceId: WorkspaceId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(scopedKey(rawKey, workspaceId), value);
  } catch {
    // Storage can be blocked in private/embedded contexts; the backup itself already succeeded.
  }
}

/** null = never backed up (not "0 days ago" — the banner needs to tell these apart, see daysSinceLastBackup's caller). */
export function lastBackupAt(workspaceId: WorkspaceId = currentWorkspaceId()): string | null {
  return readRawLocalKey(LAST_BACKUP_KEY, workspaceId) ?? null;
}

export function daysSinceLastBackup(workspaceId: WorkspaceId = currentWorkspaceId()): number | null {
  const at = lastBackupAt(workspaceId);
  if (!at) return null;
  const ms = Date.now() - new Date(at).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/** Spec §4-2 "7일 이상 지나면 상단에 배너" — never backed up counts as stale too (there's nothing to fall back on). */
export function isBackupStale(workspaceId: WorkspaceId = currentWorkspaceId()): boolean {
  const days = daysSinceLastBackup(workspaceId);
  return days === null || days >= STALE_BACKUP_DAYS;
}
