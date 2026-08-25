import type { GenerationOptions, PlaylistBlueprint, SavedPack, SavedPackMeta, SoundSignature, WorkspaceId } from '../types';
import { scrubBlueprintSnapshotSecrets } from './generationSnapshot';
import { channelPresets } from '../data/presets';
import { isMadeForKidsChannel } from './exportCompliance';
import { lintChannelDiversity, sampleFromSavedPack, type ChannelDiversityReport } from './diversityLinter';
import { listVideos } from './videoLedger';
import { dominantRegisterSignature, recordVocalCombo } from './vocalComboLedger';
import { rememberFlagshipOrder } from './recentFlagshipOrderStore';
import { currentWorkspaceId, DEFAULT_WORKSPACE_ID, scopeFilter, scopedKey } from './workspaceScope';
import { assignSetCode, buildSongCode } from './setCode';
import { buildPersistGateInputFromBlueprint, canPersistFinalizedPack } from './finalizeBlueprint';
import { workspaceForArchetype } from '../data/workspaces';

const CURRENT_PRESET_NAMES = new Map(channelPresets.map(c => [c.id, { name: c.name, englishName: c.englishName }]));

/**
 * TASK C (v3.5) — a built-in preset's display name can be corrected after
 * packs were already saved under it (e.g. the Japanese channel preset was
 * originally named in Korean, then fixed to actual Japanese). Saved packs
 * snapshot the channel at save time, so without this they'd keep showing
 * the old name forever. Matched by id, so custom (non-preset) channels are
 * never touched.
 */
export function migrateLegacyChannelNames(pack: SavedPack): SavedPack {
  const current = CURRENT_PRESET_NAMES.get(pack.channelId);
  if (!current) return pack;
  const channelNameStale = pack.channelName !== current.name;
  const channelObjStale = pack.options?.channel?.id === pack.channelId && pack.options.channel.name !== current.name;
  if (!channelNameStale && !channelObjStale) return pack;
  return {
    ...pack,
    channelName: current.name,
    options: pack.options
      ? { ...pack.options, channel: { ...pack.options.channel, name: current.name, englishName: current.englishName || pack.options.channel.englishName } }
      : pack.options
  };
}

function normalizeSavedPack(pack: SavedPack): SavedPack {
  const migrated = migrateLegacyChannelNames(pack);
  const personaMode = migrated.personaMode ?? migrated.options?.personaMode ?? false;
  const normalized: SavedPack = {
    ...migrated,
    personaMode,
    options: migrated.options ? { ...migrated.options, personaMode } : migrated.options
  };
  // v5.17 (TASK A §1-3) — every read path (listPacks, loadPack,
  // listFullPacksForWorkspace, the memory-only export blob) funnels through
  // here, so a pack saved before generationSnapshot.provider was narrowed to
  // SnapshotProviderInfo never shows/exports its leaked apiKey/accessToken/
  // proxyEndpoint again, even before loadPack's own write-back below
  // actually cleans the stored record.
  return scrubPackSnapshotSecrets(normalized).pack;
}

/**
 * v5.17 (TASK A §1-3) — SavedPack-level wrapper around
 * generationSnapshot.ts's scrubBlueprintSnapshotSecrets, so callers that
 * need to know whether a rewrite happened (loadPack's own write-back) don't
 * have to reach into `pack.blueprint` themselves.
 */
function scrubPackSnapshotSecrets(pack: SavedPack): { pack: SavedPack; scrubbed: boolean } {
  if (!pack.blueprint) return { pack, scrubbed: false };
  const { blueprint, scrubbed } = scrubBlueprintSnapshotSecrets(pack.blueprint);
  if (!scrubbed) return { pack, scrubbed: false };
  return { pack: { ...pack, blueprint }, scrubbed: true };
}

