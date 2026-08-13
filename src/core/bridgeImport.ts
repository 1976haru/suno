import type {
  BilingualPair,
  ChannelArchetype,
  GenerationOptions,
  GenrePack,
  LyricLanguage,
  MoodPack,
  PlaylistBlueprint,
  PreassignedSongSlot,
  SeasonPack,
  SongIdea,
  YoutubeMetadata
} from '../types';
import { buildSignatureBlueprint, resolveBilingualPair } from './localGenerator';
import { scoreSongs } from './quality';
import { claimSlotsByTrackNo, reconcileWithPreassignedSlot } from './batchPreallocation';
import { describeTrackSetValidation, resolveEffectiveTrackNo, validateProviderTrackSet } from './importValidation';
import { dedupeTitlesAcrossPack } from './lyricEngine';
import { lintInPackLyricDiversity, lintInPackStyleSimilarity } from './diversityLinter';
import { sanitizePublicYoutubeTags } from './exportCompliance';
import { normalizeSongOutput } from './songPostProcess';
import { resolveTitleLocalizedLanguage } from './packagingLanguage';
import { buildLocalizedTitle, buildTitleDisplay, localizedTitleSeed } from './titleLocalization';
import { checkLyricLineOverlap, checkSceneOverlap, checkTitleHistoryCollision } from './duplicationGate';
import { lyricLanguageMismatchWarning } from './lyricMetrics';
import { checkDistinctChoices } from './distinctChoiceCheck';
import { coerceDistinctChoice } from './distinctChoiceTypes';
import { APP_VERSION } from './buildInfo';
import { findGarbledLyricLines } from './lyricGarbleLint';

/**
 * v3.66 (TASK C) — split out of claudeCodeBridge.ts. This module is the
 * import-side half of the bridge: reads a coding agent's songs-output.json
 * back in and pushes it through the exact same quality/safety pipeline
 * (core/quality.ts's scoreSongs) every API-generated song already goes
 * through. The instruction-text builder lives in bridgeInstruction.ts; the
 * recompose-instruction builder lives in bridgeRecompose.ts.
 * claudeCodeBridge.ts re-exports all three so no other file's import path
 * needed to change. Pure move — no logic was altered.
 */

const REQUIRED_SONG_FIELDS = ['title', 'hookPhrase', 'stylePrompt', 'lyrics'] as const;

/**
 * TASK v3.22 pattern reused client-side (that file's cleanJsonText mirrors
 * api/generate.js's): a coding agent's output file is exactly as likely to
 * pick up a stray ```json fence or a sentence of prose as a raw API
 * response, so the same lenient stripping applies here.
 */
function cleanJsonText(text: string): string {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return (fenced ? fenced[1] : raw).trim();
}

function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return text;
  return text.slice(start, end + 1);
}

function extractJsonArray(text: string): string {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return text;
  return text.slice(start, end + 1);
}

function parseLeniently(rawText: string): unknown {
  const cleaned = cleanJsonText(rawText);
  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through to the extraction passes below
  }
  try {
    return JSON.parse(extractJsonObject(cleaned));
  } catch {
    // fall through — a bare array (no {"songs": ...} wrapper) is still accepted
  }
  return JSON.parse(extractJsonArray(cleaned));
}

function extractSongsArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { songs?: unknown }).songs)) {
    return (parsed as { songs: unknown[] }).songs;
  }
  return [];
}

/**
 * TASK (import transaction / pre-persistence inspection) — exposes the raw,
 * pre-normalization songs array for a bridge JSON import, purely as a
 * diagnostic input for core/importInspection.ts (e.g. recovering
 * validateProviderTrackSet's own `missing` trackNo list — importSongsJson
 * runs that check internally but ImportSongsReport never surfaces it — and
 * detecting whether a vocal meta-tag actually needed auto-correction).
 * Reuses this module's own parseLeniently/extractSongsArray — not a second
 * parser, and importSongsJson's own parsing/normalization logic is
 * untouched. Returns [] for anything that fails to parse, mirroring
 * importSongsJson's own tolerant behavior (the caller already gets that
 * same failure reported through importSongsJson's real report).
 */
export function extractRawImportedSongs(rawText: string): unknown[] {
  try {
    return extractSongsArray(parseLeniently(rawText));
  } catch {
    return [];
  }
}

export interface BridgeImportMeta {
  setName?: string;
  generatedAt?: string;
  channelId?: string;
  channelLabel?: string;
  conceptLabel?: string;
  songCount?: number;
  lyricLanguage?: string;
  /** 지시문 18 (TASK C-2) — core/bridgeInstruction.ts의 buildBridgeMeta가 요청 payload에 실은 버전을 LLM이 그대로 복사했을 때만 채워진다. */
  bridgeVersion?: string;
}

/**
 * TASK v3.69 (TASK D) — reads a bridge output file's optional top-level
 * "meta" block, added purely so an import can auto-select the channel it was
 * actually generated for (via channelId/channelLabel) and stamp the
 * blueprint's generatedAt with the real generation time instead of the
 * import-moment "now" — see buildSignatureBlueprint's own generatedAt
 * parameter. A file written before this task existed has no "meta" key at
 * all; this returns null for that case (and for anything unparseable)
 * rather than throwing, so callers can fall back to their pre-v3.69
 * behavior unconditionally.
 */
