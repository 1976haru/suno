import type { ProviderSettings, SongIdea } from '../types';
import { buildProxyHeaders, callGenerateProxy } from '../providers/proxyFetch';
import { defaultModelFor } from '../data/modelRegistry';
import { extractLyricSungLines } from './srtExport';

/**
 * v3.57 (지시문 C) — CapCut SRT export needs the Korean/Japanese translation
 * to be line-aligned with the exact same sung-line list core/srtExport.ts's
 * extractLyricSungLines produces (see types.ts's SongIdea.lyricTranslations),
 * so this module always works with that flattened line array rather than
 * the raw lyrics string. Two ways to get a translation, per the brief:
 * translateSongLyricsBatch (a live API call through the same /api/generate
 * proxy every other provider call in this app uses) for a user with an API
 * key configured, and the bridge instruction/import pair below for a user
 * running this through an external coding agent instead (mirrors
 * core/claudeCodeBridge.ts's buildClaudeCodeInstruction/importSongsJson
 * shape, scoped down to just this one translation task).
 */

export interface SongLyricLines {
  trackNo: number;
  lines: string[];
}

export interface LyricTranslationResult {
  ko?: string[];
  ja?: string[];
}

/** Extracts each song's ordered sung-line text only (see extractLyricSungLines) — the exact array a returned "ko"/"ja" translation must line up with. */
export function songLyricLinesFor(songs: Pick<SongIdea, 'trackNo' | 'lyrics'>[]): SongLyricLines[] {
  return songs.map(song => ({ trackNo: song.trackNo, lines: extractLyricSungLines(song.lyrics).map(line => line.text) }));
}

const TRANSLATION_INSTRUCTION = [
  'You are translating song lyrics into subtitle-ready Korean and Japanese (for on-screen video captions, not for singing/dubbing).',
  'For every song below, translate each numbered English lyric line into natural Korean AND natural Japanese.',
  'Rules:',
  '- Preserve the exact line count and order given for every song — never merge, split, reorder, or skip lines.',
  '- Keep each translated line concise enough to read comfortably as a single-line video subtitle.',
  '- Prioritize natural phrasing a native speaker would actually say/sing over a literal word-for-word translation.',
  '- Never add explanations, romanization, notes, or extra lines.',
  'Return ONLY JSON in this exact shape, no markdown fences, no surrounding prose:',
  '{"translations": [{"trackNo": 1, "ko": ["line1_ko", "line2_ko", "..."], "ja": ["line1_ja", "line2_ja", "..."]}, "..."]}',
  'Each song\'s "ko" and "ja" arrays must have exactly the same length as that song\'s input "lines" array, in the same order.'
].join('\n');

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

function parseLeniently(rawText: string): unknown {
  const cleaned = cleanJsonText(rawText);
  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through to the extraction pass below
  }
  return JSON.parse(extractJsonObject(cleaned));
}

interface RawTranslationEntry {
  trackNo?: unknown;
  ko?: unknown;
  ja?: unknown;
}

function translationsArrayFrom(parsed: unknown): RawTranslationEntry[] {
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { translations?: unknown }).translations)) {
    return (parsed as { translations: RawTranslationEntry[] }).translations;
  }
  return [];
}

/**
 * Validates each parsed entry against the real per-song line count (never
 * trusts the model's own array length claim) — an entry whose "ko"/"ja"
 * array doesn't match is dropped for that language only (the other language
 * on the same track can still be valid) rather than discarding the whole
 * song's translation over one bad field.
 */
