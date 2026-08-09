import type { ChannelProfile, LyricLanguage, SongIdea, SongScores } from '../types';
import { hookLength, isWithinHookLengthBounds } from './lyricEngine';
import { countWords, SAFE_TARGET, STYLE_CHAR_TARGET, STYLE_WORD_TARGET_MAX, SUNO_COPY_LIMIT } from './promptBudget';
import { containsBlockedStyleToken, sanitizeSunoStyleText } from './sunoSafety';
import { detectVocalGender, detectVocalGenderPresence } from './vocalPlan';
import { matchVocalPreset } from '../data/vocalPresets';
import { eraLyricSafetyIssues } from '../data/japaneseEraGuidance';
import { extractContentIdFlags } from './exportCompliance';
import { lintEnglishLyrics } from './englishLint';
import { checkTempoAgainstAudienceProfile, checkTempoWordingContradiction } from './tempoComplianceGate';
import { audienceProfileForChannelArchetype } from '../data/audienceProfiles';
import { parseLyricsSections, findEmptyBridge, missingRequiredSections, rapSectionsMissingVocalist, duetPartDistributionIssue } from './lyricsAst';
import { checkSectionAwareRepetition } from './sectionAwareRepetition';
import { sceneSeasonContradictionWarning } from './semanticContradiction';
import { checkEnglishLyricLineQuality, checkTranslationese } from './languageQuality';
import { idolSingleEnglishWordTitleWarning } from './idolTitleLint';
import { GENRE_FORBIDDEN_DESCRIPTORS } from '../data/genreForbiddenDescriptors';
import { auditStylePromptAgainstSpec } from './promptSpec';
import { bilingualLint } from './bilingualLint';
import { checkRelationshipContinuity } from './relationshipContinuity';
import { checkKidsOutcome } from './kidsOutcome';

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
// TASK v3.70 (TASK B) — '[end]' dropped: it reads as nothing in Suno, and
// every structureTemplate shape now intentionally omits it (see
// lyricEngine.ts's composeLyrics) to cut the 9-11 section pack real
// listening measured against a 3:10-3:35 target. Requiring it here would
// warn-and-penalize every single song going forward for correctly NOT
// having a tag this task just removed.
const requiredLyricTags = ['[verse', '[chorus'];

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

const TITLE_HOOK_OVERLAP_STOPWORDS = new Set([
  'i', 'me', 'my', 'we', 'you', 'your', 'it', 'its', 'a', 'an', 'the', 'to', 'for', 'of', 'with',
  'on', 'in', 'at', 'by', 'and', 'or', 'but', 'is', 'be', 'this', 'that', 'still', 'now', 'here'
]);

/**
 * TASK v3.58 (TASK 5-6) — weak, warning-only signal, NOT the pre-v3.28
 * "hook must appear in title verbatim" rule that checkHookQuality's own
 * comment above explains was removed for wrongly flagging good, diverse
 * titles. This only fires on the much rarer, genuinely worth-flagging case:
 * title and hook share not one single content word, so a listener has no
 * way to connect what's sung to what the video is titled. Local generation
 * (lyricEngine.ts's titleFromHook) is built so this practically never
 * fires — its English compression always keeps at least one real hook word,
 * and Korean/Japanese titles are the hook itself — so this exists mainly to
 * catch a remote/bridge-generated title (titleMode="ai-creative" gives the
 * agent a fully independent title) that drifted completely free of its own
 * hook. Deliberately no specific overlap percentage is enforced (see this
 * task's own "제목=훅 일치율 강제 금지" constraint) — zero-overlap is the
 * only condition checked, and it costs no score penalty, just a warning.
 */
function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 2 && !TITLE_HOOK_OVERLAP_STOPWORDS.has(word));
}

export function titleHookOverlapWarning(title: string, hookPhrase: string): string | null {
  const titleWords = contentWords(title || '');
  const hookWords = contentWords(hookPhrase || '');
  if (!titleWords.length || !hookWords.length) return null;
  const titleWordSet = new Set(titleWords);
  if (hookWords.some(word => titleWordSet.has(word))) return null;
  return `Title "${title}" shares no word with the hook "${hookPhrase}" — a listener may not connect the title to what's actually sung.`;
}

