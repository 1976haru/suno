import type { ChannelArchetype, LyricLanguage, PackGeneratedBy, PlaylistBlueprint, WorkspaceId } from '../types';
import { currentWorkspaceId } from './workspaceScope';
import { resolveArchetypeForChannel, resolveWorkspaceIdForChannel } from './channelWorkspaceResolution';
import { validateProviderTrackSet, describeTrackSetValidation, resolveEffectiveTrackNo } from './importValidation';
import { recordPackSituations, listAllSituationsForWorkspace, type SituationUsage } from './situationLedger';
import { recordPackHooks } from './hookLedger';
import { recordPackLyricLines } from './lyricLineLedger';
import { recordPackFingerprints } from './promptFingerprintLedger';
import { lyricThemesForArchetype } from '../data/lyricThemes';

/**
 * 지시문 14 (TASK D) — registers a coding agent's past songs-output.json
 * packs into this app's OWN avoid-list ledgers (situationLedger/hookLedger/
 * lyricLineLedger/promptFingerprintLedger), for packs that were generated
 * and saved to disk (lyrics/*.json) before this app ever recorded them. A
 * real, measured gap this directive's own §1-4 names: "하루가 만든 세트 중
 * 상당수가 JSON 파일로만 존재한다. 앱이 모르는 것은 회피할 수 없다."
 *
 * Deliberately the opposite of 지시문 13 TASK A's parseSongsJsonForViewer:
 * that function is read-only display and records NOTHING; this function
 * records history and displays/saves NOTHING (no library pack, no result
 * screen, no current-channel/option mutation — see this file's own §D-2
 * "절대 안 한다" list). The two intentionally share no code — reusing
 * parseSongsJsonForViewer's SongIdea-shaped output here would drag its
 * display-only defaults (effectiveArchetype hardcoded, qualityScore 0, no
 * validation past VIEWER_REQUIRED_FIELDS) into a ledger write path that
 * needs its own, narrower structural gate instead (see planBackfillSource
 * below).
 *
 * Also deliberately does not touch core/bridgeImport.ts — no signature
 * there changes, no function there is extended. Where the same structural
 * check already exists as a pure, exported function elsewhere
 * (core/importValidation.ts's validateProviderTrackSet), it's called, not
 * re-implemented.
 */

export interface BackfillSource {
  fileName: string;
  json: unknown;
  /** meta 에서 못 읽으면 사용자가 지정 */
  workspaceId?: WorkspaceId;
  channelId?: string;
  language?: LyricLanguage;
  /**
   * 지시문 18 (TASK C-2) — "지시문 14 TASK D 의 과거 이력 등록에서도
   * 사용자가 지정할 수 있게 한다". 이 함수는 (파일 헤더 자신의 §D-2가
   * 명시하듯) library 팩을 만들지 않는다 — situationLedger 등 4개 회피
   * 목록에만 기록한다. 그래서 이 값은 SavedPack.generatedBy처럼 집계 화면의
   * qualityScore 통계에 들어가지 않는다(백필된 파일은 재구성된 quality
   * score 자체가 없다 — 이 파일 자신의 §D-2 "quality score를 지어내지
   * 않는다"와 같은 이유). BackfillResult로 그대로 반향돼 등록 결과 화면에서
   * "이 파일들을 codex로 기록했습니다"를 보여주는 용도로만 쓰인다.
   */
  generatedBy?: PackGeneratedBy;
  generatedByNote?: string;
}

export interface BackfillResult {
  fileName: string;
  status: 'registered' | 'skipped-duplicate' | 'invalid';
  packId?: string;
  songCount?: number;
  reasonKo?: string;
  generatedBy?: PackGeneratedBy;
}

/** The subset of a raw bridge-JSON song entry the 4 avoid-list ledgers actually read — see recordPackSituations/recordPackHooks/recordPackLyricLines/recordPackFingerprints's own bodies for exactly which fields each one touches. Deliberately NOT a full SongIdea (that would require reconciling a slot plan/quality score/effective-archetype this backfill has no business inventing — see this file's own header comment). */
interface BackfillSong {
  trackNo: number;
  title: string;
  hookPhrase: string;
  lyrics: string;
  listenerSituation: string;
  lyricThemeText: string;
  lyricTheme?: string;
  lyricThemeMotionKo?: string;
  lyricThemeCastKo?: string;
  lyricThemeEraSettingKo?: string;
  lyricFrameId?: string;
  promptFingerprint?: string;
  arrangementRecipe?: string;
}

const REQUIRED_SONG_FIELDS = ['title', 'hookPhrase', 'stylePrompt', 'lyrics'] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