function collectTranslations(
  parsed: unknown,
  songs: SongLyricLines[]
): { translations: Map<number, LyricTranslationResult>; errors: string[] } {
  const errors: string[] = [];
  const translations = new Map<number, LyricTranslationResult>();
  const expectedByTrack = new Map(songs.map(song => [song.trackNo, song.lines.length]));
  const list = translationsArrayFrom(parsed);
  const byTrackNo = new Map(list.map(entry => [Number(entry?.trackNo), entry]));

  for (const [trackNo, expectedLength] of expectedByTrack) {
    const entry = byTrackNo.get(trackNo);
    if (!entry) {
      errors.push(`트랙 ${trackNo}: 번역 결과가 없습니다.`);
      continue;
    }
    const ko = Array.isArray(entry.ko) ? entry.ko.map(String) : undefined;
    const ja = Array.isArray(entry.ja) ? entry.ja.map(String) : undefined;
    const koOk = Boolean(ko && ko.length === expectedLength);
    const jaOk = Boolean(ja && ja.length === expectedLength);
    if (!koOk) errors.push(`트랙 ${trackNo}: 한국어 번역 줄 수가 맞지 않습니다 (기대 ${expectedLength}, 실제 ${ko?.length ?? 0}).`);
    if (!jaOk) errors.push(`트랙 ${trackNo}: 일본어 번역 줄 수가 맞지 않습니다 (기대 ${expectedLength}, 실제 ${ja?.length ?? 0}).`);
    if (koOk || jaOk) {
      translations.set(trackNo, { ko: koOk ? ko : undefined, ja: jaOk ? ja : undefined });
    }
  }

  return { translations, errors };
}

/** Live API path: calls the same /api/generate proxy every other provider call in this app uses (src/providers/proxyFetch.ts), asking for JSON so the response round-trips through the proxy's generic safeParseBlueprint parser (see api/generate.js) without any server-side change. */
export async function translateSongLyricsBatch(
  songs: SongLyricLines[],
  settings: ProviderSettings
): Promise<{ translations: Map<number, LyricTranslationResult>; errors: string[] }> {
  if (!songs.length) return { translations: new Map(), errors: [] };
  const provider = settings.provider === 'openai' ? 'openai' : 'anthropic';
  const data = await callGenerateProxy(settings.proxyEndpoint || '/api/generate', buildProxyHeaders(settings), {
    provider,
    model: settings.model || defaultModelFor(provider),
    temperature: 0.3,
    batchSize: songs.length,
    system: TRANSLATION_INSTRUCTION,
    user: { songs: songs.map(song => ({ trackNo: song.trackNo, lines: song.lines })) }
  });
  const parsed = data.blueprint ?? data;
  return collectTranslations(parsed, songs);
}

export const LYRICS_TRANSLATION_BRIDGE_OUTPUT_FILENAME = 'lyrics-translations.json';

/** Bridge path: a self-contained instruction an external coding agent (Claude Code, Codex, ...) can run directly and write its result to a file, mirroring core/claudeCodeBridge.ts's song-generation bridge but scoped to just this translation task. */
export function buildLyricsTranslationBridgeInstruction(songs: SongLyricLines[]): string {
  const payload = { songs: songs.map(song => ({ trackNo: song.trackNo, lines: song.lines })) };
  return [
    'You are translating song lyrics into subtitle-ready Korean and Japanese as a one-shot task in this session — no Anthropic/OpenAI API call, write your result straight to a file.',
    '',
    TRANSLATION_INSTRUCTION,
    '',
    'Input (one entry per song; "lines" is the exact ordered list of sung lyric lines to translate — do not translate section tags, they are not included here):',
    '```json',
    JSON.stringify(payload, null, 2),
    '```',
    '',
    'Output requirement:',
    `- Write a new file named "${LYRICS_TRANSLATION_BRIDGE_OUTPUT_FILENAME}" in the current directory.`,
    '- Its content must be exactly the JSON shape described above ({"translations": [...]}) — no markdown fences, no surrounding prose, inside the file.',
    '- When done, tell me the file\'s path so I can import it back into Suno Weaver Studio.'
  ].join('\n');
}

export interface LyricsTranslationImportReport {
  imported: number;
  errors: string[];
}

/** Reads the bridge's output file content back in — same lenient JSON parse + per-track/per-language validation as the live API path above. */
export function importLyricsTranslationsJson(
  raw: string,
  songs: SongLyricLines[]
): { translations: Map<number, LyricTranslationResult>; report: LyricsTranslationImportReport } {
  let parsed: unknown;
  try {
    parsed = parseLeniently(raw);
  } catch {
    return { translations: new Map(), report: { imported: 0, errors: ['JSON을 해석하지 못했습니다. 파일 내용이 올바른 JSON인지 확인하세요.'] } };
  }
  const { translations, errors } = collectTranslations(parsed, songs);
  return { translations, report: { imported: translations.size, errors } };
}
