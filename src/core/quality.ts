import type { ChannelProfile, LyricLanguage, SongIdea } from '../types';
import { hookLength, isWithinHookLengthBounds } from './lyricEngine';
import { SAFE_TARGET, SUNO_COPY_LIMIT } from './promptBudget';
import { containsBlockedStyleToken, sanitizeSunoStyleText } from './sunoSafety';
import { detectVocalGender, detectVocalGenderPresence } from './vocalPlan';
import { matchVocalPreset } from '../data/vocalPresets';
import { eraLyricSafetyIssues } from '../data/japaneseEraGuidance';

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

// TASK v3.43 Part A5 — the fixed vocabulary data/hookDevices.ts's per-song
// arrangement-contrast prompts actually use (stop-time, key/octave lift,
// breakdown, drop-out, half-time, instrumental hook, a cappella tag, double-
// tracked harmony, call-and-response answer riff), checked as a keyword set
// rather than requiring the exact device prompt string verbatim — a remote
// model that lightly rewords a device it was still instructed to use
// shouldn't false-positive as missing it entirely the way a fully dropped
// device should.
const hookDeviceDisclosurePattern = /stop-time|key change|modulat|breakdown|drops? out|dropout|drop-out|half-time|half time|instrumental hook|a cappella|double-track|octave|call and response|answer riff|chorus tag|hook entry|rising sweep|swell|walk-up|pickup|downbeat|one-beat pause|stop-and-go/i;

// TASK v3.43 Part A5 — mirrors core/batchPreallocation.ts's own BPM_PATTERN
// (kept as its own regex here rather than shared, per this codebase's
// existing convention of duplicating small check patterns across files
// instead of coupling modules for them — see e.g. hookDeviceInstructionLine's
// duplication between promptComposer.ts/claudeCodeBridge.ts).
const BPM_DISCLOSURE_PATTERN = /\b\d{2,3}\s*bpm\b/i;
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
 * v3.48.1 keeps the exact BPM atom protected and trims only as far as the
 * hard Suno limit; the softer 900-char target can otherwise erase genre
 * instrument atoms after BPM is appended.
 */
