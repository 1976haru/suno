import type {
  BatchContext,
  GenerationOptions,
  GenrePack,
  MoodPack,
  PlaylistBlueprint,
  PreassignedSongSlot,
  SeasonPack,
  SongIdea,
  YoutubeMetadata
} from '../types';
import { buildSystemInstruction, buildUserInstruction, songOutputShape } from './promptComposer';
import { buildSignatureBlueprint } from './localGenerator';
import { scoreSongs } from './quality';
import { reconcileWithPreassignedSlot } from './batchPreallocation';
import { dedupeTitlesAcrossPack } from './lyricEngine';

/**
 * TASK v3.24 — a flat-rate coding agent (Claude Code, Codex, ...) can
 * generate the exact same song content this app would otherwise pay
 * per-token for through api/generate.js/api/batch.js. This module is the
 * bridge: buildClaudeCodeInstruction() produces a single self-contained
 * prompt (copy/paste or download as .txt) that such an agent can execute
 * directly and write its result to a file; importSongsJson() reads that
 * file back in and pushes it through the exact same quality/safety
 * pipeline (core/quality.ts's scoreSongs) every API-generated song already
 * goes through, so it doesn't matter which path a song came from — the same
 * gates apply either way.
 */

export const CLAUDE_CODE_BRIDGE_OUTPUT_FILENAME = 'songs-output.json';

const REQUIRED_SONG_FIELDS = ['title', 'hookPhrase', 'stylePrompt', 'lyrics'] as const;

/**
 * Builds one self-contained instruction a coding agent can run without any
 * further back-and-forth: the same content rules generateBlueprint's remote
 * providers already send (buildSystemInstruction), the same per-run payload
 * (buildUserInstruction) with alreadyUsedTitles/alreadyUsedHooks and the
 * locally pre-decided preassignedSongs made explicit (TASK A2 — the agent
 * must use these verbatim, the same rule buildBatchSystemNote already
 * enforces for parallel Batch API sub-requests), and an explicit file-output
 * contract instead of an HTTP response. outputShape is narrowed to just
 * "songs" — unlike a real API call, this agent never needs to invent
 * projectTitle/sonicSignature/etc.; those come from buildSignatureBlueprint
 * once the file is imported back in.
 */