interface RawMeta {
  setName?: string;
  generatedAt?: string;
  channelId?: string;
  songCount?: number;
  lyricLanguage?: string;
  packId?: string;
}

function extractMeta(json: unknown): RawMeta {
  if (!json || typeof json !== 'object') return {};
  const meta = (json as Record<string, unknown>).meta;
  if (!meta || typeof meta !== 'object') return {};
  const obj = meta as Record<string, unknown>;
  return {
    ...(isNonEmptyString(obj.setName) ? { setName: obj.setName } : {}),
    ...(isNonEmptyString(obj.generatedAt) ? { generatedAt: obj.generatedAt } : {}),
    ...(isNonEmptyString(obj.channelId) ? { channelId: obj.channelId } : {}),
    ...(typeof obj.songCount === 'number' ? { songCount: obj.songCount } : {}),
    ...(isNonEmptyString(obj.lyricLanguage) ? { lyricLanguage: obj.lyricLanguage } : {}),
    ...(isNonEmptyString(obj.packId) ? { packId: obj.packId } : {})
  };
}

function extractRawSongs(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object' && Array.isArray((json as Record<string, unknown>).songs)) {
    return (json as { songs: unknown[] }).songs;
  }
  return [];
}

const VALID_LYRIC_LANGUAGES: readonly LyricLanguage[] = ['english', 'korean', 'japanese', 'bilingual'];

type ParsedSource =
  | { status: 'invalid'; reasonKo: string }
  | {
      status: 'parsed';
      workspaceId: WorkspaceId;
      channelId: string;
      language: LyricLanguage;
      packId: string;
      songs: BackfillSong[];
    };

/**
 * Pure — structural parsing/validation/field-resolution only, no IndexedDB
 * access. Mirrors core/bridgeImport.ts's own "block the whole file, never a
 * partial import" policy for a structurally broken response (see that
 * file's parseSongsJsonForViewer doc comment for why a hard, whole-file gate
 * is the right call here too — a ledger write is exactly the kind of
 * operation a corrupt/adversarial file must never partially poison).
 */
export function planBackfillSource(source: BackfillSource): ParsedSource {
  const meta = extractMeta(source.json);
  const rawSongs = extractRawSongs(source.json);
  if (!rawSongs.length) {
    return { status: 'invalid', reasonKo: '"songs" 배열을 찾지 못했거나 비어 있습니다.' };
  }

  const channelId = source.channelId ?? meta.channelId;
  if (!channelId) {
    return { status: 'invalid', reasonKo: 'channelId를 확인할 수 없습니다 (meta.channelId 없음, 수동 지정도 없음).' };
  }

  const metaLanguage = meta.lyricLanguage && VALID_LYRIC_LANGUAGES.includes(meta.lyricLanguage as LyricLanguage)
    ? (meta.lyricLanguage as LyricLanguage)
    : undefined;
  const language = source.language ?? metaLanguage;
  if (!language) {
    return { status: 'invalid', reasonKo: 'lyricLanguage를 확인할 수 없습니다 (meta.lyricLanguage 없음/알 수 없는 값, 수동 지정도 없음).' };
  }

  const rawTrackNoEntries = rawSongs.map(raw => ({
    trackNo: raw && typeof raw === 'object' ? (raw as Record<string, unknown>).trackNo : undefined
  }));
  const trackSetValidation = validateProviderTrackSet(rawTrackNoEntries, rawSongs.length);
  if (!trackSetValidation.valid) {
    return { status: 'invalid', reasonKo: `trackNo 구조 오류 (${describeTrackSetValidation(trackSetValidation)}).` };
  }

  const fieldFailures: string[] = [];
  const songs: BackfillSong[] = [];
  rawSongs.forEach((raw, index) => {
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const missing = REQUIRED_SONG_FIELDS.filter(field => !isNonEmptyString(obj[field]));
    if (missing.length) {
      const label = isNonEmptyString(obj.title) ? obj.title : `#${index + 1}`;
      fieldFailures.push(`"${label}": ${missing.join(', ')} 없음`);
      return;
    }
    songs.push({
      trackNo: resolveEffectiveTrackNo(obj.trackNo, index),
      title: String(obj.title),
      hookPhrase: String(obj.hookPhrase),
      lyrics: String(obj.lyrics),
      listenerSituation: isNonEmptyString(obj.listenerSituation) ? obj.listenerSituation : '',
      lyricThemeText: isNonEmptyString(obj.lyricThemeText) ? obj.lyricThemeText : '',
      ...(isNonEmptyString(obj.lyricTheme) ? { lyricTheme: obj.lyricTheme } : {}),
      ...(isNonEmptyString(obj.lyricThemeMotionKo) ? { lyricThemeMotionKo: obj.lyricThemeMotionKo } : {}),
      ...(isNonEmptyString(obj.lyricThemeCastKo) ? { lyricThemeCastKo: obj.lyricThemeCastKo } : {}),
      ...(isNonEmptyString(obj.lyricThemeEraSettingKo) ? { lyricThemeEraSettingKo: obj.lyricThemeEraSettingKo } : {}),
      ...(isNonEmptyString(obj.lyricFrameId) ? { lyricFrameId: obj.lyricFrameId } : {}),
      ...(isNonEmptyString(obj.promptFingerprint) ? { promptFingerprint: obj.promptFingerprint } : {}),
      ...(isNonEmptyString(obj.arrangementRecipe) ? { arrangementRecipe: obj.arrangementRecipe } : {})
    });
  });
  if (fieldFailures.length) {
    return { status: 'invalid', reasonKo: `필수 필드가 없는 곡이 있습니다 — ${fieldFailures.join(' / ')}` };
  }

  const workspaceId = source.workspaceId ?? resolveWorkspaceIdForChannel(channelId) ?? currentWorkspaceId();
  const packId = meta.packId ?? (meta.setName && meta.generatedAt ? `${meta.setName}@${meta.generatedAt}` : source.fileName.replace(/\.json$/i, ''));

  return { status: 'parsed', workspaceId, channelId, language, packId, songs };
}