export function enforcePromptLengthBudget(
  stylePrompt: string,
  limit: number = SUNO_COPY_LIMIT,
  _safeTarget: number = SAFE_TARGET
): { prompt: string; droppedAtoms: string[] } {
  if (stylePrompt.length <= limit) return { prompt: stylePrompt, droppedAtoms: [] };

  const atoms = stylePrompt.split(',').map(atom => atom.trim()).filter(Boolean);
  let bpmIndex = -1;
  for (let index = atoms.length - 1; index >= 0; index -= 1) {
    if (/^\d{2,3}\s*bpm$/i.test(atoms[index])) {
      bpmIndex = index;
      break;
    }
  }
  const bpmAtom = bpmIndex >= 0 ? atoms[bpmIndex] : undefined;
  const trimAtoms = bpmIndex >= 0 ? atoms.filter((_, index) => index !== bpmIndex) : atoms;
  const target = bpmAtom ? Math.max(0, limit - bpmAtom.length - 2) : limit;
  const kept: string[] = [];
  const dropped: string[] = [];
  let length = 0;
  for (const atom of trimAtoms) {
    const projected = length + (length ? 2 : 0) + atom.length;
    if (projected > target) {
      dropped.push(atom);
      continue;
    }
    kept.push(atom);
    length = projected;
  }
  if (bpmAtom) kept.push(bpmAtom);
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

  // TASK v3.43 Part A5 — safety net for the other two per-song verbatim-weave
  // atoms (see moneyChordText's hasProgressionDisclosure check above for the
  // established pattern this mirrors). core/batchPreallocation.ts's
  // reconcileWithPreassignedSlot now forcibly repairs hookDeviceText/tempo
  // before a realtime/Batch/bridge song ever reaches here, so this mostly
  // won't fire on those paths — same "mostly redundant but still a visible
  // audit warning" positioning as the vocal-gender check below (a hand-edited
  // saved pack, or a song whose trackNo had no matching slot, has no such
  // repair pass to rely on).
  if (!hookDeviceDisclosurePattern.test(song.stylePrompt)) {
    pushUnique(warnings, 'Missing prompt term: hook device (arrangement-contrast detail)');
    score -= 6;
  }
  if (!BPM_DISCLOSURE_PATTERN.test(song.stylePrompt)) {
    pushUnique(warnings, 'Missing prompt term: tempo (BPM)');
    score -= 6;
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

  // TASK v3.39 Part H — real production output showed a channel's selected
  // vocal gender (e.g. a showa-cafe male preset) silently coming back
  // female in a Codex-bridge-generated stylePrompt.
  // core/batchPreallocation.ts's reconcileWithPreassignedSlot now forcibly
  // corrects this for realtime/Batch/bridge output before it ever reaches
  // here, so this mostly won't fire on those paths anymore — but it's still
  // a visible safety-net warning for anyone auditing a pack (a hand-edited
  // saved pack, or a channel whose defaultVocal genuinely doesn't match this
  // song's own vocalType).
  //
  // TASK v3.41 Part A1 — prefers the explicit gender axis (song.vocalType
  // for a kids-quota song, or the matched VocalPreset's own `gender`
  // otherwise) over sniffing channel.defaultVocal's prose, the same
  // decisive-field-over-prose fix applied to enforceVocalTextInStylePrompt.
  // 'duet' gets its own check (both genders must be present, since a lone
  // gender word is incomplete rather than wrong); 'mixed' still has no
  // reliable single check and is skipped, unchanged from before.
  const targetGender = song.vocalType
    ?? matchVocalPreset(channel?.defaultVocal || '')?.gender
    ?? detectVocalGender(channel?.defaultVocal || '')
    ?? null;
  if (targetGender === 'male' || targetGender === 'female') {
    if (detectVocalGender(song.stylePrompt) !== targetGender) {
      pushUnique(warnings, `Style prompt vocal gender may not match the selected ${targetGender} vocal — review before pasting into Suno.`);
      score -= 5;
    }
  } else if (targetGender === 'duet') {
    const presence = detectVocalGenderPresence(song.stylePrompt);
    if (!presence.male || !presence.female) {
      pushUnique(warnings, 'Style prompt may be missing one side of the selected duet vocal — review before pasting into Suno.');
      score -= 5;
    }
  }

  // TASK v3.39 Part F — an AI-creative hook is free-form text (see
  // GenerationOptions.hookMode), so it can coincidentally contain a token
  // Suno's artist filter blocks. The style prompt itself is sanitized further
  // below regardless, but hookPhrase also appears verbatim in the lyrics
  // (the chorus bookend) where sanitizing isn't safe to do automatically —
  // same reasoning flagHookCollisions already uses for not auto-rewriting a
  // colliding hook. Warn instead, so the song can be reviewed/regenerated.
  if (containsBlockedStyleToken(song.hookPhrase)) {
    pushUnique(warnings, 'Hook may contain a token Suno\'s artist filter blocks — review and regenerate this song if Suno rejects it.');
    score -= 10;
  }

  for (const cliche of channel?.forbiddenCliches || []) {
    if (cliche && riskScanTextLower.includes(cliche.toLowerCase())) {
      pushUnique(warnings, `Channel forbidden cliche detected: ${cliche}`);
      score -= 8;
    }
  }

  for (const issue of eraLyricSafetyIssues(song.lyrics, channel?.archetype)) {
    pushUnique(warnings, issue);
    score -= 8;
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
  // TASK v3.39 Part F — last-line net: mask any known Suno artist-filter
  // token out of the final style prompt regardless of which generation path
  // produced it (see core/sunoSafety.ts). Runs before the length trim below
  // so the trim operates on the already-cleaned text.
  const sanitizedStylePrompt = sanitizeSunoStyleText(stylePrompt);
  if (sanitizedStylePrompt !== stylePrompt) {
    stylePrompt = sanitizedStylePrompt;
    pushUnique(warnings, 'Style prompt contained a token Suno\'s artist filter blocks and was removed.');
  }
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