export function buildClaudeCodeInstruction(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  avoid: { usedTitles?: string[]; usedHooks?: string[] } | undefined,
  preassignedSongs: PreassignedSongSlot[],
  generateThumbnailText = false
): string {
  const batch: BatchContext = {
    trackNoOffset: 0,
    totalSongCount: opts.songCount,
    usedTitles: avoid?.usedTitles ?? [],
    usedHooks: avoid?.usedHooks ?? [],
    lockedIdentity: null,
    preassignedSongs
  };
  const bridgeRulesBatch: BatchContext = { ...batch, preassignedSongs: [] };
  const rules = buildSystemInstruction(opts, bridgeRulesBatch, undefined, generateThumbnailText);
  const basePayload = buildUserInstruction(opts, genres, moods, season, batch, generateThumbnailText);
  const payload = {
    ...basePayload,
    preassignedSongs,
    outputShape: { songs: [songOutputShape(generateThumbnailText)] }
  };

  // TASK v3.27/v3.28 (Part A2/B2) — same titleMode branch as
  // promptComposer.ts's buildBatchSystemNote, kept in sync here rather than
  // left to drift: an agent run through this bridge should get identical
  // title guidance to a real Batch API sub-request, not a weaker or
  // stronger version of it. v3.28 dropped the "title must equal/contain the
  // hook" constraint for ai-creative entirely — real measurement showed
  // titles still came back 100% identical to their hooks with that
  // constraint in place, even with v3.27's shape-rotation guidance.
  const titleMode = opts.titleMode ?? 'ai-creative';
  const titleInstructionLine = titleMode === 'local'
    ? '- "preassignedSongs" gives local planning slots. Copy the preassigned title in local title mode, but the final "hookPhrase" you write must exactly match the hook line repeated in that song\'s lyrics; never let the JSON hook and chorus hook diverge.'
    : '- "preassignedSongs" gives local planning slots and fallback placeholders. Write your OWN original title for each song, independent of the hookPhrase. You may use the slot hook or write a new original hook, but the final "hookPhrase" must exactly match the hook line that opens and closes every chorus in that song\'s lyrics. Write real Billboard Hot 100-style titles: single striking words, unexpected concrete nouns, short metaphors, or evocative images, never a restatement of the hook and never the same shape for every song. Keep the channel tone while varying the structure freely.';

  return [
    'You are generating song content for a Suno playlist pack as a one-shot task in this session — no Anthropic/OpenAI API call, write your result straight to a file.',
    '',
    rules,
    '',
    'Request payload for this pack (channel/genre/mood/season context, already-used titles/hooks to avoid, and this pack\'s preassigned title/hook per track):',
    '```json',
    JSON.stringify(payload, null, 2),
    '```',
    '',
    'Output requirement:',
    `- Write a new file named "${CLAUDE_CODE_BRIDGE_OUTPUT_FILENAME}" in the current directory.`,
    `- Its content must be exactly { "songs": [ ... ] } — ${opts.songCount} objects total, one per song, matching "outputShape.songs[0]" above (title, hookPhrase, stylePrompt, lyrics, seasonMoment, listenerSituation, emotionArc, youtube{title,description,tags}, etc.).`,
    titleInstructionLine,
    // TASK v3.30 — real Codex-bridge output showed 20/20 titles and 19/20
    // hookPhrases copied verbatim from "alreadyUsedTitles"/"alreadyUsedHooks"
    // (just reshuffled to different track numbers) — the agent apparently
    // read those arrays as source material rather than a blocklist. The old
    // one-line "Never reuse..." bullet, buried 5th of 7 with no self-check
    // step, wasn't forceful enough. This is now a CRITICAL bullet stating
    // the exact forbidden count and an explicit before-writing verification
    // step. The app's import-time safety net (title dedup + hook-collision
    // warnings) still catches this if it happens again — see
    // dedupeTitlesAcrossPack/flagHookCollisions — but this is the first line
    // of defense.
    `- CRITICAL: Every one of the ${avoid?.usedTitles?.length ?? 0} titles in "alreadyUsedTitles" and every one of the ${avoid?.usedHooks?.length ?? 0} hooks in "alreadyUsedHooks" above is FORBIDDEN for this pack — they were already used by a previous pack, not source material to draw from. Before writing the file, check every song's "title" and "hookPhrase" against both lists; if any match (even reordered onto a different track), rewrite that title/hook to something new.`,
    '- CRITICAL: For every imported song, "hookPhrase" and "lyrics" are treated as a matched pair. The hookPhrase string must appear verbatim in the lyrics as the chorus bookend hook; the import step preserves that pair and will not rewrite hooks to match preassignedSongs.',
    '- Do NOT include projectTitle, channelName, oneLineConcept, sonicSignature, vocalSignature, lyricRules, harmonyRules, or visualRules in the file — the app supplies those separately from local context.',
    '- The file itself must be raw JSON — no markdown fences, no surrounding prose, inside the file.',
    '- When done, tell me the file\'s path so I can import it back into Suno Weaver Studio.'
  ].join('\n');
}

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
 * Builds the song from the bridge agent's raw JSON, then reconciles only the
 * slot-owned planning fields. Bridge import preserves the agent's hookPhrase
 * and emotionArc so the stored hook stays aligned with the generated lyrics;
 * songRole remains slot-owned because it controls playlist/opening structure.
 * Title behavior still follows titleMode: local mode forces the slot title,
 * while ai-creative mode trusts the imported title unless it is blank.
 */