export function extractBridgeImportMeta(rawText: string): BridgeImportMeta | null {
  let parsed: unknown;
  try {
    parsed = parseLeniently(rawText);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const meta = (parsed as { meta?: unknown }).meta;
  if (!meta || typeof meta !== 'object') return null;
  const obj = meta as Record<string, unknown>;
  return {
    ...(isNonEmptyString(obj.setName) ? { setName: obj.setName } : {}),
    ...(isNonEmptyString(obj.generatedAt) ? { generatedAt: obj.generatedAt } : {}),
    ...(isNonEmptyString(obj.channelId) ? { channelId: obj.channelId } : {}),
    ...(isNonEmptyString(obj.channelLabel) ? { channelLabel: obj.channelLabel } : {}),
    ...(isNonEmptyString(obj.conceptLabel) ? { conceptLabel: obj.conceptLabel } : {}),
    ...(typeof obj.songCount === 'number' ? { songCount: obj.songCount } : {}),
    ...(isNonEmptyString(obj.lyricLanguage) ? { lyricLanguage: obj.lyricLanguage } : {}),
    ...(isNonEmptyString(obj.bridgeVersion) ? { bridgeVersion: obj.bridgeVersion } : {})
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

const VALID_LYRIC_LANGUAGES: readonly LyricLanguage[] = ['english', 'korean', 'japanese', 'bilingual'];

export interface BridgeImportMetaReconciliation {
  /** Present only when meta.lyricLanguage disagreed with the screen's current setting — the caller should use this instead of opts.lyricLanguage for this import. */
  lyricLanguage?: LyricLanguage;
  /** Present only when meta.songCount disagreed with the screen's current setting — the caller should use this instead of opts.songCount for this import (it drives slot preallocation, so a stale screen count here would build the wrong number of slots for the file's real content). */
  songCount?: number;
  /** Korean-language warning strings ready to append to an ImportSongsReport.warnings array (or a multi-set input's own warning surface) — empty when meta agreed with the screen or nothing needed overriding. */
  warnings: string[];
}

/**
 * TASK v5.18 P1-7 — real gap this task's audit found: extractBridgeImportMeta
 * already reads meta.lyricLanguage/meta.songCount off a bridge file (has done
 * since v3.69 TASK D), but nothing ever compared them against the screen's
 * current opts — a file generated as a Korean 12-song set imported while the
 * screen was still set to English/18 silently imported under English/18,
 * with the mismatch never surfaced anywhere. The file's own meta is what
 * actually describes what was generated, so it wins over stale screen state
 * whenever the two disagree; a file with no meta block at all (older, pre-
 * v3.69 export) can't be trusted this way and falls back to the screen
 * setting with an explicit "구버전 파일" warning instead of failing silently.
 */
export function reconcileImportOptsWithMeta(
  meta: BridgeImportMeta | null,
  opts: Pick<GenerationOptions, 'lyricLanguage' | 'songCount'>
): BridgeImportMetaReconciliation {
  if (!meta) {
    return { warnings: ['구버전 파일입니다 (meta 정보 없음) — 화면에 설정된 언어/곡 수를 그대로 사용합니다. 이 파일이 실제로 어떤 설정으로 생성되었는지 알 수 없으니 언어와 곡 수가 맞는지 직접 확인하세요.'] };
  }
  const warnings: string[] = [];
  const result: BridgeImportMetaReconciliation = { warnings };
  if (meta.lyricLanguage && VALID_LYRIC_LANGUAGES.includes(meta.lyricLanguage as LyricLanguage) && meta.lyricLanguage !== opts.lyricLanguage) {
    result.lyricLanguage = meta.lyricLanguage as LyricLanguage;
    warnings.push(`파일의 meta.lyricLanguage("${meta.lyricLanguage}")가 화면 설정("${opts.lyricLanguage}")과 달라, 파일 기준으로 가져옵니다.`);
  }
  if (typeof meta.songCount === 'number' && meta.songCount > 0 && meta.songCount !== opts.songCount) {
    result.songCount = meta.songCount;
    warnings.push(`파일의 meta.songCount(${meta.songCount})가 화면 설정(${opts.songCount})과 달라, 파일 기준으로 가져옵니다.`);
  }
  return result;
}

interface NormalizeSuccess {
  song: SongIdea;
}

interface NormalizeFailure {
  error: string;
}

function normalizedHookKey(hook: string): string {
  return hook.trim().toLowerCase();
}

function appendWarning(song: SongIdea, warning: string): SongIdea {
  return song.warnings.includes(warning)
    ? song
    : { ...song, warnings: [...song.warnings, warning] };
}

function flagHookCollisions(songs: SongIdea[], avoidHooks: string[] = []): { songs: SongIdea[]; warnings: string[] } {
  const warnings: string[] = [];
  let nextSongs = songs;
  const historicalHooks = new Set(avoidHooks.map(normalizedHookKey).filter(Boolean));
  const byHook = new Map<string, SongIdea[]>();
  for (const song of songs) {
    const key = normalizedHookKey(song.hookPhrase);
    if (!key) continue;
    byHook.set(key, [...(byHook.get(key) ?? []), song]);
  }

  function warnTrack(trackNo: number, warning: string) {
    nextSongs = nextSongs.map(song => song.trackNo === trackNo ? appendWarning(song, warning) : song);
    warnings.push(warning);
  }

  for (const [key, matches] of byHook) {
    if (historicalHooks.has(key)) {
      for (const song of matches) {
        warnTrack(song.trackNo, `Track ${song.trackNo}: hookPhrase "${song.hookPhrase}" duplicates a hook already used by this channel. Regenerate this song; import does not auto-rewrite hooks because that would desync lyrics.`);
      }
    }
    if (matches.length > 1) {
      const trackNos = matches.map(song => song.trackNo).join(', ');
      const warning = `Tracks ${trackNos}: hookPhrase "${matches[0].hookPhrase}" is duplicated within this import. Regenerate one of these songs; import does not auto-rewrite hooks because that would desync lyrics.`;
      for (const song of matches) {
        nextSongs = nextSongs.map(candidate => candidate.trackNo === song.trackNo ? appendWarning(candidate, warning) : candidate);
      }
      warnings.push(warning);
    }
  }

  return { songs: nextSongs, warnings };
}

/**
 * The trackNo a raw bridge JSON entry claims — its own `trackNo` field when
 * present and valid, else this entry's position in the raw array. Pure and
 * side-effect-free so it can be run once up front (importSongsJson, to
 * resolve slot claims via claimSlotsByTrackNo) and reproduced identically
 * inside normalizeImportedSong for `rawSong.trackNo` itself.
 *
 * v5.17 (TASK E) — delegates to core/importValidation.ts's
 * resolveEffectiveTrackNo, the same resolution validateProviderTrackSet now
 * checks duplicates/range against, instead of keeping its own independent
 * (and previously slightly looser — plain `Number(...)`, no integer check)
 * copy of this fallback. Safe by construction: this function only ever runs
 * on a raw entry set that already passed validateProviderTrackSet upstream,
 * so every entry here is already known to be 'absent' or a valid in-range
 * integer, never 'invalid' — see resolveEffectiveTrackNo's own doc comment.
 */
function claimedTrackNoFor(raw: unknown, index: number): number {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return resolveEffectiveTrackNo(obj.trackNo, index);
}

/**
 * Builds the song from the bridge agent's raw JSON, then reconciles only the
 * slot-owned planning fields. Bridge import preserves the agent's hookPhrase
 * and emotionArc so the stored hook stays aligned with the generated lyrics;
 * songRole remains slot-owned because it controls playlist/opening structure.
 * Title behavior still follows titleMode: local mode forces the slot title,
 * while ai-creative mode trusts the imported title unless it is blank.
 *
 * `slot` is passed in already resolved by the caller (importSongsJson) via
 * claimSlotsByTrackNo (TASK duplicate-trackNo fix) — this function no longer
 * does its own `slotByTrackNo.get(claimedTrackNo)` lookup, since two raw
 * entries claiming the same trackNo must not both resolve to the same slot
 * (see claimSlotsByTrackNo's own doc comment for the full mechanism).
 */
function normalizeImportedSong(
  raw: unknown,
  index: number,
  slot: PreassignedSongSlot | undefined,
  titleMode: 'local' | 'ai-creative',
  opts: GenerationOptions,
  usedLocalizedTitles: Set<string>
): NormalizeSuccess | NormalizeFailure {
  if (!raw || typeof raw !== 'object') {
    return { error: `#${index + 1}: JSON 객체가 아닙니다.` };
  }
  const obj = raw as Record<string, unknown>;
  const missing = REQUIRED_SONG_FIELDS.filter(field => !isNonEmptyString(obj[field]));
  if (missing.length) {
    const label = isNonEmptyString(obj.title) ? obj.title : `#${index + 1}`;
    return { error: `"${label}": 필수 필드 누락 (${missing.join(', ')})` };
  }

  // 지시문 37 (TASK E) — 실측(20260810 K-pop 세트, 71/541줄 깨짐)이 가져오기
  // 검사를 그대로 통과했던 결함을 막는다. 원인(LLM 생성측 vs 앱측)은 미확인
  // 이지만, 다른 필드(title/stylePrompt 등)는 0/18로 멀쩡했고 이 함수(336번
  // 줄 String(obj.lyrics))는 lyrics를 가공 없이 그대로 저장하므로 이 검사가
  // 잡아내는 손상은 이미 원본 JSON에 존재했던 것이다 — 인코딩 변환으로
  // "고치지" 않고 통과를 막기만 한다.
  const garbledLines = isNonEmptyString(obj.lyrics) ? findGarbledLyricLines(obj.lyrics) : [];
  if (garbledLines.length) {
    const label = isNonEmptyString(obj.title) ? obj.title : `#${index + 1}`;
    return { error: `"${label}": 가사에 물음표 연속 손상 ${garbledLines.length}줄 발견 (예: "${garbledLines[0]}") — 이 트랙은 가져오기에서 제외됩니다. 재생성이 필요합니다.` };
  }

  const claimedTrackNo = claimedTrackNoFor(raw, index);

  const youtubeRaw = obj.youtube && typeof obj.youtube === 'object' ? (obj.youtube as Record<string, unknown>) : {};
  const youtube: YoutubeMetadata = {
    title: isNonEmptyString(youtubeRaw.title) ? youtubeRaw.title : String(obj.title),
    description: isNonEmptyString(youtubeRaw.description) ? youtubeRaw.description : '',
    // TASK v3.58 (TASK 5-5) — a remote model's tags array is otherwise
    // completely unfiltered; sanitizePublicYoutubeTags strips Suno/AI/model
    // keyword-stuffing before it can reach public YouTube metadata (see
    // exportCompliance.ts — the required disclosure sentence lives only in
    // `description`, never in these discrete discoverability tags).
    tags: sanitizePublicYoutubeTags(Array.isArray(youtubeRaw.tags) ? youtubeRaw.tags.filter((tag): tag is string => typeof tag === 'string') : []),
    ...(isNonEmptyString(youtubeRaw.thumbnailText) ? { thumbnailText: youtubeRaw.thumbnailText } : {})
  };

  const rawSong: SongIdea = {
    trackNo: claimedTrackNo,
    title: String(obj.title),
    seasonMoment: isNonEmptyString(obj.seasonMoment) ? obj.seasonMoment : '',
    listenerSituation: isNonEmptyString(obj.listenerSituation) ? obj.listenerSituation : '',
    emotionArc: isNonEmptyString(obj.emotionArc) ? obj.emotionArc : '',
    hookPhrase: String(obj.hookPhrase),
    stylePrompt: String(obj.stylePrompt),
    ...(isNonEmptyString(obj.excludePrompt) ? { excludePrompt: obj.excludePrompt } : {}),
    lyrics: String(obj.lyrics),
    ...(isNonEmptyString(obj.thumbnailText) ? { thumbnailText: obj.thumbnailText } : {}),
    youtube,
    ...(isNonEmptyString(obj.youtubeTitleKo) ? { youtubeTitleKo: obj.youtubeTitleKo } : {}),
    ...(isNonEmptyString(obj.youtubeTitleJa) ? { youtubeTitleJa: obj.youtubeTitleJa } : {}),
    ...(isNonEmptyString(obj.genreId) ? { genreId: obj.genreId } : {}),
    ...(isNonEmptyString(obj.genreText) ? { genreText: obj.genreText } : {}),
    ...(isNonEmptyString(obj.lyricTheme) ? { lyricTheme: obj.lyricTheme } : {}),
    ...(isNonEmptyString(obj.lyricThemeText) ? { lyricThemeText: obj.lyricThemeText } : {}),
    ...(isNonEmptyString(obj.lyricThemeArc) ? { lyricThemeArc: obj.lyricThemeArc } : {}),
    ...(isNonEmptyString(obj.pov) ? { pov: obj.pov as SongIdea['pov'] } : {}),
    ...(isNonEmptyString(obj.verseStyle) ? { verseStyle: obj.verseStyle as SongIdea['verseStyle'] } : {}),
    ...(isNonEmptyString(obj.verseStyleText) ? { verseStyleText: obj.verseStyleText } : {}),
    ...(isNonEmptyString(obj.chorusStyle) ? { chorusStyle: obj.chorusStyle as SongIdea['chorusStyle'] } : {}),
    ...(isNonEmptyString(obj.chorusStyleText) ? { chorusStyleText: obj.chorusStyleText } : {}),
    // 지시문 50 (TASK D-2) — promptComposer.ts's songOutputShape 자기 doc
    // comment 참고. slot이 있으면 reconcileWithPreassignedSlot이 이 값을
    // slot.effectiveVocalPresetId/vocalPresetSource로 덮어쓰지만(정상 —
    // 슬롯이 신뢰 출처다), slot이 없는 독립 가져오기 경로는
    // noSlotEffectiveFields가 이 두 필드를 건드리지 않으므로(그 함수 자기
    // 주석 참고) 여기서 읽은 값이 그대로 남는다.
    ...(isNonEmptyString(obj.effectiveVocalPresetId) ? { effectiveVocalPresetId: obj.effectiveVocalPresetId } : {}),
    ...(isNonEmptyString(obj.vocalPresetSource) ? { vocalPresetSource: obj.vocalPresetSource as SongIdea['vocalPresetSource'] } : {}),
    // 지시문 15 (TASK A-2/B) — 실제 저장 경로(이 함수)에는 distinctChoice가
    // 아예 빠져 있었다(parseBridgeExportForReview 쪽 미리보기 전용 경로에만
    // 있었음) — 그 결과 실제로 임포트된 모든 팩이 조용히 distinctChoice를
    // 잃고 있었다. coerceDistinctChoice로 신형 구조체/구형 자유 문자열 둘
    // 다 받아들인다.
    ...(() => {
      const parsed = coerceDistinctChoice(obj.distinctChoice);
      return parsed
        ? { distinctChoice: parsed.descriptionKo, distinctChoiceRuleId: parsed.ruleId, ...(parsed.params ? { distinctChoiceParams: parsed.params } : {}) }
        : {};
    })(),
    qualityScore: 0,
    warnings: [],
    // v5.11 (TASK L) — placeholder values only: reconcileWithPreassignedSlot
    // right below is the real resolution point for all 5 of these fields
    // (it always overwrites them from `slot`/`opts.channel.archetype`, even
    // when `slot` is undefined — see that function's own noSlotEffectiveFields)
    // and is guaranteed to run on every path this function returns through.
    effectiveMoneyChordId: '',
    effectiveGenreIds: [],
    effectiveArchetype: opts.channel.archetype || 'senior-morning',
    workspaceId: 'senior-oldpop'
  };
  const reconciled = reconcileWithPreassignedSlot(rawSong, slot, titleMode, { keepHook: true, keepEmotionArc: true, archetype: opts.channel.archetype, lyricLanguage: opts.lyricLanguage, bilingualPair: resolveBilingualPair(opts) });

  // v4.3 (TASK A) — trust the agent's own "titleLocalized" (the real
  // creative reinterpretation instructed by titleLocalizedInstructionLineFor
  // in bridgeInstruction.ts) when present; fall back to the local
  // bank-based builder only if packaging is non-English and the agent
  // omitted it, so the pack is never silently missing a display title —
  // and warn, since an omission means the agent didn't follow the
  // instruction.
  // 지시문 12 (TASK C-2) — resolveTitleLocalizedLanguage: 이 채널의 아키타입이
  // TITLE_LOCALIZED_REQUIRED_ARCHETYPES에 속하면 packagingLanguage 오버라이드가
  // english여도 결측을 항상 신고한다 (이전에는 packagingLanguage==='english'이면
  // 신고 자체가 스킵돼 결측이 조용히 넘어갔다).
  const packagingLanguage = resolveTitleLocalizedLanguage(opts);
  let titleLocalized = isNonEmptyString(obj.titleLocalized) ? obj.titleLocalized.trim() : undefined;
  let missingTitleLocalizedWarning: string | undefined;
  if (packagingLanguage !== 'english' && !titleLocalized) {
    titleLocalized = buildLocalizedTitle(
      packagingLanguage,
      {
        emotionArc: reconciled.emotionArc,
        listenerSituation: reconciled.listenerSituation,
        eraTag: slot?.eraTag,
        archetype: opts.channel.archetype,
        seed: localizedTitleSeed(`${opts.channel.id}-bridge-import`, reconciled.trackNo)
      },
      usedLocalizedTitles
    );
    missingTitleLocalizedWarning = `Track ${reconciled.trackNo}: 에이전트가 "titleLocalized"를 쓰지 않아 앱이 임시로 채웠습니다 — 직역이 아닌 재해석인지 확인하세요.`;
  }
  const titleDisplay = buildTitleDisplay(reconciled.title, titleLocalized);

  return {
    song: {
      ...reconciled,
      ...(titleLocalized ? { titleLocalized, titleDisplay } : {}),
      ...(missingTitleLocalizedWarning ? { warnings: [...reconciled.warnings, missingTitleLocalizedWarning] } : {})
    }
  };
}

export interface ImportSongsReport {
  blueprint: PlaylistBlueprint | null;
  importedCount: number;
  skippedCount: number;
  skippedReasons: string[];
  warnings: string[];
  /** TASK v3.60 (TASK F-1) — the pack size actually requested (opts.songCount), so a caller can compare against importedCount without re-deriving it; 0 when the request never got far enough to know (precondition/parse failure). */
  requestedCount: number;
}

/**
 * TASK B1 — reads a coding agent's output file back in. Every song runs
 * through core/quality.ts's scoreSongs (quality score, prompt-length budget,
 * copyright/imitation/famous-artist/cliché checks, hook-quality checks) with
 * no exceptions (TASK B3) — the exact same gate every API-generated song
 * already passes through in providers/index.ts's generateBlueprint, so a
 * song's origin never determines which safety rules apply to it.
 */
export function importSongsJson(
  rawText: string,
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  preassignedSongs: PreassignedSongSlot[] = [],
  /** TASK v3.27 (Part A3) — the channel's cross-pack title history (same avoid.usedTitles the caller already fetched via hookLedger's safeAvoidSet for preallocateSongSlots), so an AI-creative title that happens to match an older pack's title still gets caught and uniquified. */
  avoidTitles: string[] = [],
  /** Channel hook history from hookLedger. Bridge imports warn on collisions but never rewrite hooks, because rewriting only hookPhrase would desync the lyrics. */
  avoidHooks: string[] = []
): ImportSongsReport {
  // TASK v3.27 (Part B1) — reproduced crash: importSongsJson accessed
  // season.label (and iterated genres/moods) unconditionally, so calling it
  // before a channel/season is actually selected threw instead of reporting
  // a clear reason. opts/genres/moods/season are typed as required, but a
  // real call site can still hand this an undefined/partial value at
  // runtime — guard defensively rather than trust the type alone.
  if (!season?.label || !opts?.channel || !Array.isArray(genres) || !Array.isArray(moods)) {
    return { blueprint: null, importedCount: 0, skippedCount: 0, skippedReasons: ['채널·시즌 설정을 먼저 선택한 뒤 가져오기를 실행하세요.'], warnings: [], requestedCount: opts?.songCount ?? 0 };
  }

  let parsed: unknown;
  try {
    parsed = parseLeniently(rawText);
  } catch {
    return { blueprint: null, importedCount: 0, skippedCount: 0, skippedReasons: ['JSON을 해석하지 못했습니다 — 파일 내용이 올바른 JSON인지 확인하세요.'], warnings: [], requestedCount: opts.songCount };
  }

  const rawSongs = extractSongsArray(parsed);
  if (!rawSongs.length) {
    return { blueprint: null, importedCount: 0, skippedCount: 0, skippedReasons: ['"songs" 배열을 찾지 못했습니다.'], warnings: [], requestedCount: opts.songCount };
  }

  const titleMode = opts.titleMode ?? 'ai-creative';
  // TASK (duplicate-trackNo fix) — was `new Map(preassignedSongs.map(slot =>
  // [slot.trackNo, slot]))` handed straight into normalizeImportedSong, which
  // did its own `.get(claimedTrackNo)` per entry — so two raw entries both
  // claiming the same trackNo (this file's own tests/fixtures/providerResponses/
  // duplicateTrackNo.json) both resolved to the SAME slot's plan. Resolved
  // once up front via claimSlotsByTrackNo (core/batchPreallocation.ts): the
  // first raw entry (array order) to claim a trackNo gets that slot; a later
  // entry claiming an already-consumed trackNo gets `undefined` instead (the
  // same no-slot remedy invalidTrackNo.json already exercises), keyed here by
  // array index since normalizeImportedSong still needs one resolved slot per
  // call, not a shared trackNo-keyed map.
  // TASK (structural trackNo rejection) — checked against each entry's own
  // RAW trackNo field, NOT claimedTrackNoFor's index-fallback value used
  // right below: an entry that omits trackNo entirely is normal, expected,
  // positional bridge-JSON input (see claimedTrackNoFor's own doc comment)
  // and must not trip this. A PRESENT-but-untrustworthy trackNo — a
  // duplicate, a decimal, a non-numeric string, or a value outside
  // 1..opts.songCount — means the whole response can't be trusted, so the
  // entire import is refused here, before claimSlotsByTrackNo's own softer
  // per-track no-slot fallback ever runs (see core/importValidation.ts's
  // doc comment for why this doesn't replace that fallback — a fallback
  // trackNo colliding with an explicit one elsewhere in the array is a
  // real, different case still caught by claimSlotsByTrackNo below, not by
  // this raw-value-only check). Matches this function's own existing
  // "can't process this response" failure shape (blueprint: null + Korean
  // skippedReasons), not a new shape.
  const rawTrackNoEntries = rawSongs.map(raw => ({
    trackNo: raw && typeof raw === 'object' ? (raw as Record<string, unknown>).trackNo : undefined
  }));
  const trackSetValidation = validateProviderTrackSet(rawTrackNoEntries, opts.songCount);
  if (!trackSetValidation.valid) {
    return {
      blueprint: null,
      importedCount: 0,
      skippedCount: rawSongs.length,
      skippedReasons: [`가져오기를 중단했습니다 — trackNo 구조 오류로 응답 전체를 사용할 수 없습니다 (${describeTrackSetValidation(trackSetValidation)}).`],
      warnings: [],
      requestedCount: opts.songCount
    };
  }
  const claimTargets = rawSongs.map((raw, index) => ({ index, trackNo: claimedTrackNoFor(raw, index) }));
  const slotClaims = claimSlotsByTrackNo(claimTargets, preassignedSongs);
  const slotByIndex = new Map(Array.from(slotClaims, ([target, slot]) => [target.index, slot]));
  // Still used (unchanged) further below by normalizeSongOutput, which looks
  // up introMode by each song's FINAL renumbered trackNo — an inherently
  // duplicate-free position, unlike the originally-claimed trackNo above.
  const slotByTrackNo = new Map(preassignedSongs.map(slot => [slot.trackNo, slot]));
  const validSongs: SongIdea[] = [];
  const skippedReasons: string[] = [];
  // v4.3 (TASK A) — shared across every song in this import so the
  // fallback-only bank builder doesn't hand out the same phrase twice.
  const usedLocalizedTitles = new Set<string>();

  rawSongs.forEach((raw, index) => {
    const result = normalizeImportedSong(raw, index, slotByIndex.get(index), titleMode, opts, usedLocalizedTitles);
    if ('error' in result) {
      skippedReasons.push(result.error);
      return;
    }
    validSongs.push(result.song);
  });

  if (!validSongs.length) {
    return { blueprint: null, importedCount: 0, skippedCount: rawSongs.length, skippedReasons, warnings: [], requestedCount: opts.songCount };
  }

  // TASK B1 — "trackNo 재정렬(1..N 연속)": sort by each song's claimed
  // trackNo, then renumber sequentially so skipped/out-of-order entries never
  // leave gaps or duplicates in the final pack.
  validSongs.sort((a, b) => a.trackNo - b.trackNo);
  const renumbered = validSongs.map((song, idx) => ({ ...song, trackNo: idx + 1, originalTrackNo: song.trackNo }));

  const hookCollisionResult = flagHookCollisions(renumbered, avoidHooks);
  // TASK v3.60 (TASK B) — the bridge agent's raw stylePrompt/lyrics strings
  // get zero content normalization anywhere else in this function (see this
  // module's own top-of-file note on normalizeImportedSong); a real pack
  // still carried template-header labels ("Money chords:", "Instruments:")
  // and 8/17 songs sang a leaked arrangement-description line under an
  // [intro] tag. normalizeSongOutput (core/songPostProcess.ts) is the same
  // shared, mechanical-only pass core/localGenerator.ts's own
  // generateLocalBlueprint now runs too, so the two paths agree instead of
  // the bridge growing a second copy of local-only logic.
  // TASK v3.64 (TASK B) — introMode comes from this trackNo's own slot
  // (app-planned), not from anything the agent wrote in stylePrompt — see
  // songPostProcess.ts's own note on why the old stylePrompt-declaration
  // signal stopped firing after v3.62 TASK 1.
  const scored = scoreSongs(
    hookCollisionResult.songs.map(song => normalizeSongOutput(song, slotByTrackNo.get(song.trackNo)?.introMode)),
    opts.channel,
    opts.lyricLanguage
  );
  // TASK v3.27 (Part A3) — an AI-creative title wasn't locally pre-decided
  // (unlike hookPhrase), so two songs in this import — or this import
  // against an older pack's title history — can still collide; catch and
  // auto-uniquify it here, the same pass every generation path now runs.
  const { songs: deduped } = dedupeTitlesAcrossPack(scored, avoidTitles);
  // TASK v3.69 (TASK D) — meta.conceptLabel (when present) is the concept the
  // file was actually generated under, a more specific label than the
  // channel+season+genre fallback string below — prefer it the same way
  // opts.customConcept is already preferred, so an SRT zip named from this
  // blueprint's oneLineConcept (see SrtExportPanel.tsx) matches the set it
  // came from.
  const meta = extractBridgeImportMeta(rawText);
  const concept = opts.customConcept || meta?.conceptLabel || `${opts.channel.name} ${season.label} playlist with ${genres.map(g => g.label).join(' + ')}`;
  // meta.generatedAt (when present) is the real time the coding agent wrote
  // this file; falling back to buildSignatureBlueprint's own "now" default
  // (import time) for meta-less files keeps this fully backward compatible.
  const blueprintBase = meta?.generatedAt
    ? buildSignatureBlueprint(opts, genres, moods, season, concept, deduped, meta.generatedAt)
    : buildSignatureBlueprint(opts, genres, moods, season, concept, deduped);
  // 지시문 18 (TASK C-2) — meta.bridgeVersion(에이전트가 요청 payload에서 그대로
  // 복사해 왔을 때)을 우선하고, 없으면 지금 이 앱의 버전으로 채운다 — 절대
  // undefined로 남기지 않는다.
  const blueprint: PlaylistBlueprint = { ...blueprintBase, meta: { ...blueprintBase.meta, bridgeVersion: meta?.bridgeVersion || APP_VERSION } };

  // TASK v3.43 Part A4 — a bridge/coding-agent pack skips every real API
  // call's own per-request variation, so it's exactly the path most exposed
  // to a coding agent falling back to one template stylePrompt reused across
  // every track (see core/diversityLinter.ts's lintInPackStyleSimilarity —
  // the real bug it guards against measured a 90.3% average / 100% max
  // pairwise similarity). Previously this check only ran at display time in
  // Step4Result.tsx, after the import had already succeeded; running it here
  // surfaces the same warning in the import report itself, before the user
  // ever navigates away.
  const similarityReport = lintInPackStyleSimilarity(deduped.map(song => ({ trackNo: song.trackNo, stylePrompt: song.stylePrompt })));
  const lyricDiversityReport = lintInPackLyricDiversity(deduped.map(song => ({ trackNo: song.trackNo, lyrics: song.lyrics, hookPhrase: song.hookPhrase, title: song.title })));
  // TASK v3.43 Step 2 (Part A4) — "무엇이 고정돼 있는지 보이게": whenever the
  // linter actually has something to say, also surface exactly which
  // clauses are common to every song, so the warning isn't just "the pack
  // is too similar" with no lead on what to change.
  const commonClausesNote = (similarityReport.warnings.length || similarityReport.errors.length) && similarityReport.commonClauses.length
    ? [`Clauses common to every song in this pack: ${similarityReport.commonClauses.join(', ')}`]
    : [];

  // TASK v3.60 (TASK F-1) — a real bridge run delivered 17 songs when 18
  // were requested, and importSongsJson reported it as a plain, unremarkable
  // "17/17 imported successfully" (skippedCount only counts songs that
  // failed validation, not songs the agent simply never wrote) — the
  // shortfall itself was invisible anywhere in the report. Explicit and
  // unambiguous rather than folded into skippedReasons, since no single
  // song actually failed here.
  const countMismatchWarning = deduped.length !== opts.songCount
    ? [`요청한 곡 수(${opts.songCount})와 실제로 가져온 곡 수(${deduped.length})가 다릅니다 — 에이전트가 ${opts.songCount}곡을 모두 생성하지 않았을 수 있습니다. songs-output.json을 확인하거나 다시 생성하십시오.`]
    : [];

  return {
    blueprint,
    importedCount: deduped.length,
    skippedCount: rawSongs.length - deduped.length,
    skippedReasons,
    warnings: [
      ...countMismatchWarning,
      ...hookCollisionResult.warnings,
      ...similarityReport.warnings,
      ...similarityReport.errors,
      ...commonClausesNote,
      ...lyricDiversityReport.warnings,
      ...lyricDiversityReport.errors
    ],
    requestedCount: opts.songCount
  };
}

export interface ImportSongsForSrtOnlyResult {
  songs: SongIdea[];
  warnings: string[];
}

/**
 * TASK (SRT-only read path) — App.tsx's "lyrics file -> SRT" entry point
 * (onImportSongsJsonForSrt) used to delegate straight into importSongsJson,
 * which — via App.tsx's own onImportSongsJson wrapper — permanently
 * registers the pack's hooks (handleGenerationSuccess -> recordPackHooks)
 * and autosaves it to the library (library.saveImportedPack), even though
 * this entry point's own stated purpose (see this file's v3.69 TASK D
 * comment on extractBridgeImportMeta/importSongsJson above) is display-only:
 * "이 import 가 이미 the whole pack — nothing to regenerate." A picked
 * lyrics/*.json file already has every song's finished lyrics; the SRT tab
 * only ever needs those lyrics plus whatever per-song duration the user
 * types into SrtExportPanel afterward — never a slot plan, hook-collision
 * defense, quality scoring, title dedup, or a permanent write.
 *
 * Reuses this module's own real parsing/normalization primitives
 * (parseLeniently, extractSongsArray, normalizeImportedSong) so a file
 * parses identically to importSongsJson regardless of which entry point
 * reads it — this is NOT a second JSON parser. Deliberately skips
 * everything importSongsJson does beyond that:
 *   - claimSlotsByTrackNo/preallocateSongSlots: no slot plan is built here
 *     at all; every song resolves through normalizeImportedSong's existing
 *     `slot: undefined` branch (reconcileWithPreassignedSlot's own
 *     `noSlotEffectiveFields` fallback — the same branch an agent-invented
 *     extra track already exercises today), so effectiveArchetype/
 *     workspaceId/etc. still come out populated without a plan to draw from.
 *   - scoreSongs (the quality/safety gate), flagHookCollisions,
 *     dedupeTitlesAcrossPack, normalizeSongOutput's mechanical cleanup, and
 *     buildSignatureBlueprint itself: none of those exist to make a song
 *     readable — only to make it safe/deduped/plan-conformant for a NEW
 *     generation, which a read-only display path is not. The caller
 *     (App.tsx's onImportSongsJsonForSrt) wraps the returned songs in its
 *     own display-only blueprint via localGenerator.ts's
 *     buildSignatureBlueprint (already pure/side-effect-free) and never
 *     calls handleGenerationSuccess or library.saveImportedPack.
 */
export function importSongsForSrtOnly(
  rawText: string,
  opts: GenerationOptions
): ImportSongsForSrtOnlyResult {
  if (!opts?.channel) {
    return { songs: [], warnings: ['채널 설정을 먼저 선택한 뒤 가져오기를 실행하세요.'] };
  }

  let parsed: unknown;
  try {
    parsed = parseLeniently(rawText);
  } catch {
    return { songs: [], warnings: ['JSON을 해석하지 못했습니다 — 파일 내용이 올바른 JSON인지 확인하세요.'] };
  }

  const rawSongs = extractSongsArray(parsed);
  if (!rawSongs.length) {
    return { songs: [], warnings: ['"songs" 배열을 찾지 못했습니다.'] };
  }

  const titleMode = opts.titleMode ?? 'ai-creative';
  const usedLocalizedTitles = new Set<string>();
  const songs: SongIdea[] = [];
  const warnings: string[] = [];

  rawSongs.forEach((raw, index) => {
    // No slot plan exists for a read-only import (see this function's own
    // doc comment) — every song resolves through normalizeImportedSong's
    // existing `slot: undefined` handling.
    const result = normalizeImportedSong(raw, index, undefined, titleMode, opts, usedLocalizedTitles);
    if ('error' in result) {
      warnings.push(result.error);
      return;
    }
    songs.push(result.song);
  });

  // Same trackNo-gap/duplicate defense as importSongsJson's own renumbering
  // pass (TASK B1), so the SRT panel's per-song duration list still lines up
  // 1..N regardless of what trackNo values the raw file actually claimed.
  songs.sort((a, b) => a.trackNo - b.trackNo);
  const renumbered = songs.map((song, idx) => ({ ...song, trackNo: idx + 1, originalTrackNo: song.trackNo }));

  return { songs: renumbered, warnings };
}

/** 지시문 13 (TASK A) — song fields the read-only viewer refuses to open a whole file over if even one track is missing them. Deliberately narrower than REQUIRED_SONG_FIELDS (which also requires hookPhrase): a missing hookPhrase only loses the in-lyrics hook highlight, never lets blank/broken text reach Suno's paste fields the way a missing title/stylePrompt/lyrics would — see this function's own doc comment for the full "blocked vs allowed-with-warning" split. */
const VIEWER_REQUIRED_FIELDS = ['title', 'stylePrompt', 'lyrics'] as const;

/** Recognized top-of-lyrics vocal meta-tags, mirrors core/vocalPlan.ts's own (private) VOCAL_META_TAG_WORDS list — duplicated rather than exported from there since this is a display-only cosmetic normalization, not a real vocal-plan decision (no slot/channel context available in a read-only viewer open). */
const VIEWER_VOCAL_TAG_PATTERN = /^(\s*)\[\s*(male vocal|female vocal|duet vocal|group vocal|mixed vocal|children'?s choir)\s*\]/i;

/** 지시문 13 (TASK A-1) — normalizes ONLY the casing/spacing of an already-present, already-recognizable top-of-lyrics vocal tag (e.g. "[Female Vocal]" -> "[female vocal]") so the viewer's display is consistent with every other real generation path's canonical form. Never invents a tag that wasn't there, never re-derives one from archetype/slot context (this function has neither) — that's the "정규화, 원본 JSON 은 변경하지 않음" scope A-1 asks for: a display tidy-up, not a vocal-plan decision. */
export function normalizeVocalTagForDisplay(lyrics: string): string {
  const match = lyrics.match(VIEWER_VOCAL_TAG_PATTERN);
  if (!match) return lyrics;
  const canonical = `[${match[2].toLowerCase().replace(/\s+/g, ' ').trim()}]`;
  if (match[0].trim() === canonical) return lyrics;
  return match[1] + canonical + lyrics.slice(match[0].length);
}

export interface ReadOnlyViewerContext {
  /** For the language-ratio/archetype-sensitive advisory checks only (lyricLanguageMismatchWarning's own context) — never used to gate/block, and the viewer never switches the app's own selected channel to match this. */
  archetype?: ChannelArchetype;
  lyricLanguage: LyricLanguage;
  bilingualPair?: BilingualPair;
  /**
   * Optional pre-fetched cross-set history — same shape (and same "this
   * module never touches IndexedDB itself" convention) as
   * core/importInspection.ts's inspectImportReport duplicationHistory
   * param. Omitting it simply skips the 3 duplication-history advisory
   * checks below; it can never make this function block, unlike
   * inspectImportReport's own lyricLineOverlap.blocking rule — see this
   * function's own header comment for why that's the deliberate difference
   * here.
   */
  duplicationHistory?: { recentSituations: string[]; recentLyricLines: string[]; historicalTitles: Set<string> };
}

export interface ViewerCheckLine {
  id: string;
  labelKo: string;
  /** Always 'info' or 'warn' here — never 'blocked'. A read-only viewer result's `status` is decided entirely by the structural checks inside parseSongsJsonForViewer itself, before any of these advisory lines are even computed; see that function's own header comment. */
  status: 'info' | 'warn';
  detail?: string;
}

export interface ViewerParseResult {
  status: 'blocked' | 'ok';
  /** Non-empty only when status === 'blocked'. */
  blockedReasons: string[];
  songs: SongIdea[];
  meta: BridgeImportMeta | null;
  /** Informational only — duplication/quality/language/distinctChoice findings the UI shows in a collapsed panel. Never affects `status`. */
  checks: ViewerCheckLine[];
}

/**
 * 지시문 13 (TASK A-1) — the read-only counterpart to importSongsJson/
 * importSongsForSrtOnly: parses a bridge songs-output.json file for the
 * standalone "수노모드로 열기 (읽기 전용)" entry point, WITHOUT going through
 * importSongsJson's real generation pipeline (reconcileWithPreassignedSlot,
 * hook-collision flagging, title dedup across the pack, buildSignatureBlueprint)
 * — none of those exist to make a song safe to READ, only to make it safe to
 * treat as a NEW generation result (see importSongsForSrtOnly's own doc
 * comment for the identical reasoning on the SRT-only path this mirrors).
 * Deliberately does not accept a GenerationOptions/ChannelProfile — this
 * entry point must work without switching (or even requiring) the app's
 * currently selected channel/season, per this task's own §A-1 "채널 선택
 * 변경 금지".
 *
 * Two independent decisions this function makes, on purpose:
 *
 * 1. STRUCTURAL — decides `status`. Blocks the WHOLE file (no songs
 *    returned at all) only for: JSON parse failure, no "songs" array (or
 *    empty), a trackNo set validateProviderTrackSet itself rejects
 *    (duplicate/non-integer/out-of-range), or any single track missing
 *    title/stylePrompt/lyrics (VIEWER_REQUIRED_FIELDS — see that constant's
 *    own doc comment for why this is narrower than REQUIRED_SONG_FIELDS).
 *    A song missing only hookPhrase is still accepted (empty string) — the
 *    viewer's own copy/highlight logic already degrades gracefully for that
 *    (mirrors sunoViewerExport.ts's REVIEW_ENGINE_JS, which never assumes
 *    hookPhrase is non-empty either).
 *
 * 2. ADVISORY — everything else this task's own §A-3 names (scene/title/
 *    lyric-line duplication against cross-set history, era-tag inconsistency,
 *    qualityScore, missing distinctChoice, missing excludePrompt, a vocal-tag
 *    mismatch) is real information worth showing, but NEVER blocks — this is
 *    the one deliberate policy difference from core/importInspection.ts's
 *    inspectImportReport, which DOES hard-block on lyricLineOverlap.blocking
 *    (3+ exact-line matches). That rule protects the SAVE/ledger-registration
 *    path from silently laundering copied content into "already used"
 *    history; it has nothing to say about whether a human is allowed to READ
 *    text that's already sitting in a file on their own disk. Blocking read
 *    access here would only re-create the exact bug this whole task exists
 *    to fix (지시문 13 §1-3: "저장을 막는 관문이 복사까지 막고 있다").
 */
export function parseSongsJsonForViewer(
  rawText: string,
  context: ReadOnlyViewerContext
): ViewerParseResult {
  let parsed: unknown;
  try {
    parsed = parseLeniently(rawText);
  } catch {
    return { status: 'blocked', blockedReasons: ['JSON을 해석하지 못했습니다 — 파일 내용이 올바른 JSON인지 확인하세요.'], songs: [], meta: null, checks: [] };
  }

  const rawSongs = extractSongsArray(parsed);
  if (!rawSongs.length) {
    return { status: 'blocked', blockedReasons: ['"songs" 배열을 찾지 못했거나 비어 있습니다.'], songs: [], meta: null, checks: [] };
  }

  // trackNo range/duplicate validation — there is no live opts.songCount for
  // a standalone viewer open, so the file's own song count is what "in
  // range" means here (same reasoning importSongsForSrtOnly's own trackNo
  // renumbering pass already relies on: this file IS the whole pack).
  const rawTrackNoEntries = rawSongs.map(raw => ({
    trackNo: raw && typeof raw === 'object' ? (raw as Record<string, unknown>).trackNo : undefined
  }));
  const trackSetValidation = validateProviderTrackSet(rawTrackNoEntries, rawSongs.length);
  if (!trackSetValidation.valid) {
    return {
      status: 'blocked',
      blockedReasons: [`trackNo 구조 오류로 열 수 없습니다 (${describeTrackSetValidation(trackSetValidation)}).`],
      songs: [],
      meta: null,
      checks: []
    };
  }

  const fieldFailures: string[] = [];
  rawSongs.forEach((raw, index) => {
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const missing = VIEWER_REQUIRED_FIELDS.filter(field => !isNonEmptyString(obj[field]));
    if (missing.length) {
      const label = isNonEmptyString(obj.title) ? obj.title : `#${index + 1}`;
      fieldFailures.push(`"${label}": ${missing.join(', ')} 없음`);
    }
  });
  if (fieldFailures.length) {
    return {
      status: 'blocked',
      blockedReasons: [`필수 필드가 없는 곡이 있어 열 수 없습니다 — ${fieldFailures.join(' / ')}`],
      songs: [],
      meta: null,
      checks: []
    };
  }

  // Sort by each entry's own CLAIMED trackNo before assigning the final
  // display 1..N sequence — same "trust the claimed number, not physical
  // array position" convention importSongsJson/importSongsForSrtOnly both
  // already follow (their own renumbering pass), so a file whose songs
  // array happens to be physically out of order still displays track 1
  // before track 2. Safe to rely on claimedTrackNoFor-equivalent field
  // access here only because validateProviderTrackSet above already proved
  // the raw trackNo values form a clean 1..rawSongs.length permutation with
  // no duplicates/gaps — a plain numeric sort is enough, no claim-resolution
  // needed the way claimSlotsByTrackNo provides for a real (possibly
  // malformed) generation response.
  const orderedRawSongs = rawSongs
    .map((raw, index) => ({ raw, originalTrackNo: typeof (raw as Record<string, unknown>).trackNo === 'number' ? (raw as Record<string, unknown>).trackNo as number : index + 1 }))
    .sort((a, b) => a.originalTrackNo - b.originalTrackNo);

  // Lightweight, channel-independent normalization — deliberately NOT
  // normalizeImportedSong (that function needs a real GenerationOptions/
  // slot for reconcileWithPreassignedSlot's archetype-derived defaults,
  // which this read-only entry point has no business requiring). Every
  // field this viewer actually displays/copies is taken as-is from the raw
  // JSON, type-guarded the same defensive way sunoViewerExport.ts's own
  // in-browser normalizeSong already does for the standalone HTML twin of
  // this same screen.
  const songs: SongIdea[] = orderedRawSongs.map(({ raw, originalTrackNo }, index) => {
    const obj = raw as Record<string, unknown>;
    const trackNo = index + 1;
    const youtubeRaw = obj.youtube && typeof obj.youtube === 'object' ? (obj.youtube as Record<string, unknown>) : {};
    const lyrics = normalizeVocalTagForDisplay(String(obj.lyrics));
    return {
      trackNo,
      originalTrackNo,
      title: String(obj.title),
      seasonMoment: isNonEmptyString(obj.seasonMoment) ? obj.seasonMoment : '',
      listenerSituation: isNonEmptyString(obj.listenerSituation) ? obj.listenerSituation : '',
      emotionArc: isNonEmptyString(obj.emotionArc) ? obj.emotionArc : '',
      // 지시문 15 (TASK A-2) — obj.distinctChoice가 신형 구조체({ruleId,
      // descriptionKo, params})든 구형 자유 문자열이든 coerceDistinctChoice가
      // 받아들인다. distinctChoice(표시용 문자열)는 이전과 동일하게 항상
      // descriptionKo — SongCard.tsx 등 기존 표시 소비처는 무변경.
      ...(() => {
        const parsed = coerceDistinctChoice(obj.distinctChoice);
        return parsed
          ? { distinctChoice: parsed.descriptionKo, distinctChoiceRuleId: parsed.ruleId, ...(parsed.params ? { distinctChoiceParams: parsed.params } : {}) }
          : { distinctChoice: undefined };
      })(),
      hookPhrase: isNonEmptyString(obj.hookPhrase) ? obj.hookPhrase : '',
      stylePrompt: String(obj.stylePrompt),
      ...(isNonEmptyString(obj.excludePrompt) ? { excludePrompt: obj.excludePrompt } : {}),
      lyrics,
      ...(isNonEmptyString(obj.titleLocalized) ? { titleLocalized: obj.titleLocalized, titleDisplay: buildTitleDisplay(String(obj.title), obj.titleLocalized) } : {}),
      youtube: {
        title: isNonEmptyString(youtubeRaw.title) ? youtubeRaw.title : String(obj.title),
        description: isNonEmptyString(youtubeRaw.description) ? youtubeRaw.description : '',
        tags: sanitizePublicYoutubeTags(Array.isArray(youtubeRaw.tags) ? youtubeRaw.tags.filter((tag): tag is string => typeof tag === 'string') : [])
      },
      ...(isNonEmptyString(obj.genreId) ? { genreId: obj.genreId } : {}),
      ...(isNonEmptyString(obj.genreText) ? { genreText: obj.genreText } : {}),
      ...(isNonEmptyString(obj.eraTag) ? { eraTag: obj.eraTag } : {}),
      qualityScore: 0,
      warnings: [],
      effectiveMoneyChordId: '',
      effectiveGenreIds: [],
      effectiveArchetype: context.archetype || 'senior-morning',
      workspaceId: 'senior-oldpop'
    } as SongIdea;
  });

  // Advisory-only checks from here on — none of these can flip `status`.
  const checks: ViewerCheckLine[] = [];
  const scored = scoreSongs(songs, undefined, context.lyricLanguage);
  const belowThreshold = scored.filter(song => song.qualityScore < 70);
  checks.push(
    belowThreshold.length
      ? { id: 'quality', labelKo: 'qualityScore 미달', status: 'warn', detail: belowThreshold.map(s => `T${s.trackNo} (${s.qualityScore}점)`).join(', ') }
      : { id: 'quality', labelKo: 'qualityScore 정상', status: 'info' }
  );

  const missingExclude = songs.filter(song => !song.excludePrompt).map(song => song.trackNo);
  checks.push(
    missingExclude.length
      ? { id: 'excludePrompt', labelKo: 'excludePrompt 없음', status: 'warn', detail: `T${missingExclude.join(', T')}` }
      : { id: 'excludePrompt', labelKo: 'excludePrompt 전체 보유', status: 'info' }
  );

  const distinctChoiceReport = checkDistinctChoices(songs);
  checks.push(
    distinctChoiceReport.missingTrackNos.length
      ? { id: 'distinctChoice', labelKo: 'distinctChoice 누락', status: 'warn', detail: `T${distinctChoiceReport.missingTrackNos.join(', T')}` }
      : { id: 'distinctChoice', labelKo: 'distinctChoice 전체 보유', status: 'info' }
  );

  const languageWarnings = songs
    .map(song => lyricLanguageMismatchWarning(song.lyrics, context.lyricLanguage, song.trackNo, { archetype: context.archetype, bilingualPair: context.bilingualPair }))
    .filter((w): w is string => Boolean(w));
  checks.push(
    languageWarnings.length
      ? { id: 'language', labelKo: '언어 비율 불일치', status: 'warn', detail: languageWarnings.join(' / ') }
      : { id: 'language', labelKo: '언어 비율 정상', status: 'info' }
  );

  if (context.duplicationHistory) {
    const sceneOverlap = checkSceneOverlap(songs, context.duplicationHistory.recentSituations);
    const titleCollision = checkTitleHistoryCollision(songs, context.duplicationHistory.historicalTitles);
    const lyricLineOverlap = checkLyricLineOverlap(songs, context.duplicationHistory.recentLyricLines);
    const duplicationReasons = [
      ...sceneOverlap.collisions.map(c => `Track ${c.trackNo}: 장면 중복 ("${c.situation}")`),
      ...titleCollision.collisions.map(c => `Track ${c.trackNo}: 제목 중복 ("${c.title}")`)
    ];
    checks.push(
      duplicationReasons.length
        ? { id: 'duplication', labelKo: '중복 방지 검사 (장면·제목) — 읽기 전용이므로 차단하지 않음', status: 'warn', detail: duplicationReasons.join(' / ') }
        : { id: 'duplication', labelKo: '중복 방지 검사 통과 (장면·제목)', status: 'info' }
    );
    checks.push(
      lyricLineOverlap.matches.length
        ? {
            id: 'lyricLineOverlap',
            labelKo: '가사 문장 중복 검사 — 읽기 전용이므로 차단하지 않음',
            status: 'warn',
            detail: `가사 문장 ${lyricLineOverlap.matches.length}개가 최근 세트와 완전일치: ${lyricLineOverlap.matches.slice(0, 3).map(m => `T${m.trackNo} "${m.line}"`).join(' / ')}`
          }
        : { id: 'lyricLineOverlap', labelKo: '가사 문장 중복 검사 통과', status: 'info' }
    );
  }

  return {
    status: 'ok',
    blockedReasons: [],
    songs,
    meta: extractBridgeImportMeta(rawText),
    checks
  };
}