/**
 * 지시문 14 (TASK D) — the async orchestrator. Per source: plan (pure), then
 * check for an already-registered packId WITHIN the resolved workspace
 * (packId is not guaranteed globally unique across workspaces — same
 * reasoning hookLedger.ts's own 'autosave-temp' doc comment gives), then
 * write to all 4 ledgers. Never saves to the pack library, never displays a
 * result, never touches the current channel/options — see this file's own
 * header comment's §D-2 list.
 */
export async function backfillHistoryFromPacks(sources: BackfillSource[]): Promise<BackfillResult[]> {
  const results: BackfillResult[] = [];
  const registeredPackIdsByWorkspace = new Map<WorkspaceId, Set<string>>();

  async function existingPackIds(workspaceId: WorkspaceId): Promise<Set<string>> {
    const cached = registeredPackIdsByWorkspace.get(workspaceId);
    if (cached) return cached;
    const records = await listAllSituationsForWorkspace(workspaceId);
    const ids = new Set(records.map(r => r.packId));
    registeredPackIdsByWorkspace.set(workspaceId, ids);
    return ids;
  }

  for (const source of sources) {
    const planned = planBackfillSource(source);
    if (planned.status === 'invalid') {
      results.push({ fileName: source.fileName, status: 'invalid', reasonKo: planned.reasonKo });
      continue;
    }

    const known = await existingPackIds(planned.workspaceId);
    if (known.has(planned.packId)) {
      results.push({ fileName: source.fileName, status: 'skipped-duplicate', packId: planned.packId, reasonKo: '이미 등록됨 — 건너뜀', generatedBy: source.generatedBy });
      continue;
    }

    // These 4 ledgers only ever read `blueprint.songs` (see this file's own
    // header comment) — a full PlaylistBlueprint is never actually needed.
    const blueprint = { songs: planned.songs } as unknown as PlaylistBlueprint;
    await Promise.all([
      recordPackSituations(planned.packId, planned.channelId, blueprint, planned.language),
      recordPackHooks(planned.packId, planned.channelId, blueprint, planned.language),
      recordPackLyricLines(planned.packId, planned.channelId, blueprint, planned.language),
      recordPackFingerprints(planned.packId, planned.channelId, blueprint)
    ]);

    known.add(planned.packId);
    results.push({ fileName: source.fileName, status: 'registered', packId: planned.packId, songCount: planned.songs.length, generatedBy: source.generatedBy });
  }

  return results;
}

// ---------------------------------------------------------------------------
// D-5 — 등록 후 이력 규모 진단
// ---------------------------------------------------------------------------

export interface ArchetypeThemeCoverage {
  archetype: ChannelArchetype;
  candidateThemeCount: number;
  usedThemeCount: number;
  remainingThemeCount: number;
  avoidWindowSets: number;
  remainingAfterAvoidWindow: number;
  neededPerSet: number;
  warningKo?: string;
}

export interface WorkspaceHistoryDiagnostic {
  workspaceId: WorkspaceId;
  setCount: number;
  sceneCount: number;
  uniqueSceneCount: number;
  archetypeCoverage: ArchetypeThemeCoverage[];
}

