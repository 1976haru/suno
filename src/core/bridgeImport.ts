import type {
  GenerationOptions,
  GenrePack,
  MoodPack,
  PlaylistBlueprint,
  PreassignedSongSlot,
  SeasonPack,
  SongIdea,
  YoutubeMetadata
} from '../types';
import { buildSignatureBlueprint } from './localGenerator';
import { scoreSongs } from './quality';
import { claimSlotsByTrackNo, reconcileWithPreassignedSlot } from './batchPreallocation';
import { describeTrackSetValidation, validateProviderTrackSet } from './importValidation';
import { dedupeTitlesAcrossPack } from './lyricEngine';
import { lintInPackLyricDiversity, lintInPackStyleSimilarity } from './diversityLinter';
import { sanitizePublicYoutubeTags } from './exportCompliance';
import { normalizeSongOutput } from './songPostProcess';
import { resolvePackagingLanguage } from './packagingLanguage';
import { buildLocalizedTitle, buildTitleDisplay, localizedTitleSeed } from './titleLocalization';

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
    ...(isNonEmptyString(obj.lyricLanguage) ? { lyricLanguage: obj.lyricLanguage } : {})
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
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
 */
function claimedTrackNoFor(raw: unknown, index: number): number {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return Number.isFinite(Number(obj.trackNo)) && Number(obj.trackNo) > 0 ? Number(obj.trackNo) : index + 1;
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
  const reconciled = reconcileWithPreassignedSlot(rawSong, slot, titleMode, { keepHook: true, keepEmotionArc: true, archetype: opts.channel.archetype, lyricLanguage: opts.lyricLanguage });

  // v4.3 (TASK A) — trust the agent's own "titleLocalized" (the real
  // creative reinterpretation instructed by titleLocalizedInstructionLineFor
  // in bridgeInstruction.ts) when present; fall back to the local
  // bank-based builder only if packaging is non-English and the agent
  // omitted it, so the pack is never silently missing a display title —
  // and warn, since an omission means the agent didn't follow the
  // instruction.
  const packagingLanguage = resolvePackagingLanguage(opts);
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
  const renumbered = validSongs.map((song, idx) => ({ ...song, trackNo: idx + 1 }));

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
  const blueprint = meta?.generatedAt
    ? buildSignatureBlueprint(opts, genres, moods, season, concept, deduped, meta.generatedAt)
    : buildSignatureBlueprint(opts, genres, moods, season, concept, deduped);

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
  const renumbered = songs.map((song, idx) => ({ ...song, trackNo: idx + 1 }));

  return { songs: renumbered, warnings };
}