function randomSongId(packId: string, trackNo: number): string {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${packId}-${trackNo}-${suffix}`;
}

/**
 * v3.68 (TASK A) — every pack saved before this task has songs with no
 * songId (core/ratingLedger.ts's rating records key off it). Pure so it's
 * testable without IndexedDB; loadPack (below) persists the result back to
 * storage the one time this actually assigns anything, so a later reload
 * never generates a *different* id for the same song — that would silently
 * detach any rating already recorded against the id assigned on first load.
 */
export function migratePackSongIds(pack: SavedPack): { pack: SavedPack; migrated: boolean } {
  let migrated = false;
  const songs = pack.blueprint.songs.map(song => {
    if (song.songId) return song;
    migrated = true;
    return { ...song, songId: randomSongId(pack.id, song.trackNo) };
  });
  if (!migrated) return { pack, migrated: false };
  return { pack: { ...pack, blueprint: { ...pack.blueprint, songs } }, migrated: true };
}

const DB_NAME = 'suno-weaver-library';
const DB_VERSION = 4;
const STORE = 'packs';
const PERSONA_STORE = 'personas';
const PROGRESS_STORE = 'suno_progress';
const CONCEPT_CACHE_STORE = 'concept_cache';
const CONCEPT_HISTORY_STORE = 'concept_history';
export const AUTOSAVE_ID = 'autosave-temp';

/** TASK H4 (v3.10) — caches a concept agent API recommendation by channel + normalized free-text input, so re-submitting the same phrase never re-calls the API. */
export interface ConceptCacheRecord {
  id: string;
  resultJson: string;
  cachedAt: string;
}

/** TASK H7 (v3.10) — last few free-text inputs per channel, shown as quick-pick chips so the user doesn't retype a phrase they already used for this channel. */
export interface ConceptHistoryRecord {
  id: string;
  channelId: string;
  inputs: string[];
  updatedAt: string;
}

const memoryConceptCache = new Map<string, ConceptCacheRecord>();
const memoryConceptHistory = new Map<string, ConceptHistoryRecord>();
const CONCEPT_HISTORY_MAX = 5;

/** TASK G3 (v3.7) — "곡을 Suno에 넣었음" checkboxes for Focus Mode, keyed by pack id, so the checklist survives a page reload. */
export interface PackProgressRecord {
  id: string;
  doneTrackNos: number[];
  updatedAt: string;
  /** TASK v3.31 — per-track "last copied all fields in Suno Progress Mode" timestamp, so reopening a pack later shows what was already pasted. Optional/absent for records written before this field existed. */
  pastedAt?: Record<number, string>;
  /** v4.2 (TASK A) — AudioAnalysisPanel's focus-mode cursor (which trackNo the user was reviewing takes for), so closing and reopening the panel resumes at the same track instead of always restarting at track 1. Optional/absent for records written before this field existed, or for packs that have never used focus mode. */
  focusCursorTrackNo?: number;
}

const memoryProgress = new Map<string, PackProgressRecord>();

export interface ChannelPersonaRecord {
  id: string;
  channelId: string;
  personaName: string;
  createdAt: string;
  lastUsedAt: string;
  useCount: number;
  soundSignature?: SoundSignature;
}

const memoryPacks = new Map<string, SavedPack>();
const memoryPersonas = new Map<string, ChannelPersonaRecord>();

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PERSONA_STORE)) {
        db.createObjectStore(PERSONA_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PROGRESS_STORE)) {
        db.createObjectStore(PROGRESS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CONCEPT_CACHE_STORE)) {
        db.createObjectStore(CONCEPT_CACHE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CONCEPT_HISTORY_STORE)) {
        db.createObjectStore(CONCEPT_HISTORY_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>, storeName = STORE): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
    tx.oncomplete = () => db.close();
  });
}

function randomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `pack-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function averageQuality(blueprint: PlaylistBlueprint) {
  if (!blueprint.songs.length) return 0;
  const sum = blueprint.songs.reduce((total, song) => total + song.qualityScore, 0);
  return Math.round(sum / blueprint.songs.length);
}

export function buildDefaultPackName(blueprint: PlaylistBlueprint, opts: GenerationOptions) {
  const date = new Date().toISOString().slice(0, 10);
  return `${opts.channel.name} - ${blueprint.projectTitle} - ${date}`;
}

/**
 * v3.79 (TASK D) — savePack's own set-code assignment step, pulled out as
 * its own function so the "skip for autosave" / "keep an already-assigned
 * code as-is" rules are readable in one place. Never mutates the caller's
 * blueprint object; returns the (possibly) coded copy for savePack to use.
 */
async function withAssignedSetCode(blueprint: PlaylistBlueprint, isAutosave: boolean | undefined): Promise<PlaylistBlueprint> {
  if (isAutosave || blueprint.meta?.setCode) return blueprint;
  const existing = await listPacks();
  const setCode = assignSetCode(new Date(), existing.map(pack => pack.setCode));
  return {
    ...blueprint,
    meta: { ...blueprint.meta, setCode },
    songs: blueprint.songs.map(song => (song.songCode ? song : { ...song, songCode: buildSongCode(setCode, song.trackNo) }))
  };
}

export async function savePack(input: {
  blueprint: PlaylistBlueprint;
  options: GenerationOptions;
  name?: string;
  isAutosave?: boolean;
  id?: string;
  evaluation?: SavedPack['evaluation'];
  thumbnailSpec?: SavedPack['thumbnailSpec'];
  soundSignature?: SavedPack['soundSignature'];
  personaMode?: boolean;
  setGroupId?: string;
  setIndex?: number;
  setTotal?: number;
  generatedBy?: SavedPack['generatedBy'];
  generatedByNote?: string;
}): Promise<string> {
  // v4.0 (TASK A1) — the autosave slot is one singleton record per app; without
  // scoping its physical key by workspace, two workspaces' autosaves would
  // put() the same IndexedDB primary key and silently overwrite each other.
  // A real pack's id (randomId()) is already globally unique, so it's never
  // rescoped here (rescoping it would break rename/update, which pass the
  // pack's existing real id back in expecting an exact-key match).
  const id = input.isAutosave ? scopedKey(AUTOSAVE_ID) : (input.id || randomId());
  const personaMode = input.personaMode ?? input.options.personaMode ?? false;
  // 지시문 18 (TASK C-1/C-2) — 어느 저장 경로도 이 필드를 비워두지 않는다.
  // 정직한 기본값 'other'(§C-3 "generatedBy 미선택을 가져오기 차단 사유로
  // 만들지 말 것" — 대신 값 자체를 'other'로 채워 세트가 쌓여도 데이터가 된다).
  const generatedBy: SavedPack['generatedBy'] = input.generatedBy ?? input.options.generatedBy ?? 'other';
  const generatedByNote = generatedBy === 'other' ? (input.generatedByNote ?? input.options.generatedByNote) : undefined;
  // v3.79 (TASK D) — set-code assignment: mirrors this function's own
  // pre-existing "skip for autosave" precedent just below (recordVocalCombo)
  // — autosave fires far more often than "a set was actually finished", so
  // it must never consume a daily sequence number. Assigned exactly once:
  // if this blueprint already carries a code (a re-save/rename of an
  // already-saved pack, or promoteAutosave() handing off an autosave's
  // blueprint that was already coded on a prior real save), it's kept
  // as-is — never recomputed, per this task's own "not recomputed on every
  // read" requirement. listPacks() is already workspace-scoped and already
  // the app's own lightweight "how many packs exist" read, so no separate
  // counter store is needed (see core/setCode.ts's own doc comment).
  const blueprint = await withAssignedSetCode(input.blueprint, input.isAutosave);
  // 지시문 31 (§3) — "저장·자동저장·라이브러리는 이 함수를 통과하지 않으면
  // 실행되지 않는다." savePack이 자동저장·현재 팩 저장·가져온 팩 저장·
  // 멀티세트 저장이 실제로 전부 거치는 단 하나의 함수라(§3-3 전수표), 여기
  // 한 곳만 지키면 그 넷 모두가 지켜진다 — 호출자마다 따로 판단하게 두지
  // 않는다. core/finalizeBlueprint.ts's buildPersistGateInputFromBlueprint's
  // own doc comment: GenerationSnapshot이 없는 자리라 slotReconciliation은
  // 정직하게 no-op(ok:true)이고, schemaIssues/trackNoValidation/
  // workspacePolicyIssues만 실제로 검사한다.
  const persistGate = canPersistFinalizedPack(
    buildPersistGateInputFromBlueprint(blueprint, workspaceForArchetype(input.options.channel.archetype)?.id ?? 'senior-oldpop')
  );
  if (!persistGate.ok) {
    throw new Error(`저장할 수 없습니다 — 관문을 통과하지 못했습니다: ${persistGate.blockersKo.join(' / ')}`);
  }
  const pack: SavedPack = {
    id,
    name: input.name || buildDefaultPackName(blueprint, input.options),
    savedAt: new Date().toISOString(),
    isAutosave: Boolean(input.isAutosave),
    workspaceId: currentWorkspaceId(),
    channelId: input.options.channel.id,
    channelName: input.options.channel.name,
    projectTitle: blueprint.projectTitle,
    songCount: blueprint.songs.length,
    avgQualityScore: averageQuality(blueprint),
    blueprint,
    setCode: blueprint.meta?.setCode,
    // 지시문 18 (TASK C-2) — blueprint.meta.bridgeVersion을 top level로
    // 미러링한다(setCode와 같은 패턴 — 이유는 SavedPack.bridgeVersion 자신의
    // doc comment 참고). 로컬 생성(브릿지 아님) 팩은 blueprint.meta.bridgeVersion
    // 자체가 없으므로 undefined로 남는다 — 정직하다, 로컬 생성은 브릿지
    // 버전이라는 개념이 없다.
    bridgeVersion: blueprint.meta?.bridgeVersion,
    options: { ...input.options, personaMode, generatedBy, generatedByNote },
    evaluation: input.evaluation,
    thumbnailSpec: input.thumbnailSpec,
    soundSignature: input.soundSignature,
    // TASK v3.39.1 Part B4 — always true (every pack this app produces is
    // AI-generated; see core/exportCompliance.ts's AI_DISCLOSURE_LINE) /
    // derived from the channel at save time so it's visible without
    // re-deriving it later from a channel record that may have changed.
    aiDisclosure: true,
    madeForKids: isMadeForKidsChannel(input.options.channel),
    personaMode,
    generatedBy,
    generatedByNote,
    setGroupId: input.setGroupId,
    setIndex: input.setIndex,
    setTotal: input.setTotal
  };
  if (!hasIndexedDb()) {
    memoryPacks.set(id, pack);
    return id;
  }
  await withStore('readwrite', store => store.put(pack));
  // TASK v3.72 (TASK E) — records this pack's dominant register choice per
  // gender for cross-set avoidance (core/vocalComboLedger.ts), read back by
  // providers/index.ts's generateBlueprint on the next pack for this
  // channel. Skipped for autosave (fires far more often than "a set was
  // actually finished") and best-effort — a ledger write failure must never
  // fail the actual save.
  if (!input.isAutosave) {
    const signature = dominantRegisterSignature(input.blueprint.songs);
    if (signature) recordVocalCombo(input.options.channel.id, signature).catch(() => {});
    // v3.80 (TASK A-3) — remembers this just-finished pack's actual tracks
    // 1-3 vocal-type order (core/recentFlagshipOrderStore.ts), read back by
    // providers/index.ts's generateBlueprint on the next pack for this
    // channel so resolveFlagshipVocalOrder can avoid repeating it. Same
    // "skip autosave, best-effort" treatment as the vocal-combo ledger just
    // above; undefined for any track whose trackNo 1-3 slot is missing
    // (e.g. a 1-2 song pack), in which case nothing is remembered.
    const order = [1, 2, 3].map(trackNo => input.blueprint.songs.find(song => song.trackNo === trackNo)?.vocalType);
    if (order.every((type): type is 'male' | 'female' | 'mixed' => Boolean(type))) {
      rememberFlagshipOrder(input.options.channel.id, order);
    }
  }
  return id;
}

export async function saveAutosave(
  blueprint: PlaylistBlueprint,
  options: GenerationOptions,
  thumbnailSpec?: SavedPack['thumbnailSpec'],
  soundSignature?: SavedPack['soundSignature']
): Promise<void> {
  await savePack({ blueprint, options, isAutosave: true, id: AUTOSAVE_ID, name: 'Autosave', thumbnailSpec, soundSignature, personaMode: options.personaMode ?? false });
}

export async function promoteAutosave(name: string): Promise<string | null> {
  const autosave = await loadPack(scopedKey(AUTOSAVE_ID));
  if (!autosave) return null;
  return savePack({
    blueprint: autosave.blueprint,
    options: autosave.options,
    name,
    evaluation: autosave.evaluation,
    thumbnailSpec: autosave.thumbnailSpec,
    soundSignature: autosave.soundSignature,
    personaMode: autosave.personaMode ?? autosave.options.personaMode ?? false
  });
}

/**
 * v4.0 (TASK A1) — `workspaceId` is optional and defaults to the current
 * workspace; pass it explicitly to read a DIFFERENT workspace's packs
 * without touching the shared currentWorkspaceId() global (see
 * workspaceScope.ts's scopeFilter doc comment for why that matters —
 * WorkspaceSelectScreen.tsx's per-card counts are the reason this exists).
 */
export async function listPacks(workspaceId?: WorkspaceId): Promise<SavedPackMeta[]> {
  if (!hasIndexedDb()) {
    return scopeFilter(Array.from(memoryPacks.values()), workspaceId)
      .map(normalizeSavedPack)
      .map(({ blueprint: _blueprint, options: _options, evaluation: _evaluation, ...meta }) => meta)
      .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  }
  const all = await withStore<SavedPack[]>('readonly', store => store.getAll());
  return scopeFilter(all, workspaceId)
    .map(normalizeSavedPack)
    .map(({ blueprint: _blueprint, options: _options, evaluation: _evaluation, ...meta }) => meta)
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

export interface SetGroupSummary {
  groupId: string;
  label: string;
  packs: SavedPackMeta[];
}

/**
 * TASK v3.37-b — groups saved packs that share a multi-set run's
 * `setGroupId` (see SavedPack's TASK v3.33 comment), for any UI that needs
 * to act on a whole set-group at once (batch thumbnail/cover export,
 * batch image generation). Packs outside a multi-set run (`setGroupId`
 * undefined) are excluded — there's no group to act on.
 */
export async function listSetGroups(): Promise<SetGroupSummary[]> {
  const all = await listPacks();
  const groups = new Map<string, SavedPackMeta[]>();
  for (const pack of all) {
    if (!pack.setGroupId) continue;
    const list = groups.get(pack.setGroupId) ?? [];
    list.push(pack);
    groups.set(pack.setGroupId, list);
  }
  return Array.from(groups.entries()).map(([groupId, packs]) => ({
    groupId,
    label: `${(packs[0]?.projectTitle ?? groupId).replace(/ Set \d+$/, '')} (${packs.length}세트)`,
    packs: packs.slice().sort((a, b) => (a.setIndex ?? 0) - (b.setIndex ?? 0))
  }));
}

export async function loadPack(id: string): Promise<SavedPack | undefined> {
  if (!hasIndexedDb()) {
    const pack = memoryPacks.get(id);
    if (!pack) return undefined;
    // v5.17 (TASK A §1-3) — scrubbed BEFORE migratePackSongIds so its own
    // `migrated` flag can't mask a pack whose only real change is the
    // snapshot secret strip (see scrubPackSnapshotSecrets's own doc
    // comment); either flag alone triggers the write-back below.
    const { scrubbed } = scrubPackSnapshotSecrets(pack);
    const { pack: migratedPack, migrated } = migratePackSongIds(normalizeSavedPack(pack));
    if (migrated || scrubbed) memoryPacks.set(id, migratedPack);
    return migratedPack;
  }
  const pack = await withStore<SavedPack | undefined>('readonly', store => store.get(id));
  if (!pack) return pack;
  const { scrubbed } = scrubPackSnapshotSecrets(pack);
  const { pack: migratedPack, migrated } = migratePackSongIds(normalizeSavedPack(pack));
  if (migrated || scrubbed) await withStore('readwrite', store => store.put(migratedPack));
  return migratedPack;
}

/**
 * TASK v3.39.1 Part B2 — loads every saved pack for a channel and runs
 * core/diversityLinter.ts's lintChannelDiversity over them. Kept as its own
 * IndexedDB-touching wrapper (not inside diversityLinter.ts itself) so the
 * linter's actual scoring logic stays a pure, synchronously-testable
 * function — same split this file already uses for videoLedger.ts's
 * computeInsights vs channelInsights.
 */
export async function channelDiversityReport(channelId: string): Promise<ChannelDiversityReport> {
  const metas = await listPacks();
  const channelMetas = metas.filter(meta => meta.channelId === channelId);
  const packs = await Promise.all(channelMetas.map(meta => loadPack(meta.id)));
  const samples = packs.filter((pack): pack is SavedPack => Boolean(pack)).map(sampleFromSavedPack);
  return lintChannelDiversity(samples);
}

export interface AttributeCount {
  value: string;
  count: number;
}

export interface TopPerformerAttributes {
  sampleSize: number;
  insufficientData: boolean;
  topGenreIds: AttributeCount[];
  topMoneyChordModes: AttributeCount[];
  topVocalTones: AttributeCount[];
}

const MIN_PERFORMER_SAMPLE = 3;

function topAttributeCounts(values: string[], limit = 5): AttributeCount[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

/**
 * TASK v3.39.1 Part D1 (minimal scope, per explicit product decision — data
 * + report only, not wired back into generation weighting yet) — views/CTR/
 * avgViewDuration already exist on VideoRecord (manual or CSV-import only,
 * see videoLedger.ts's own honesty-boundary comment) and already power a
 * thumbnail-variant/keyword report via channelInsights. What was missing:
 * a video record has no visibility into the *song-level* choices (genre,
 * money chord, vocal) that actually went into its pack. This joins a
 * channel's above-average-CTR videos back to their SavedPack.options to
 * report which attributes keep showing up among the channel's own top
 * performers — "make more of what already works," read-only.
 */
export async function topPerformerAttributes(channelId: string): Promise<TopPerformerAttributes> {
  const videos = await listVideos(channelId);
  const withCtr = videos.filter((v): v is typeof v & { ctr: number } => typeof v.ctr === 'number' && Boolean(v.packId));
  if (withCtr.length < MIN_PERFORMER_SAMPLE) {
    return { sampleSize: withCtr.length, insufficientData: true, topGenreIds: [], topMoneyChordModes: [], topVocalTones: [] };
  }

  const avgCtr = withCtr.reduce((sum, v) => sum + v.ctr, 0) / withCtr.length;
  const topVideos = withCtr.filter(v => v.ctr >= avgCtr);
  const topPacks = (await Promise.all(topVideos.map(v => loadPack(v.packId)))).filter((pack): pack is SavedPack => Boolean(pack));

  return {
    sampleSize: withCtr.length,
    insufficientData: false,
    topGenreIds: topAttributeCounts(topPacks.flatMap(pack => pack.options.genreIds)),
    topMoneyChordModes: topAttributeCounts(topPacks.map(pack => pack.options.moneyChordMode)),
    topVocalTones: topAttributeCounts(topPacks.map(pack => pack.options.vocalTone))
  };
}

export async function deletePack(id: string): Promise<void> {
  if (!hasIndexedDb()) {
    memoryPacks.delete(id);
    return;
  }
  await withStore('readwrite', store => store.delete(id));
}

export async function renamePack(id: string, name: string): Promise<void> {
  const pack = await loadPack(id);
  if (!pack) return;
  await savePack({ ...pack, id, name });
}

/**
 * v4.0 (TASK A1) — scoped to the current workspace only: exporting from
 * inside kr-2030 must never silently bundle senior-oldpop's packs (or vice
 * versa) into the download. A cross-workspace backup is core/workspaceMigration.ts's
 * exportFullBackup(), a separate, explicitly-named function for that
 * separate purpose.
 */
export async function exportAllPacks(): Promise<Blob> {
  if (!hasIndexedDb()) {
    return new Blob([JSON.stringify(scopeFilter(Array.from(memoryPacks.values())).map(normalizeSavedPack), null, 2)], { type: 'application/json;charset=utf-8' });
  }
  const all = await withStore<SavedPack[]>('readonly', store => store.getAll());
  return new Blob([JSON.stringify(scopeFilter(all), null, 2)], { type: 'application/json;charset=utf-8' });
}

export async function importPacks(file: File): Promise<number> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const packs: SavedPack[] = Array.isArray(parsed) ? parsed : [parsed];
  let count = 0;
  for (const pack of packs) {
    if (!pack || typeof pack !== 'object' || !pack.blueprint || !pack.options) continue;
    await savePack({ ...pack, id: pack.id || randomId() });
    count += 1;
  }
  return count;
}

/**
 * v4.0 (TASK A1) — deletes only the current workspace's packs/personas.
 * store.clear() wipes the entire physical table regardless of workspace, so
 * it can no longer be used directly here — a "전체 삭제" click from inside
 * kr-2030 must never take out senior-oldpop's real, already-operating data.
 */
export async function deleteAllPacks(): Promise<void> {
  if (!hasIndexedDb()) {
    const scopedPacks = scopeFilter(Array.from(memoryPacks.values()));
    const channelIds = new Set(scopedPacks.map(pack => pack.channelId));
    for (const pack of scopedPacks) memoryPacks.delete(pack.id);
    for (const [id, persona] of memoryPersonas) {
      if (channelIds.has(persona.channelId)) memoryPersonas.delete(id);
    }
    return;
  }
  const packs = await withStore<SavedPack[]>('readonly', store => store.getAll());
  const scopedPacks = scopeFilter(packs);
  for (const pack of scopedPacks) {
    await withStore('readwrite', store => store.delete(pack.id));
  }
  // ChannelPersonaRecord has no workspaceId of its own (see saveChannelPersona) —
  // only the personas belonging to a channel visible in this workspace's own
  // pack history are removed, rather than clearing the whole persona store.
  const channelIds = new Set(scopedPacks.map(pack => pack.channelId));
  const personas = await withStore<ChannelPersonaRecord[]>('readonly', store => store.getAll(), PERSONA_STORE);
  for (const persona of personas) {
    if (channelIds.has(persona.channelId)) {
      await withStore('readwrite', store => store.delete(persona.id), PERSONA_STORE);
    }
  }
}

function personaRecordId(channelId: string, personaName: string) {
  return `${channelId}::${personaName.trim().toLowerCase()}`;
}

export async function saveChannelPersona(channelId: string, personaName: string, soundSignature?: SoundSignature): Promise<ChannelPersonaRecord> {
  const trimmed = personaName.trim();
  const id = personaRecordId(channelId, trimmed);
  const now = new Date().toISOString();
  const existing = await loadChannelPersona(id);
  const record: ChannelPersonaRecord = {
    id,
    channelId,
    personaName: trimmed,
    createdAt: existing?.createdAt || now,
    lastUsedAt: existing?.lastUsedAt || now,
    useCount: existing?.useCount || 0,
    soundSignature: soundSignature || existing?.soundSignature
  };
  if (!hasIndexedDb()) {
    memoryPersonas.set(id, record);
    return record;
  }
  await withStore('readwrite', store => store.put(record), PERSONA_STORE);
  return record;
}

async function loadChannelPersona(id: string): Promise<ChannelPersonaRecord | undefined> {
  if (!hasIndexedDb()) return memoryPersonas.get(id);
  return withStore<ChannelPersonaRecord | undefined>('readonly', store => store.get(id), PERSONA_STORE);
}

export async function recordChannelPersonaUse(channelId: string, personaName: string, soundSignature?: SoundSignature): Promise<ChannelPersonaRecord> {
  const id = personaRecordId(channelId, personaName);
  const now = new Date().toISOString();
  const existing = await loadChannelPersona(id);
  const record: ChannelPersonaRecord = {
    id,
    channelId,
    personaName: personaName.trim(),
    createdAt: existing?.createdAt || now,
    lastUsedAt: now,
    useCount: (existing?.useCount || 0) + 1,
    soundSignature: soundSignature || existing?.soundSignature
  };
  if (!hasIndexedDb()) {
    memoryPersonas.set(id, record);
    return record;
  }
  await withStore('readwrite', store => store.put(record), PERSONA_STORE);
  return record;
}

export async function listChannelPersonas(channelId: string): Promise<ChannelPersonaRecord[]> {
  const records = hasIndexedDb()
    ? await withStore<ChannelPersonaRecord[]>('readonly', store => store.getAll(), PERSONA_STORE)
    : Array.from(memoryPersonas.values());
  return records
    .filter(record => record.channelId === channelId)
    .sort((a, b) => (a.lastUsedAt < b.lastUsedAt ? 1 : -1));
}

async function getProgressRecord(packId: string): Promise<PackProgressRecord | undefined> {
  return hasIndexedDb()
    ? withStore<PackProgressRecord | undefined>('readonly', store => store.get(packId), PROGRESS_STORE)
    : memoryProgress.get(packId);
}

export async function getPackProgress(packId: string): Promise<number[]> {
  const record = await getProgressRecord(packId);
  return record?.doneTrackNos || [];
}

/** TASK v3.31 — companion to getPackProgress: the per-track "last pasted" timestamps set by markTrackPasted below. */
export async function getPackPastedAt(packId: string): Promise<Record<number, string>> {
  const record = await getProgressRecord(packId);
  return record?.pastedAt || {};
}

export async function setTrackProgress(packId: string, trackNo: number, done: boolean): Promise<number[]> {
  const existing = await getProgressRecord(packId);
  const current = existing?.doneTrackNos || [];
  const next = done
    ? Array.from(new Set([...current, trackNo])).sort((a, b) => a - b)
    : current.filter(no => no !== trackNo);
  // Preserve pastedAt/focusCursorTrackNo — this record is put() wholesale, so a naive
  // {id, doneTrackNos, updatedAt} write here would silently wipe out
  // markTrackPasted's/setFocusCursor's history the next time either function runs.
  const record: PackProgressRecord = { id: packId, doneTrackNos: next, updatedAt: new Date().toISOString(), pastedAt: existing?.pastedAt, focusCursorTrackNo: existing?.focusCursorTrackNo };
  if (!hasIndexedDb()) {
    memoryProgress.set(packId, record);
    return next;
  }
  await withStore('readwrite', store => store.put(record), PROGRESS_STORE);
  return next;
}

/**
 * TASK v3.31 — records when Progress Mode finished copying every field for a
 * track (not necessarily marked "done" — that's still a separate, manual
 * toggle). Lightweight by design: this only ever touches the existing
 * suno_progress record, never a full savePack() round trip, so it's cheap
 * enough to call after every song's last copy.
 */
export async function markTrackPasted(packId: string, trackNo: number): Promise<Record<number, string>> {
  const existing = await getProgressRecord(packId);
  const pastedAt = { ...(existing?.pastedAt || {}), [trackNo]: new Date().toISOString() };
  const record: PackProgressRecord = { id: packId, doneTrackNos: existing?.doneTrackNos || [], updatedAt: new Date().toISOString(), pastedAt, focusCursorTrackNo: existing?.focusCursorTrackNo };
  if (!hasIndexedDb()) {
    memoryProgress.set(packId, record);
    return pastedAt;
  }
  await withStore('readwrite', store => store.put(record), PROGRESS_STORE);
  return pastedAt;
}

/** v4.2 (TASK A) — companion to getPackProgress: which trackNo AudioAnalysisPanel's focus mode was last reviewing, set by setFocusCursor below. */
export async function getFocusCursor(packId: string): Promise<number | undefined> {
  const record = await getProgressRecord(packId);
  return record?.focusCursorTrackNo;
}

/** v4.2 (TASK A) — persists AudioAnalysisPanel's focus-mode cursor, same put()-wholesale/preserve-the-rest pattern as markTrackPasted above. */
export async function setFocusCursor(packId: string, trackNo: number): Promise<number> {
  const existing = await getProgressRecord(packId);
  const record: PackProgressRecord = {
    id: packId,
    doneTrackNos: existing?.doneTrackNos || [],
    updatedAt: new Date().toISOString(),
    pastedAt: existing?.pastedAt,
    focusCursorTrackNo: trackNo
  };
  if (!hasIndexedDb()) {
    memoryProgress.set(packId, record);
    return trackNo;
  }
  await withStore('readwrite', store => store.put(record), PROGRESS_STORE);
  return trackNo;
}

export async function getConceptCache(cacheKey: string): Promise<string | undefined> {
  const record = hasIndexedDb()
    ? await withStore<ConceptCacheRecord | undefined>('readonly', store => store.get(cacheKey), CONCEPT_CACHE_STORE)
    : memoryConceptCache.get(cacheKey);
  return record?.resultJson;
}

export async function setConceptCache(cacheKey: string, resultJson: string): Promise<void> {
  const record: ConceptCacheRecord = { id: cacheKey, resultJson, cachedAt: new Date().toISOString() };
  if (!hasIndexedDb()) {
    memoryConceptCache.set(cacheKey, record);
    return;
  }
  await withStore('readwrite', store => store.put(record), CONCEPT_CACHE_STORE);
}

export async function getConceptHistory(channelId: string): Promise<string[]> {
  const record = hasIndexedDb()
    ? await withStore<ConceptHistoryRecord | undefined>('readonly', store => store.get(channelId), CONCEPT_HISTORY_STORE)
    : memoryConceptHistory.get(channelId);
  return record?.inputs || [];
}

/**
 * v4.0 (TASK A1, migration) — tags every pre-v4.0 pack (no workspaceId at
 * all) as 'senior-oldpop', the one workspace that existed before this task.
 * Additive only: never deletes a pack, only backfills the workspaceId field
 * on records that don't already have one. Idempotent — running it again once
 * every pack is already tagged is a correct no-op.
 */
export async function migrateLibraryWorkspaceTags(): Promise<{ totalRecords: number; taggedSeniorOldpop: number }> {
  if (!hasIndexedDb()) {
    for (const [id, pack] of memoryPacks) {
      if (!pack.workspaceId) memoryPacks.set(id, { ...pack, workspaceId: DEFAULT_WORKSPACE_ID });
    }
    const all = Array.from(memoryPacks.values());
    return { totalRecords: all.length, taggedSeniorOldpop: all.filter(p => (p.workspaceId ?? DEFAULT_WORKSPACE_ID) === DEFAULT_WORKSPACE_ID).length };
  }
  const all = await withStore<SavedPack[]>('readonly', store => store.getAll());
  for (const pack of all) {
    if (!pack.workspaceId) await withStore('readwrite', store => store.put({ ...pack, workspaceId: DEFAULT_WORKSPACE_ID }));
  }
  return { totalRecords: all.length, taggedSeniorOldpop: all.filter(p => (p.workspaceId ?? DEFAULT_WORKSPACE_ID) === DEFAULT_WORKSPACE_ID).length };
}

/**
 * v5.17 (TASK A §1-3 item 1) — same shape/contract as
 * migrateLibraryWorkspaceTags just above: additive-only (only ever narrows
 * generationSnapshot.provider, never touches songs/options/anything else),
 * idempotent, reads the raw (unscoped) store directly across every
 * workspace in one pass — a leaked apiKey doesn't stop mattering just
 * because the workspace it's in isn't the one currently open. Run
 * unconditionally on every app start (core/workspaceMigration.ts's
 * runSnapshotSecretMigrationOnce), not gated behind the v4.0 backup prompt —
 * removing a secret is a strict safety improvement, never data loss a user
 * needs to be warned about first.
 */
export async function migrateLibrarySnapshotSecrets(): Promise<{ totalRecords: number; scrubbed: number }> {
  if (!hasIndexedDb()) {
    let scrubbed = 0;
    for (const [id, pack] of memoryPacks) {
      const result = scrubPackSnapshotSecrets(pack);
      if (result.scrubbed) {
        memoryPacks.set(id, result.pack);
        scrubbed += 1;
      }
    }
    return { totalRecords: memoryPacks.size, scrubbed };
  }
  const all = await withStore<SavedPack[]>('readonly', store => store.getAll());
  let scrubbed = 0;
  for (const pack of all) {
    const result = scrubPackSnapshotSecrets(pack);
    if (result.scrubbed) {
      await withStore('readwrite', store => store.put(result.pack));
      scrubbed += 1;
    }
  }
  return { totalRecords: all.length, scrubbed };
}

/**
 * v4.1 (TASK A2) — export-oriented reads: the FULL pack record (blueprint +
 * options included, unlike listPacks()'s meta-only shape), for one explicit
 * workspace regardless of the current one. Never used by the wizard itself.
 */
export async function listFullPacksForWorkspace(workspaceId: WorkspaceId): Promise<SavedPack[]> {
  const all = hasIndexedDb()
    ? await withStore<SavedPack[]>('readonly', store => store.getAll())
    : Array.from(memoryPacks.values());
  return scopeFilter(all, workspaceId).map(normalizeSavedPack);
}

/**
 * v4.1 (TASK A2) — writes a pack record exactly as given (no id
 * regeneration, no autosave-slot rewriting) — the import path's own
 * primitive. `workspaceId` is stamped from the CURRENT workspace, never from
 * whatever the source file's pack happened to carry, since import always
 * means "bring this into the workspace I'm in now".
 */
export async function putFullPack(pack: SavedPack): Promise<void> {
  const stamped = { ...pack, workspaceId: currentWorkspaceId() };
  if (!hasIndexedDb()) {
    memoryPacks.set(stamped.id, stamped);
    return;
  }
  await withStore('readwrite', store => store.put(stamped));
}

/** v4.1 (TASK A2) — the import merge key: spec's own "setName 기준" (a pack's own `name` field is the set's display name), scoped to the target workspace so importing into a different workspace never treats another workspace's same-named pack as a duplicate. */
export async function findPackByName(workspaceId: WorkspaceId, name: string): Promise<SavedPack | undefined> {
  const packs = await listFullPacksForWorkspace(workspaceId);
  return packs.find(pack => pack.name === name);
}

export async function addConceptHistory(channelId: string, input: string): Promise<string[]> {
  const trimmed = input.trim();
  if (!trimmed) return getConceptHistory(channelId);
  const current = await getConceptHistory(channelId);
  const next = [trimmed, ...current.filter(item => item !== trimmed)].slice(0, CONCEPT_HISTORY_MAX);
  const record: ConceptHistoryRecord = { id: channelId, channelId, inputs: next, updatedAt: new Date().toISOString() };
  if (!hasIndexedDb()) {
    memoryConceptHistory.set(channelId, record);
    return next;
  }
  await withStore('readwrite', store => store.put(record), CONCEPT_HISTORY_STORE);
  return next;
}