/**
 * TASK v3.60 (TASK E-1) — a real bridge-path pack had a listener scene
 * ("sitting with morning coffee before the day begins") paired with a hook
 * that reads as the opposite time of day ("Stay with Me Tonight"); a second
 * real track paired "sunset" with "Catch the Morning Train". The scene and
 * preassignedSongs.hookPhrase are decided independently (see
 * batchPreallocation.ts's own separate listenerSituations/hook pools), so
 * nothing ever compared them against each other before this. Deliberately
 * the same weak, warning-only signal as titleHookOverlapWarning just above —
 * only the two explicit time-of-day families fire, and only when a phrase
 * unambiguously belongs to just one of them, never a broader "any night/day
 * word" heuristic that would flag ordinary, non-contradictory lyric imagery.
 */
const MORNING_TIME_WORDS = ['morning', 'dawn', 'sunrise', 'daybreak'];
const NIGHT_TIME_WORDS = ['tonight', 'night', 'midnight', 'evening', 'dusk', 'sunset'];

function timeOfDayFamily(text: string): 'morning' | 'night' | null {
  const lower = (text || '').toLowerCase();
  const hasMorning = MORNING_TIME_WORDS.some(word => new RegExp(`\\b${word}\\b`).test(lower));
  const hasNight = NIGHT_TIME_WORDS.some(word => new RegExp(`\\b${word}\\b`).test(lower));
  if (hasMorning && !hasNight) return 'morning';
  if (hasNight && !hasMorning) return 'night';
  return null;
}

export function hookSceneTimeOfDayWarning(hookPhrase: string, listenerSituation: string): string | null {
  const hookFamily = timeOfDayFamily(hookPhrase);
  const sceneFamily = timeOfDayFamily(listenerSituation);
  if (!hookFamily || !sceneFamily || hookFamily === sceneFamily) return null;
  return `Hook "${hookPhrase}" reads as ${hookFamily}, but the listener scene ("${listenerSituation}") reads as ${sceneFamily} — a time-of-day mismatch.`;
}

/**
 * TASK v3.60 (TASK E-2) — deliberately narrow: fires only when the scene
 * names exactly one side of a conflicting prop pair and the lyrics assert
 * only the other side (never both, and never when the scene names neither).
 * The real 17-song measured pack happened not to reproduce this exact
 * pattern (coffee/tea always matched between scene and lyrics), but the
 * task explicitly asked for the same class of check as the hook/scene
 * time-of-day one above, so a future scene/lyric drift doesn't go
 * unnoticed the way the time-of-day one did.
 */
const CONFLICTING_PROP_PAIRS: [string, string][] = [['coffee', 'tea']];

