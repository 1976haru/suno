import type { ChannelProfile, LyricLanguage, SongIdea } from '../types';
import { hookLength, isWithinHookLengthBounds } from './lyricEngine';
import { SAFE_TARGET, SUNO_COPY_LIMIT } from './promptBudget';

// TASK G1 (v3.10) — updated to match the terse compactMoneyChord/compactHook
// wording ('I-V-vi-IV progression', 'repeats chorus 4x') that replaced the
// old long-form 'money chord foundation: ...' / 'no long instrumental
// break' clauses; those literal phrases no longer appear in generated
// output at all, so checking for them here would falsely flag every song.
//
// TASK v3.29 — a real 20-song Codex-bridge pack showed this false-positive
// again, for a different reason: every stylePrompt correctly disclosed its
// chord progression as "I-V-vi-IV money chords" (real information, matching
// the system instruction), but the literal word "progression" never
// appeared, so every single well-formed song got flagged. A remote model
// isn't guaranteed to use this app's own compactMoneyChord() wording, so the
// check now also accepts the progression itself: roman-numeral notation
// (I-V-vi-IV, ii-V-I, or with jazz/pop chord-quality suffixes like
// "IVmaj7-iii7-vi7"), "money chord(s)", or "chords in <key>".
const progressionPatterns: RegExp[] = [
  /progression/i,
  /\b[ivx]{1,4}[a-z0-9]{0,4}(?:\s*[-–]\s*[ivx]{1,4}[a-z0-9]{0,4}){1,}/i,
  /money chords?/i,
  /\bchords? in [A-G][#b]?\b/i
];

function hasProgressionDisclosure(stylePrompt: string): boolean {
  return progressionPatterns.some(pattern => pattern.test(stylePrompt));
}
const requiredLyricTags = ['[verse', '[chorus', '[end]'];

// H3 (v3.3): a vocative-shaped hook ("Hold on, X") may only address a person
// or an abstract/personified noun, never a physical object ("Hold on,
// coffee"). Local generation makes this impossible by construction (TASK
// A2's curated banks), but a remote LLM's hook isn't guaranteed to avoid it
// — this scans the actual generated text as a content-based safety net.
const vocativeObjectPatternsByLanguage: RegExp[] = [
  /,\s*(the\s+)?(coffee|window|radio|letter|train|doorway|umbrella|lamp|calendar|record|photograph|photo|sweater|candle|street|cup|ticket|notebook|chair|table|door|phone|book|key|clock|mirror|rain|snow|sky)\b/i,
  /,\s*(커피|창문|창가|라디오|편지|기차|문가|우산|램프|달력|레코드|사진|스웨터|촛불|거리|(찻)?잔|표|수첩|의자|탁자|문|전화|책|열쇠|시계|거울|비|눈|하늘)/,
  /、\s*(コーヒー|窓|ラジオ|手紙|列車|電車|戸口|傘|ランプ|カレンダー|レコード|写真|セーター|キャンドル|通り|カップ|切符|ノート|椅子|机|ドア|電話|本|鍵|時計|鏡|雨|雪|空)/
];

/** Exported for core/openingContest.ts (TASK I2, v3.11) — the local cold-open/flagship contest scores candidate hooks before any lyrics/title exist, reusing this same rule rather than duplicating it. */
export function hasVocativeObjectPattern(hookPhrase: string): boolean {
  return vocativeObjectPatternsByLanguage.some(pattern => pattern.test(hookPhrase));
}

/** Exported for core/openingContest.ts (TASK I2, v3.11) — same reuse reason as hasVocativeObjectPattern above. */
export function startsWithLowercase(text: string): boolean {
  const first = [...text].find(ch => /\p{L}/u.test(ch));
  return !!first && first === first.toLowerCase() && first !== first.toUpperCase();
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

/**
 * TASK A5 (v3.3) / TASK X4 (v3.4): rule-based hook checks, runs without any
 * API call. Length is judged by hookLength(), which branches per language
 * (English: word count; Korean: syllables; Japanese: mora) — a plain
 * whitespace word count always reads Japanese hooks as "1 word" and never
 * catches an oversized one.
 *
 * TASK v3.28 — this used to also penalize a title that didn't contain the
 * hookPhrase verbatim ("Hook does not appear in the title"). That's now the
 * intended, desired behavior (see GenerationOptions.titleMode and
 * promptComposer.ts's Hook rules) — titles are deliberately independent of
 * the hook for real Billboard-style variety, so the check was removed
 * rather than left to wrongly flag every good, diverse title.
 */
export function checkHookQuality(song: SongIdea, language: LyricLanguage = 'english'): { warnings: string[]; penalty: number } {
  const warnings: string[] = [];
  let penalty = 0;
  const hook = song.hookPhrase || '';
  if (!hook) return { warnings, penalty };

  if (!isWithinHookLengthBounds(hook, language)) {
    warnings.push(`Hook length (${hookLength(hook, language)}) is outside the singable range for ${language}.`);
    penalty += 10;
  }

  const hookOccurrences = countOccurrences(song.lyrics, hook);
  if (hookOccurrences < 3) {
    warnings.push(`Hook appears only ${hookOccurrences}x in the lyrics — needs to repeat to be memorable.`);
    penalty += 15;
  }

  if (startsWithLowercase(hook)) {
    warnings.push('Hook starts with a lowercase letter.');
    penalty += 5;
  }

  if (hasVocativeObjectPattern(hook)) {
    warnings.push('Hook addresses an object as if it were a person (vocative-object pattern).');
    penalty += 12;
  }

  return { warnings, penalty };
}

/**
 * TASK A1/A5 (v3.5) safety net: core/localGenerator.ts already budgets local
 * stylePrompts through composeStylePrompt(), so this should rarely trigger
 * for local songs — but a remote LLM's freeform stylePrompt isn't guaranteed
 * to respect the system-instruction length rule. Rather than slice(0, N)
 * (which can cut a phrase mid-word), this drops whole comma-separated atoms
 * from the end until the prompt fits, since remote prompts list their most
 * important terms first by construction (see buildSystemInstruction).
 */
export function enforcePromptLengthBudget(
  stylePrompt: string,
  limit: number = SUNO_COPY_LIMIT,
  safeTarget: number = SAFE_TARGET
): { prompt: string; droppedAtoms: string[] } {
  if (stylePrompt.length <= limit) return { prompt: stylePrompt, droppedAtoms: [] };

  const atoms = stylePrompt.split(',').map(atom => atom.trim()).filter(Boolean);
  const kept: string[] = [];
  const dropped: string[] = [];
  let length = 0;
  for (const atom of atoms) {
    const projected = length + (length ? 2 : 0) + atom.length;
    if (projected > safeTarget) {
      dropped.push(atom);
      continue;
    }
    kept.push(atom);
    length = projected;
  }
  return { prompt: kept.join(', '), droppedAtoms: dropped };
}

const imitationPatterns = [
  /\bin the style of\b/i,
  /\bsounds like\b/i,
  /\bsoundalike\b/i,
  /\bas sung by\b/i,
  /\bvoice like\b/i,
  /\bsimilar to\b/i,
  /\bclone of\b/i,
  /\bcopy of\b/i,
  /처럼 부르는/,
  /목소리처럼/,
  /스타일로/,
  /특정 가수/,
  /가수.*모방/,
  /っぽく/,
  /風に/,
  /歌声.*似せ/
];

const copyrightPatterns = [
  /\bcover of\b/i,
  /\brewrite of\b/i,
  /\bmelody from\b/i,
  /\blyrics from\b/i,
  /\bsame melody\b/i,
  /\bsample of\b/i,
  /\binterpolation of\b/i,
  /\bplagiar/i,
  /저작권\s*(침해|위반|문제)/,
  /표절/,
  /원곡\s*(그대로|그대로의|을\s*그대로|복제)/,
  /기존곡\s*(그대로|복제|표절)/,
  /커버곡/,
  /カバー曲/,
  /原曲(そのまま|の複製)/
];

const famousArtistNames = [
  'adele',
  'beatles',
  'beyonce',
  'bts',
  'bruno mars',
  'carpenters',
  'celine dion',
  'ed sheeran',
  'frank sinatra',
  'iu',
  'queen',
  'taylor swift',
  'the weeknd',
  'utada',
  'yumi matsutoya',
  'ado',
  'yoasobi',
  'cho yong-pil',
  'na hoon-a',
  'lim young-woong',
  '아이유',
  '방탄소년단',
  '임영웅',
  '조용필',
  '나훈아',
  '松任谷由実',
  '宇多田ヒカル'
];

function collectSongText(song: SongIdea) {
  return [
    song.title,
    song.hookPhrase,
    song.stylePrompt,
    song.lyrics,
    song.thumbnailText,
    song.youtube?.title,
    song.youtube?.description,
    song.youtube?.tags?.join(' ')
  ].filter(Boolean).join('\n');
}

/**
 * Every style prompt we generate ends with our own safety instruction
 * ("avoid famous artist imitation, ... soundalike vocals"). Scanning that
 * boilerplate for risk terms flags the instruction itself as a violation
 * (e.g. "soundalike vocals" matches the soundalike imitation pattern), so
 * strip it before running the imitation/copyright/artist-name/cliche checks.
 */
function stripSafetyBoilerplate(text: string) {
  return text.replace(/\bavoid\b[^\n]*/gi, ' ');
}

function pushUnique(warnings: string[], warning: string) {
  if (!warnings.includes(warning)) warnings.push(warning);
}

function nameMatchesText(name: string, text: string, textLower: string) {
  if (/^[\x00-\x7f]+$/.test(name)) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
  }
  return textLower.includes(name.toLowerCase());
}

export function scoreSong(song: SongIdea, channel?: ChannelProfile, language: LyricLanguage = 'english'): SongIdea {
  const warnings: string[] = [...(song.warnings || [])];
  let score = 100;
  const text = collectSongText(song);
  const textLower = text.toLowerCase();
  const prompt = song.stylePrompt.toLowerCase();
  const lyrics = song.lyrics.toLowerCase();
  const riskScanText = stripSafetyBoilerplate(text);
  const riskScanTextLower = riskScanText.toLowerCase();

  // TASK v3.29 — 'progression' now accepts an actual chord-progression
  // disclosure (roman numerals, "money chord(s)", "chords in <key>"), not
  // just the literal word — see hasProgressionDisclosure's comment above.
  if (!hasProgressionDisclosure(song.stylePrompt)) {
    pushUnique(warnings, 'Missing prompt term: progression');
    score -= 8;
  }
  if (!prompt.includes('chorus')) {
    pushUnique(warnings, 'Missing prompt term: chorus');
    score -= 8;
  }

  for (const tag of requiredLyricTags) {
    if (!lyrics.includes(tag)) {
      pushUnique(warnings, `Missing lyric tag: ${tag}`);
      score -= 10;
    }
  }

  const wordCount = song.lyrics.split(/\s+/).filter(Boolean).length;
  if (wordCount > 280) {
    pushUnique(warnings, 'Lyrics may be too long for controlled Suno generation.');
    score -= 12;
  }
  if (wordCount < 80) {
    pushUnique(warnings, 'Lyrics may be too short for a complete pop song.');
    score -= 5;
  }

  if (imitationPatterns.some(pattern => pattern.test(riskScanText))) {
    pushUnique(warnings, 'Artist imitation risk: remove singer/style-copy wording.');
    score -= 22;
  }

  if (copyrightPatterns.some(pattern => pattern.test(riskScanText))) {
    pushUnique(warnings, 'Copyright risk: remove existing-song, cover, melody, or lyric references.');
    score -= 22;
  }

  if (famousArtistNames.some(name => nameMatchesText(name, riskScanText, riskScanTextLower))) {
    pushUnique(warnings, 'Famous artist reference risk: remove direct artist names.');
    score -= 20;
  }

  for (const cliche of channel?.forbiddenCliches || []) {
    if (cliche && riskScanTextLower.includes(cliche.toLowerCase())) {
      pushUnique(warnings, `Channel forbidden cliche detected: ${cliche}`);
      score -= 8;
    }
  }

  if (!song.youtube?.title || !song.youtube?.description || !song.youtube?.tags?.length) {
    pushUnique(warnings, 'YouTube metadata is incomplete.');
    score -= 8;
  }

  const hookCheck = checkHookQuality(song, language);
  for (const warning of hookCheck.warnings) pushUnique(warnings, warning);
  score -= hookCheck.penalty;

  // TASK A1/A5 (v3.5): every song funnels through scoreSong regardless of
  // provider, so this is the one place that guarantees promptLength/
  // promptWithinLimit are always accurate and, for the rare remote-LLM
  // overflow, that the pasted-into-Suno text is never silently truncated
  // mid-phrase.
  let stylePrompt = song.stylePrompt;
  let promptDroppedTerms = song.promptDroppedTerms || [];
  if (stylePrompt.length > SUNO_COPY_LIMIT) {
    const fitted = enforcePromptLengthBudget(stylePrompt);
    stylePrompt = fitted.prompt;
    promptDroppedTerms = [...promptDroppedTerms, ...fitted.droppedAtoms];
    pushUnique(warnings, `Style prompt exceeded ${SUNO_COPY_LIMIT} chars and was trimmed to fit Suno's copy limit.`);
  }

  return {
    ...song,
    stylePrompt,
    qualityScore: Math.max(0, score),
    warnings,
    promptLength: stylePrompt.length,
    promptWithinLimit: stylePrompt.length <= SUNO_COPY_LIMIT,
    promptDroppedTerms
  };
}

export function scoreSongs(songs: SongIdea[], channel?: ChannelProfile, language: LyricLanguage = 'english') {
  return songs.map(song => scoreSong(song, channel, language));
}