/**
 * Pure — the real diagnostic math, separated from the IndexedDB read
 * (diagnoseWorkspaceHistory below) so it's testable in Node without a
 * browser IndexedDB polyfill (same split this whole file's own
 * planBackfillSource/backfillHistoryFromPacks pair, and every other ledger
 * in this codebase, already uses).
 */
export function computeWorkspaceHistoryDiagnostic(
  workspaceId: WorkspaceId,
  records: Pick<SituationUsage, 'packId' | 'situation' | 'channelId' | 'lyricTheme' | 'usedAt'>[],
  archetypeForChannel: (channelId: string) => ChannelArchetype | undefined,
  language: LyricLanguage,
  songCountPerSet = 18,
  avoidWindowSets = 5
): WorkspaceHistoryDiagnostic {
  const setCount = new Set(records.map(r => r.packId)).size;
  const sceneCount = records.length;
  const uniqueSceneCount = new Set(records.map(r => r.situation)).size;

  const channelArchetype = new Map<string, ChannelArchetype | undefined>();
  for (const r of records) {
    if (!channelArchetype.has(r.channelId)) channelArchetype.set(r.channelId, archetypeForChannel(r.channelId));
  }
  const archetypesSeen = new Set(Array.from(channelArchetype.values()).filter((a): a is ChannelArchetype => Boolean(a)));

  const packOrder = Array.from(new Set(records.slice().sort((a, b) => (a.usedAt < b.usedAt ? 1 : -1)).map(r => r.packId)));
  const recentPackIds = new Set(packOrder.slice(0, avoidWindowSets));

  const archetypeCoverage: ArchetypeThemeCoverage[] = Array.from(archetypesSeen).map(archetype => {
    const channelIds = new Set(Array.from(channelArchetype.entries()).filter(([, a]) => a === archetype).map(([c]) => c));
    const ownRecords = records.filter(r => channelIds.has(r.channelId));
    const candidateThemeCount = lyricThemesForArchetype(archetype, undefined, language).length;
    const usedThemeIds = new Set(ownRecords.filter(r => r.lyricTheme).map(r => r.lyricTheme!));
    const usedThemeCount = usedThemeIds.size;
    const remainingThemeCount = Math.max(0, candidateThemeCount - usedThemeCount);
    const avoidedThemeIds = new Set(ownRecords.filter(r => recentPackIds.has(r.packId) && r.lyricTheme).map(r => r.lyricTheme!));
    const remainingAfterAvoidWindow = Math.max(0, candidateThemeCount - avoidedThemeIds.size);
    const warningKo = remainingAfterAvoidWindow < songCountPerSet
      ? `⚠ 최근 ${avoidWindowSets}세트 회피 시 남는 후보 ${remainingAfterAvoidWindow}종 < ${songCountPerSet}곡 필요 → 테마 풀 확장 필요 (지시문 14 Phase 2 TASK B)`
      : undefined;
    return {
      archetype,
      candidateThemeCount,
      usedThemeCount,
      remainingThemeCount,
      avoidWindowSets,
      remainingAfterAvoidWindow,
      neededPerSet: songCountPerSet,
      ...(warningKo ? { warningKo } : {})
    };
  });

  return { workspaceId, setCount, sceneCount, uniqueSceneCount, archetypeCoverage };
}

export async function diagnoseWorkspaceHistory(workspaceId: WorkspaceId, language: LyricLanguage, songCountPerSet = 18, avoidWindowSets = 5): Promise<WorkspaceHistoryDiagnostic> {
  const records = await listAllSituationsForWorkspace(workspaceId);
  return computeWorkspaceHistoryDiagnostic(workspaceId, records, resolveArchetypeForChannel, language, songCountPerSet, avoidWindowSets);
}

/** Korean-language console/UI text matching this directive's own §D-5 example format. */
export function formatWorkspaceHistoryDiagnostic(diag: WorkspaceHistoryDiagnostic): string {
  const lines = [
    `${diag.workspaceId} 이력`,
    `  세트 ${diag.setCount}개 · 장면 ${diag.sceneCount}개 (고유 ${diag.uniqueSceneCount}개)`
  ];
  if (!diag.archetypeCoverage.length) {
    lines.push('  아키타입 해석 불가 — 테마 풀 대조 생략 (채널이 커스텀이거나 이 환경에 로컬 채널 정보가 없음)');
  }
  for (const coverage of diag.archetypeCoverage) {
    lines.push(`  [${coverage.archetype}] 테마 후보 ${coverage.candidateThemeCount}종 중 사용됨 ${coverage.usedThemeCount}종 — 여유 ${coverage.remainingThemeCount}종`);
    if (coverage.warningKo) lines.push(`  ${coverage.warningKo}`);
  }
  return lines.join('\n');
}
