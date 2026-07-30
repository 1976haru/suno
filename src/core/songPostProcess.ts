import type { SongIdea } from '../types';
import { ATOM_WORD_CAP, countWords, splitAtoms } from './promptBudget';
import { findArrangementVocabularyInLyrics } from './lyricVocabularyGuard';

/**
 * TASK v3.60 (TASK B) — a real bridge-path pack (an external coding agent
 * writing songs-output.json, then imported with zero content normalization)
 * still carried template-header labels the agent apparently invented on its
 * own ("Money chords: ...", "Instruments: ...") even though nothing in the
 * bridge instruction told it to — Suno's Style field reads these as literal
 * text, not a form. The local path never produces these (see TASK 5-1's own
 * removal, referenced in conceptDiversity.ts), so this whole module is a
 * defense-in-depth normalizer both paths run through identically instead of
 * the bridge growing its own copy of local-only logic (this task's own
 * explicit "브릿지에 로컬 로직을 복사하지 말 것" instruction) — for the local path it
 * is expected to be a no-op every time.
 */
const STYLE_PROMPT_LABEL_PATTERNS: RegExp[] = [
  /\bMoney chords:\s*/gi,
  /\bInstruments:\s*/gi,
  /\bSignature:\s*/gi,
  /\bArrangement detail:\s*/gi,
  /\bconcept cue:\s*/gi
];

/** Only the bare word "target" directly in front of a duration range is a leaked internal label — "target audience"/"target 92 BPM" style usage elsewhere is left untouched. */
const TARGET_DURATION_LABEL_PATTERN = /\btarget\s+(?=\d{1,2}:\d{2})/gi;

function tidyPunctuation(text: string): string {
  return text
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;])/g, '$1')
    .replace(/([.,;])\1+/g, '$1')
    .trim();
}

function stripStylePromptLabels(stylePrompt: string): { text: string; changed: boolean } {
  let text = stylePrompt;
  let changed = false;
  for (const pattern of STYLE_PROMPT_LABEL_PATTERNS) {
    if (pattern.test(text)) changed = true;
    pattern.lastIndex = 0;
    text = text.replace(pattern, '');
  }
  if (TARGET_DURATION_LABEL_PATTERN.test(text)) changed = true;
  TARGET_DURATION_LABEL_PATTERN.lastIndex = 0;
  text = text.replace(TARGET_DURATION_LABEL_PATTERN, '');
  return { text: changed ? tidyPunctuation(text) : text, changed };
}

const DURATION_RANGE_PATTERN = /\b\d{1,2}:\d{2}-\d{1,2}:\d{2}\b/g;

function dedupeDurationMentions(stylePrompt: string): { text: string; changed: boolean } {
  const seen = new Set<string>();
  let changed = false;
  const text = stylePrompt.replace(DURATION_RANGE_PATTERN, match => {
    if (seen.has(match)) {
      changed = true;
      return '';
    }
    seen.add(match);
    return match;
  });
  return { text: changed ? tidyPunctuation(text) : text, changed };
}

/**
 * TASK B-3 — a real pack put a full arrangement-description sentence (e.g.
 * "Spiccato strings flicker over quiet water") directly under a bare
 * `[intro]`-family tag, where Suno sings it as the opening lyric line
 * instead of treating it as an instrumental cue (8/17 tracks). Reuses TASK
 * A's own arrangement-vocab-as-subject detector line-by-line rather than
 * inventing a second, looser heuristic — a line in this exact position only
 * gets removed when the same false-positive-tested check that already
 * guards the whole lyric body also flags it.
 */
const INTRO_TAG_PATTERN = /^\[[^\]]*intro[^\]]*\]$/i;

function stripLeakedIntroDescriptionLines(lyrics: string): { text: string; changed: boolean; strippedLines: string[] } {
  const lines = lyrics.split('\n');
  const kept: string[] = [];
  const strippedLines: string[] = [];
  for (const rawLine of lines) {
    const prevKept = kept[kept.length - 1]?.trim() ?? '';
    if (INTRO_TAG_PATTERN.test(prevKept)) {
      const trimmed = rawLine.trim();
      if (trimmed && findArrangementVocabularyInLyrics([{ trackNo: 0, lyrics: trimmed }]).length) {
        strippedLines.push(trimmed);
        continue;
      }
    }
    kept.push(rawLine);
  }
  return { text: kept.join('\n'), changed: strippedLines.length > 0, strippedLines };
}

/** TASK B-4 — diagnostic only, never rewrites: flags long comma/semicolon-separated clauses in a bridge song's raw stylePrompt the same way composeStylePrompt's own TASK C-8 diagnostic flags long structured atoms. */
function longStylePromptClauseWarnings(trackNo: number, stylePrompt: string): string[] {
  const warnings: string[] = [];
  for (const atom of splitAtoms(stylePrompt)) {
    const wordCount = countWords(atom);
    if (wordCount > ATOM_WORD_CAP) {
      const preview = atom.length > 40 ? `${atom.slice(0, 40)}...` : atom;
      warnings.push(`Track ${trackNo}: style prompt clause "${preview}" is ${wordCount} words long.`);
    }
  }
  return warnings;
}

/**
 * The single shared normalization pass both core/localGenerator.ts and
 * core/claudeCodeBridge.ts's importSongsJson run every song through right
 * before scoreSongs. B-1~B-3 are mechanical only (label/duplicate-range
 * removal, a narrowly-scoped leaked-instrumental-line strip) — never a
 * creative rewrite of the agent's actual lyric/style content. B-4 only adds
 * warnings, never changes text.
 */
export function normalizeSongOutput(song: SongIdea): SongIdea {
  const warnings: string[] = [...(song.warnings || [])];

  const labelResult = stripStylePromptLabels(song.stylePrompt);
  const durationResult = dedupeDurationMentions(labelResult.text);
  const stylePrompt = durationResult.text;
  if (labelResult.changed) {
    warnings.push(`Track ${song.trackNo}: removed template-header labels (Money chords:/Instruments:/Signature:/Arrangement detail:/concept cue:/target) from the style prompt.`);
  }
  if (durationResult.changed) {
    warnings.push(`Track ${song.trackNo}: removed a duplicate duration mention from the style prompt.`);
  }

  const introResult = stripLeakedIntroDescriptionLines(song.lyrics);
  const lyrics = introResult.text;
  if (introResult.changed) {
    warnings.push(`Track ${song.trackNo}: removed an arrangement-description line under an intro tag from the lyrics — "${introResult.strippedLines[0]}"`);
  }

  warnings.push(...longStylePromptClauseWarnings(song.trackNo, stylePrompt));

  return { ...song, stylePrompt, lyrics, warnings };
}
