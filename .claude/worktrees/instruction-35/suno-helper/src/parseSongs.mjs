import fs from 'node:fs';

/**
 * TASK v3.31 (Part 2) — accepts both songs-output.json (Claude Code bridge
 * output, `{ songs: [...] }`) and the main app's exportJson() output
 * (`{...blueprint, ...}` — PlaylistBlueprint spread at the top level, so
 * `songs` is still a top-level array alongside projectTitle/channelName/
 * etc.). A bare array is also accepted for leniency. Same duck-typed
 * extraction the main app's core/claudeCodeBridge.ts importSongsJson()
 * already uses, so both tools treat "what counts as a songs list" identically.
 */
export function extractSongsArray(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.songs)) return parsed.songs;
  return [];
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Only the four fields this helper actually pastes into Suno matter here —
 * title, stylePrompt, lyrics, and the optional excludePrompt. Everything
 * else the app's SongIdea/PlaylistBlueprint carries (qualityScore, warnings,
 * youtube metadata, ...) is irrelevant to this tool and deliberately dropped.
 */
export function normalizeSong(raw, index) {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Song #${index + 1} is not a JSON object.`);
  }
  const trackNo = Number.isFinite(Number(raw.trackNo)) && Number(raw.trackNo) > 0 ? Number(raw.trackNo) : index + 1;
  const missing = ['title', 'stylePrompt', 'lyrics'].filter(field => !isNonEmptyString(raw[field]));
  if (missing.length) {
    throw new Error(`Song #${index + 1} (trackNo ${trackNo}) is missing required field(s): ${missing.join(', ')}`);
  }
  return {
    trackNo,
    title: raw.title,
    stylePrompt: raw.stylePrompt,
    lyrics: raw.lyrics,
    excludePrompt: isNonEmptyString(raw.excludePrompt) ? raw.excludePrompt : ''
  };
}

export function parseSongsJson(rawText) {
  const parsed = JSON.parse(rawText);
  const rawSongs = extractSongsArray(parsed);
  if (!rawSongs.length) {
    throw new Error('No "songs" array found in this file.');
  }
  return rawSongs.map((song, index) => normalizeSong(song, index)).sort((a, b) => a.trackNo - b.trackNo);
}

export function loadSongsFromFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return parseSongsJson(raw);
}