export function scenePropContradictionWarning(listenerSituation: string, lyrics: string): string | null {
  const scene = (listenerSituation || '').toLowerCase();
  const body = (lyrics || '').toLowerCase();
  for (const [a, b] of CONFLICTING_PROP_PAIRS) {
    const sceneHasA = new RegExp(`\\b${a}\\b`).test(scene);
    const sceneHasB = new RegExp(`\\b${b}\\b`).test(scene);
    const bodyHasA = new RegExp(`\\b${a}\\b`).test(body);
    const bodyHasB = new RegExp(`\\b${b}\\b`).test(body);
    if (sceneHasA && !sceneHasB && bodyHasB && !bodyHasA) {
      return `Listener scene establishes "${a}", but the lyrics instead sing about "${b}" — a prop mismatch.`;
    }
    if (sceneHasB && !sceneHasA && bodyHasA && !bodyHasB) {
      return `Listener scene establishes "${b}", but the lyrics instead sing about "${a}" — a prop mismatch.`;
    }
  }
  return null;
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

  const overlapWarning = titleHookOverlapWarning(song.title, hook);
  if (overlapWarning) warnings.push(overlapWarning);

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

  // 지시문 09 (TASK C-2) — core/promptSpec.ts's auditStylePromptAgainstSpec
  // existed but was never called from a real generation path. Full
  // generative authority over stylePrompt construction (a PromptSpec
  // compiler replacing core/promptBudget.ts's own sophisticated
  // priority/floor/shortForm compiler) was always out of scope — "09는
  // 호출되게까지만, 권위화는 10에서" — so this wires in the ONE part of
  // promptSpec.ts that's genuinely safe to call today: a real, NEW check
  // (duplicate BPM declarations) that BPM_DISCLOSURE_PATTERN above doesn't
  // catch (that only checks BPM is disclosed AT LEAST once, never that it's
  // declared more than once). 정합성 점검 §3 — the never-wired compiler
  // prototype (compilePromptSpec/promptSpecFromSlot) was later removed from
  // promptSpec.ts as dead code; auditStylePromptAgainstSpec below is
  // unaffected.
  const specViolations = auditStylePromptAgainstSpec(song.stylePrompt, {
    vocal: { gender: targetGender === 'male' || targetGender === 'female' ? targetGender : undefined, text: '' }
  });
  for (const violation of specViolations) {
    pushUnique(warnings, `Prompt spec violation (${violation.field}): ${violation.detail}`);
    score -= 8;
  }

  // 지시문 08 (TASK C) — real structural/semantic lyric checks
  // (core/lyricsAst.ts, sectionAwareRepetition.ts, semanticContradiction.ts,
  // languageQuality.ts) existed as pure, individually-tested modules but
  // were never actually called from any real generation path — every song
  // funnels through scoreSong regardless of provider (same choke point the
  // englishLint/tempoComplianceGate wiring below already uses), so this is
  // the one place that surfaces their findings in song.warnings/qualityScore
  // instead of leaving them as unreachable dead code.
  const lyricSections = parseLyricsSections(song.lyrics);
  if (findEmptyBridge(lyricSections).length) {
    pushUnique(warnings, 'Lyrics contain a [bridge] section tag with no lines under it.');
    score -= 8;
  }
  const missingSections = missingRequiredSections(lyricSections);
  if (missingSections.length) {
    pushUnique(warnings, `Lyrics are missing required section(s): ${missingSections.join(', ')}.`);
    score -= 15;
  }
  if (rapSectionsMissingVocalist(lyricSections).length) {
    pushUnique(warnings, 'A [rap] section has no vocalist assignment.');
    score -= 5;
  }
  const duetIssue = duetPartDistributionIssue(lyricSections, targetGender ?? undefined);
  if (duetIssue) {
    pushUnique(warnings, duetIssue);
    score -= 6;
  }
  for (const finding of checkSectionAwareRepetition(lyricSections, channel?.kidsAgeTierId)) {
    pushUnique(warnings, `Section repetition: ${finding.detail}`);
    score -= 6;
  }
  const sceneContradiction = sceneSeasonContradictionWarning(song.listenerSituation, song.lyrics);
  if (sceneContradiction) {
    pushUnique(warnings, sceneContradiction);
    score -= 5;
  }

  // 지시문 11 (TASK A) — kr-2030/jp-2030 전용: 관계 상태 연속성. 다른
  // 워크스페이스의 가사에는 "관계"라는 축 자체가 없어(시니어 추억/아이 동요 등)
  // 이 체크를 전역으로 걸면 오탐만 늘어난다 — archetype으로 명시적으로 좁힌다.
  if (channel?.archetype === 'kr-2030-pop' || channel?.archetype === 'jp-2030-pop') {
    const relationshipLanguage = channel.archetype === 'jp-2030-pop' ? 'japanese' : 'korean';
    for (const issue of checkRelationshipContinuity(song.lyrics, relationshipLanguage)) {
      pushUnique(warnings, `Relationship continuity: ${issue.labelKo}`);
      score -= 12;
    }
  }

  // 지시문 11 (TASK B) — kr-kids-song/jp-kids-song 전용. senior-oldpop의
  // 'kids' archetype(작은 라디오 싱어롱 채널, 실제 아동 대상이 아님)은
  // 명시적으로 제외한다 — 이 체크는 실제 아동 청자를 향한 서사 안전성이
  // 목적이라 senior 콘텐츠에 걸면 대상이 아닌 곳에 오탐만 늘어난다.
  if (channel?.archetype === 'kr-kids-song' || channel?.archetype === 'jp-kids-song') {
    const kidsLanguage = channel.archetype === 'jp-kids-song' ? 'japanese' : 'korean';
    for (const issue of checkKidsOutcome(song.lyrics, kidsLanguage)) {
      pushUnique(warnings, `Kids narrative outcome: ${issue.labelKo}`);
      score -= 15;
    }
  }
  // languageQuality.ts's own doc comment calls its English checks "advisory
  // only, never blocking, since this is a style preference, not a
  // correctness rule" — real measurement against a well-formed fixture
  // confirmed why: the crude vowel-cluster syllable approximation flags
  // ordinary, perfectly singable lines ("gently one more time", "I finally
  // understand") at its 2.0 threshold. Surfaced as a visible warning (the
  // real point of wiring this in) without a score penalty, matching its own
  // documented non-blocking status — translationese markers are a fixed,
  // precise phrase list (not a heuristic approximation) so those keep a real
  // penalty.
  const sungLines = lyricSections.flatMap(section => section.lines);
  if (language === 'english') {
    for (const finding of checkEnglishLyricLineQuality(sungLines)) {
      pushUnique(warnings, `English lyric quality (${finding.kind}): ${finding.detail}`);
    }
  } else {
    for (const warning of checkTranslationese(sungLines, language)) {
      pushUnique(warnings, `Translationese: ${warning}`);
      score -= 3;
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

  // 지시문 08 (TASK C) — data/genreForbiddenDescriptors.ts existed
  // (mutually-exclusive genre-pair phrase table, e.g. a swing/jazz genre's
  // stylePrompt must never contain "no swing") but nothing ever checked a
  // real generated stylePrompt against it.
  if (song.genreId) {
    for (const rule of GENRE_FORBIDDEN_DESCRIPTORS) {
      if (!rule.genreIds.includes(song.genreId)) continue;
      for (const phrase of rule.forbiddenPhrases) {
        if (prompt.includes(phrase.toLowerCase())) {
          pushUnique(warnings, `Style prompt contains a phrase that contradicts genre "${song.genreId}": "${phrase}".`);
          score -= 10;
        }
      }
    }
  }

  // 지시문 08 (TASK C) — core/bilingualLint.ts existed (E1/F1's real
  // 3-5-target-word / repeat-twice / no-glued-particle rules for a
  // bilingual-learning song) but was never called. Scoped to the two real
  // bilingual-learning genre ids this rule set was actually built for
  // (krkids-bilingual: Korean base + English target words; jpkids-english-
  // learning: Japanese base) — every other genre's lyrics legitimately
  // contain occasional English loanwords with no 3-5-word learning-list
  // constraint, so applying this generally would false-positive constantly.
  if (song.genreId === 'krkids-bilingual' || song.genreId === 'jpkids-english-learning') {
    const baseLanguage = song.genreId === 'jpkids-english-learning' ? 'japanese' : 'korean';
    for (const issue of bilingualLint(song.lyrics, { baseLanguage })) {
      pushUnique(warnings, `Bilingual content: ${issue}`);
      score -= 4;
    }
  }

  // 지시문 08 (TASK C) — core/idolTitleLint.ts existed but was never called
  // from any real generation path. kr-idol-only (its own §9-3 scope: a real
  // K-pop existing-song-title collision risk, not a general title rule) —
  // advisory-only, matching the module's own doc comment ("never blocks
  // generation").
  if (channel?.archetype === 'kr-idol-male' || channel?.archetype === 'kr-idol-female') {
    const titleWarning = idolSingleEnglishWordTitleWarning(song.title);
    if (titleWarning) pushUnique(warnings, titleWarning);
  }

  const hookCheck = checkHookQuality(song, language);
  for (const warning of hookCheck.warnings) pushUnique(warnings, warning);
  score -= hookCheck.penalty;

  // v5.22 (AXIS 3 §3-5) — every real generation path (bridge import, Batch
  // result, realtime API, local generation, per-song regen) already funnels
  // through scoreSong regardless of provider (see TASK A1/A5's own doc
  // comment just below on the identical reasoning for stylePrompt fixups) —
  // the single choke point this task's own §3-5 asks englishLint to be
  // wired into, rather than adding a second call site per path. English-only
  // (core/englishLint.ts checks English grammar rules; running them against
  // Korean/Japanese lyrics — including a 'bilingual' pack's own mixed lines —
  // would be meaningless, so this is skipped for every other language).
  let englishScore = 100;
  if (language === 'english') {
    const lint = lintEnglishLyrics(song.lyrics, song.hookPhrase);
    for (const issue of lint.issues) pushUnique(warnings, `English lint (${issue.severity}): ${issue.labelKo} — "${issue.excerpt}"`);
    const blockingCount = lint.issues.filter(issue => issue.severity === 'blocking').length;
    englishScore = Math.max(0, 100 - blockingCount * 15);
    score -= blockingCount * 8;
  }

  // v5.22 (AXIS 2 §2-3) — same "every path funnels through scoreSong" choke
  // point as englishScore just above, for the POST-hoc BPM verification
  // core/tempoComplianceGate.ts's own header doc comment explains (a real
  // pack delivered BPM 131 against a documented 100 ceiling — the
  // pre-generation design-time check alone wasn't enough).
  //
  // v5.22 — checkTempoAgainstGenreRange is deliberately NOT wired in here,
  // even though the task spec's own §2-3 asks for it: real verification
  // (tests/quality.test.ts's own "well-formed locally generated song"
  // case) showed a legitimate, correctly-generated song at BPM 84 against
  // its genre's own tempoRange of 96-106 — core/tempoPlan.ts's
  // resolveTempoWithBand resolves BPM from the audience profile's tempo
  // BAND, explicitly NOT from any individual genre's own tempoRange, by
  // design (see that function's own doc comment). Enforcing genre.tempoRange
  // here would flag correctly-generated packs as broken across this whole
  // app, not catch a real defect — the function itself stays in
  // tempoComplianceGate.ts (still correct in isolation, and tested there)
  // for whichever future task actually reconciles tempo-band vs.
  // genre-tempoRange design, but it is not a safe check to enforce today.
  if (typeof song.bpm === 'number') {
    const audienceProfile = audienceProfileForChannelArchetype(channel?.archetype, channel?.audience);
    const tempoIssues = [
      ...checkTempoAgainstAudienceProfile(song.bpm, audienceProfile),
      ...checkTempoWordingContradiction(song.stylePrompt, song.bpm)
    ];
    for (const issue of tempoIssues) {
      pushUnique(warnings, `Tempo compliance: ${issue.labelKo} — ${issue.detail}`);
      score -= 10;
    }
  }

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

  // TASK v3.58 (TASK 7-7) — composeStylePrompt's own promptWordCount/
  // promptWithinWordTarget (localGenerator.ts) were computed at generation
  // time but nothing ever read them back here: quality.ts's own word-count
  // check only ever covered *lyrics* (see the wordCount check earlier in
  // this function), so a 140-word style prompt scored the same as a
  // 30-word one — a real 18-song pack averaged 94-95/100 with zero
  // warnings despite every prompt being 4x Suno's own documented 15-30
  // word sweet spot. Cascading tiers (only the highest one that applies
  // fires, so one overage doesn't stack three penalties) computed on the
  // final, already-trimmed stylePrompt rather than the possibly-stale
  // song.promptWordCount snapshot from before this function's own
  // sanitize/trim steps above.
  const finalWordCount = countWords(stylePrompt);
  if (finalWordCount > 70) {
    pushUnique(warnings, `Style prompt is ${finalWordCount} words (target ${STYLE_WORD_TARGET_MAX}) — far more than Suno's own 15-30 word sweet spot.`);
    score -= 15;
  } else if (finalWordCount > 50) {
    pushUnique(warnings, `Style prompt is ${finalWordCount} words (target ${STYLE_WORD_TARGET_MAX}) — well past Suno's own 15-30 word sweet spot.`);
    score -= 5;
  } else if (finalWordCount > STYLE_WORD_TARGET_MAX) {
    pushUnique(warnings, `Style prompt is ${finalWordCount} words (target ${STYLE_WORD_TARGET_MAX}).`);
  }
  if (stylePrompt.length > SUNO_COPY_LIMIT) {
    pushUnique(warnings, `Style prompt is ${stylePrompt.length} chars, over Suno's ${SUNO_COPY_LIMIT}-char hard limit.`);
    score -= 25;
  } else if (stylePrompt.length > 600) {
    pushUnique(warnings, `Style prompt is ${stylePrompt.length} chars (target ${STYLE_CHAR_TARGET}).`);
    score -= 5;
  }

  const structureScore = Math.max(0, score);
  // v4.1 (TASK D) — safety is its own axis, not folded into the structural
  // score above: a copyright/imitation/artist-name/blocked-token hit is a
  // legal/policy risk, not a formatting nit, and burying it inside one
  // combined number is exactly the "49% concept fit hidden behind 95
  // structure" problem this task exists to fix. Reuses
  // exportCompliance.ts's own extractContentIdFlags so this score and the
  // pre-upload Content ID checklist never disagree about what counts as a
  // flag. Flat per-flag penalty (not a re-derivation of scoreSong's own
  // per-category deduction amounts above) — documented as a heuristic, not
  // a precise legal-risk model.
  const safetyScore = Math.max(0, 100 - extractContentIdFlags({ warnings }).length * 25);

  return {
    ...song,
    stylePrompt,
    qualityScore: structureScore,
    // v4.1 (TASK D) — conceptFitScore/diversityScore are pack-level (need
    // every song in the set, not just this one); scoreSong only ever sees
    // one song, so they're provisionally neutral (100 = "nothing measured
    // yet, don't penalize") here and get overwritten with real pack-aware
    // values by scoreSongs below. A caller that calls scoreSong directly
    // (bypassing scoreSongs) keeps this neutral placeholder rather than a
    // fabricated number.
    // v5.22 (AXIS 3/4) — englishScore is real (computed above); uniquenessScore
    // stays the same "provisionally neutral, overwritten once real pack/
    // history context exists" placeholder conceptFitScore/diversityScore's
    // own comment already documents — see SongScores.uniquenessScore's own
    // doc comment for where it's actually computed.
    scores: { structureScore, safetyScore, conceptFitScore: 100, diversityScore: 100, englishScore, uniquenessScore: 100 } satisfies SongScores,
    warnings,
    promptLength: stylePrompt.length,
    promptWithinLimit: stylePrompt.length <= SUNO_COPY_LIMIT,
    promptDroppedTerms
  };
}

/**
 * v4.1 (TASK D) — light, undocumented-precision heuristic: how much does
 * this song's own genre/vocal-type repeat elsewhere in the pack? The more
 * a song's own (genre, vocalType) pair dominates the set, the less it
 * personally contributes to the pack's variety. NOT a rigorous diversity
 * algorithm (this task's own scope explicitly doesn't ask for one) — a
 * rough, bounded signal only.
 */
function packDiversityScore(song: SongIdea, songs: SongIdea[]): number {
  if (songs.length <= 1) return 100;
  const genreShare = song.genreId ? songs.filter(other => other.genreId === song.genreId).length / songs.length : 0;
  const vocalShare = song.vocalType ? songs.filter(other => other.vocalType === song.vocalType).length / songs.length : 0;
  const penalty = Math.round(((genreShare + vocalShare) / 2) * 60);
  return Math.max(20, Math.min(100, 100 - penalty));
}

// v4.1 (TASK D) — conceptFitScore is deliberately NOT computed here even
// though it's pack-level like diversityScore above: it needs v3.76's
// auditPromises (core/promiseAudit.ts), which itself depends (transitively,
// via core/localGenerator.ts's emotionArcsBrightOpening/CalmThroughout/
// StrongLift exports) on this file's own scoreSongs — importing it here
// would close a 3-module circular import (quality.ts -> promiseAudit.ts ->
// localGenerator.ts -> quality.ts), which real breakage confirmed: the
// cycle leaves promiseAudit.ts's module-level MOOD_KEYWORDS table holding
// undefined for those pool imports at construction time, crashing every
// pack whose concept text contains a mood keyword (e.g. "잔잔한"). Applying
// conceptFitScore is the display layer's job instead — see
// core/promiseAudit.ts's applyConceptFitScore, called once real concept
// text is known (Step4Result.tsx), not on every generation-path scoreSongs
// call.
export function scoreSongs(songs: SongIdea[], channel?: ChannelProfile, language: LyricLanguage = 'english') {
  const scored = songs.map(song => scoreSong(song, channel, language));
  return scored.map(song => ({
    ...song,
    scores: {
      ...(song.scores as SongScores),
      diversityScore: packDiversityScore(song, scored)
    }
  }));
}
