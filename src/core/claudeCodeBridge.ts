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
  const rules = buildSystemInstruction(opts, batch, undefined, generateThumbnailText);
  const basePayload = buildUserInstruction(opts, genres, moods, season, batch, generateThumbnailText);
  const payload = {
    ...basePayload,
    preassignedSongs,
    outputShape: { songs: [songOutputShape(generateThumbnailText)] }
  };

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
    '- Every entry in "preassignedSongs" above MUST be copied verbatim for that trackNo\'s title and hookPhrase — never invent a different title or hook for those track numbers.',
    '- Do NOT include projectTitle, channelName, oneLineConcept, sonicSignature, vocalSignature, lyricRules, harmonyRules, or visualRules in the file — the app supplies those separately from local context.',
    '- Never reuse a title or hook already listed in "alreadyUsedTitles" / "alreadyUsedHooks" above.',
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

/**
 * TASK A2/B1 — reconciles against the same preassigned title/hook/emotionArc/
 * songRole the instruction told the agent to copy verbatim, the same
 * defense-in-depth core/batchStitcher.ts's stitchBatchResults already applies
 * to Batch API sub-results: trust the locally-decided assignment over
 * whatever the model actually wrote, so hookLedger dedup never depends on
 * the agent having followed instructions perfectly.
 */
function normalizeImportedSong(raw: unknown, index: number, slotByTrackNo: Map<number, PreassignedSongSlot>): NormalizeSuccess | NormalizeFailure {
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

  const song: SongIdea = {
    trackNo: claimedTrackNo,
    title: slot?.title || String(obj.title),
    seasonMoment: isNonEmptyString(obj.seasonMoment) ? obj.seasonMoment : '',
    listenerSituation: isNonEmptyString(obj.listenerSituation) ? obj.listenerSituation : '',
    emotionArc: slot?.emotionArc || (isNonEmptyString(obj.emotionArc) ? obj.emotionArc : ''),
    hookPhrase: slot?.hookPhrase || String(obj.hookPhrase),
    stylePrompt: String(obj.stylePrompt),
    lyrics: String(obj.lyrics),
    ...(isNonEmptyString(obj.thumbnailText) ? { thumbnailText: obj.thumbnailText } : {}),
    youtube,
    ...(isNonEmptyString(obj.youtubeTitleKo) ? { youtubeTitleKo: obj.youtubeTitleKo } : {}),
    ...(isNonEmptyString(obj.youtubeTitleJa) ? { youtubeTitleJa: obj.youtubeTitleJa } : {}),
    qualityScore: 0,
    warnings: [],
    ...(slot ? { songRole: slot.songRole } : {})
  };
  return { song };
}

export interface ImportSongsReport {
  blueprint: PlaylistBlueprint | null;
  importedCount: number;
  skippedCount: number;
  skippedReasons: string[];
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
  preassignedSongs: PreassignedSongSlot[] = []
): ImportSongsReport {
  let parsed: unknown;
  try {
    parsed = parseLeniently(rawText);
  } catch {
    return { blueprint: null, importedCount: 0, skippedCount: 0, skippedReasons: ['JSON을 해석하지 못했습니다 — 파일 내용이 올바른 JSON인지 확인하세요.'] };
  }

  const rawSongs = extractSongsArray(parsed);
  if (!rawSongs.length) {
    return { blueprint: null, importedCount: 0, skippedCount: 0, skippedReasons: ['"songs" 배열을 찾지 못했습니다.'] };
  }

  const slotByTrackNo = new Map(preassignedSongs.map(slot => [slot.trackNo, slot]));
  const validSongs: SongIdea[] = [];
  const skippedReasons: string[] = [];

  rawSongs.forEach((raw, index) => {
    const result = normalizeImportedSong(raw, index, slotByTrackNo);
    if ('error' in result) {
      skippedReasons.push(result.error);
      return;
    }
    validSongs.push(result.song);
  });

  if (!validSongs.length) {
    return { blueprint: null, importedCount: 0, skippedCount: rawSongs.length, skippedReasons };
  }

  // TASK B1 — "trackNo 재정렬(1..N 연속)": sort by each song's claimed
  // trackNo, then renumber sequentially so skipped/out-of-order entries never
  // leave gaps or duplicates in the final pack.
  validSongs.sort((a, b) => a.trackNo - b.trackNo);
  const renumbered = validSongs.map((song, idx) => ({ ...song, trackNo: idx + 1 }));

  const scored = scoreSongs(renumbered, opts.channel, opts.lyricLanguage);
  const concept = opts.customConcept || `${opts.channel.name} ${season.label} playlist with ${genres.map(g => g.label).join(' + ')}`;
  const blueprint = buildSignatureBlueprint(opts, genres, moods, season, concept, scored);

  return {
    blueprint,
    importedCount: scored.length,
    skippedCount: rawSongs.length - scored.length,
    skippedReasons
  };
}