function normalizeImportedSong(
  raw: unknown,
  index: number,
  slotByTrackNo: Map<number, PreassignedSongSlot>,
  titleMode: 'local' | 'ai-creative'
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

  const claimedTrackNo = Number.isFinite(Number(obj.trackNo)) && Number(obj.trackNo) > 0 ? Number(obj.trackNo) : index + 1;
  const slot = slotByTrackNo.get(claimedTrackNo);

  const youtubeRaw = obj.youtube && typeof obj.youtube === 'object' ? (obj.youtube as Record<string, unknown>) : {};
  const youtube: YoutubeMetadata = {
    title: isNonEmptyString(youtubeRaw.title) ? youtubeRaw.title : String(obj.title),
    description: isNonEmptyString(youtubeRaw.description) ? youtubeRaw.description : '',
    tags: Array.isArray(youtubeRaw.tags) ? youtubeRaw.tags.filter((tag): tag is string => typeof tag === 'string') : [],
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
    lyrics: String(obj.lyrics),
    ...(isNonEmptyString(obj.thumbnailText) ? { thumbnailText: obj.thumbnailText } : {}),
    youtube,
    ...(isNonEmptyString(obj.youtubeTitleKo) ? { youtubeTitleKo: obj.youtubeTitleKo } : {}),
    ...(isNonEmptyString(obj.youtubeTitleJa) ? { youtubeTitleJa: obj.youtubeTitleJa } : {}),
    qualityScore: 0,
    warnings: []
  };
  return { song: reconcileWithPreassignedSlot(rawSong, slot, titleMode, { keepHook: true, keepEmotionArc: true }) };
}

export interface ImportSongsReport {
  blueprint: PlaylistBlueprint | null;
  importedCount: number;
  skippedCount: number;
  skippedReasons: string[];
  warnings: string[];
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
    return { blueprint: null, importedCount: 0, skippedCount: 0, skippedReasons: ['채널·시즌 설정을 먼저 선택한 뒤 가져오기를 실행하세요.'], warnings: [] };
  }

  let parsed: unknown;
  try {
    parsed = parseLeniently(rawText);
  } catch {
    return { blueprint: null, importedCount: 0, skippedCount: 0, skippedReasons: ['JSON을 해석하지 못했습니다 — 파일 내용이 올바른 JSON인지 확인하세요.'], warnings: [] };
  }

  const rawSongs = extractSongsArray(parsed);
  if (!rawSongs.length) {
    return { blueprint: null, importedCount: 0, skippedCount: 0, skippedReasons: ['"songs" 배열을 찾지 못했습니다.'], warnings: [] };
  }

  const titleMode = opts.titleMode ?? 'ai-creative';
  const slotByTrackNo = new Map(preassignedSongs.map(slot => [slot.trackNo, slot]));
  const validSongs: SongIdea[] = [];
  const skippedReasons: string[] = [];

  rawSongs.forEach((raw, index) => {
    const result = normalizeImportedSong(raw, index, slotByTrackNo, titleMode);
    if ('error' in result) {
      skippedReasons.push(result.error);
      return;
    }
    validSongs.push(result.song);
  });

  if (!validSongs.length) {
    return { blueprint: null, importedCount: 0, skippedCount: rawSongs.length, skippedReasons, warnings: [] };
  }

  // TASK B1 — "trackNo 재정렬(1..N 연속)": sort by each song's claimed
  // trackNo, then renumber sequentially so skipped/out-of-order entries never
  // leave gaps or duplicates in the final pack.
  validSongs.sort((a, b) => a.trackNo - b.trackNo);
  const renumbered = validSongs.map((song, idx) => ({ ...song, trackNo: idx + 1 }));

  const hookCollisionResult = flagHookCollisions(renumbered, avoidHooks);
  const scored = scoreSongs(hookCollisionResult.songs, opts.channel, opts.lyricLanguage);
  // TASK v3.27 (Part A3) — an AI-creative title wasn't locally pre-decided
  // (unlike hookPhrase), so two songs in this import — or this import
  // against an older pack's title history — can still collide; catch and
  // auto-uniquify it here, the same pass every generation path now runs.
  const { songs: deduped } = dedupeTitlesAcrossPack(scored, avoidTitles);
  const concept = opts.customConcept || `${opts.channel.name} ${season.label} playlist with ${genres.map(g => g.label).join(' + ')}`;
  const blueprint = buildSignatureBlueprint(opts, genres, moods, season, concept, deduped);

  return {
    blueprint,
    importedCount: deduped.length,
    skippedCount: rawSongs.length - deduped.length,
    skippedReasons,
    warnings: hookCollisionResult.warnings
  };
}
