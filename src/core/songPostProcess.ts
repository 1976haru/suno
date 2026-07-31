import type { IntroMode, SongIdea } from '../types';
import { ATOM_WORD_CAP, countWords, splitAtoms } from './promptBudget';

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
 * TASK B-3 (v3.60) — a real pack put a full arrangement-description
 * sentence (e.g. "Spiccato strings flicker over quiet water") directly
 * under a bare `[intro]`-family tag, where Suno sings it as the opening
 * lyric line instead of treating it as an instrumental cue (8/17 tracks).
 * Originally reused TASK A's arrangement-vocab-as-subject detector
 * line-by-line — but a real pack showed "Morning opens on the table"
 * (not arrangement vocabulary at all) surviving under the same tag while
 * the stylePrompt declared "(INTRO ONLY)", a direct contradiction the
 * old rule never caught (7/16).
 *
 * TASK v3.62 (TASK 2-4) — corrected rule: whether stylePrompt itself
 * declares an instrument-only intro is the actual signal, not whether the
 * specific line happens to be arrangement-vocab-as-subject. If it does,
 * every line under the intro tag is dropped unconditionally (an
 * instrument-only intro cannot have ANY sung line under it, regardless of
 * content) and the tag is relabeled `[Instrumental Intro]`; if it doesn't,
 * the line is real lyric content and is kept as-is. The old detector
 * (findArrangementVocabularyInLyrics) still runs — just at the whole-lyric-
 * body level via TASK A/compositionScorer.ts, not as this function's own
 * strip criterion.
 *
 * TASK v3.64 (TASK B) — that "stylePrompt declares (INTRO ONLY)" signal
 * stopped ever being true the moment v3.62 TASK 1 removed the verbatim
 * requirement that used to write it — a real 18-song pack measured 12/18
 * songs still singing a leaked line under [intro] because the rule above
 * simply never fired again. The signal is now slot.introMode (see
 * introModePlan.ts), an app-planned value the LLM never has to declare in
 * its own stylePrompt text for this rule to work.
 */
const INTRO_TAG_PATTERN = /^\[([^\]]*intro[^\]]*)\]$/i;
const ANY_SECTION_TAG_PATTERN = /^\[[^\]]+\]$/;
/** A line entirely wrapped in parentheses is a deliberate non-lyric stage direction (e.g. lyricEngine.ts's WORDLESS_HUM_LINE, "(soft wordless hum of the hook melody, no lyrics, 2 bars)"), never leaked prose — must never be stripped as if it were sung content. */
const PARENTHETICAL_DIRECTION_PATTERN = /^\(.*\)$/;

function stripLeakedIntroDescriptionLines(lyrics: string, introMode: IntroMode | undefined): { text: string; changed: boolean; strippedLines: string[] } {
  const declaresInstrumentOnlyIntro = introMode === 'instrumental';
  const lines = lyrics.split('\n');
  const kept: string[] = [];
  const strippedLines: string[] = [];
  for (const rawLine of lines) {
    const prevKeptTrimmed = kept[kept.length - 1]?.trim() ?? '';
    const introTagMatch = INTRO_TAG_PATTERN.exec(prevKeptTrimmed);
    if (introTagMatch && declaresInstrumentOnlyIntro) {
      const trimmed = rawLine.trim();
      // Only strip an actual content line — a line that's itself a bracket
      // section tag (e.g. [verse 1] immediately following [instrumental
      // hook intro], with no lyric line in between) or a parenthetical
      // stage direction (wordless-hum cold opens) must never be treated
      // as leaked content.
      if (trimmed && !ANY_SECTION_TAG_PATTERN.test(trimmed) && !PARENTHETICAL_DIRECTION_PATTERN.test(trimmed)) {
        strippedLines.push(trimmed);
        // Relabel the tag itself, once, the first time we act on it.
        const keptTagIndex = kept.length - 1;
        if (!/^\[Instrumental Intro\]$/i.test(kept[keptTagIndex].trim())) {
          kept[keptTagIndex] = '[Instrumental Intro]';
        }
        continue;
      }
    }
    kept.push(rawLine);
  }
  return { text: kept.join('\n'), changed: strippedLines.length > 0, strippedLines };
}

/**
 * TASK v3.71 (TASK C) — v3.70 already removed "[end]" from local generation,
 * the remote schema hint, and the structure-template legend text — but real
 * Codex output still carried a trailing "[end]" tag in 18/18 songs. The tag
 * does nothing in Suno and only adds a section that inflates render length;
 * buildSystemInstruction now also states this explicitly and unconditionally
 * (promptComposer.ts), but this strip is the defense-in-depth backstop for
 * any agent (or old, already-saved pack) that still adds one — "[outro]"
 * covered too, since some agents invent that instead of "[end]". Only the
 * very last non-blank line is ever touched; a legitimate "[outro]"-tagged
 * section with real content isn't this pattern (the tag must be alone, with
 * nothing sung under it, to match).
 */
const TRAILING_END_OUTRO_TAG_PATTERN = /^\[(end|outro)\]$/i;

function stripTrailingEndOutroTag(lyrics: string): { text: string; changed: boolean } {
  const lines = lyrics.split('\n');
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === '') end--;
  if (end === 0 || !TRAILING_END_OUTRO_TAG_PATTERN.test(lines[end - 1].trim())) {
    return { text: lyrics, changed: false };
  }
  let newEnd = end - 1;
  while (newEnd > 0 && lines[newEnd - 1].trim() === '') newEnd--;
  return { text: lines.slice(0, newEnd).join('\n'), changed: true };
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
export function normalizeSongOutput(song: SongIdea, introMode?: IntroMode): SongIdea {
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

  const introResult = stripLeakedIntroDescriptionLines(song.lyrics, introMode);
  const endTagResult = stripTrailingEndOutroTag(introResult.text);
  const lyrics = endTagResult.text;
  if (introResult.changed) {
    warnings.push(`Track ${song.trackNo}: planned as an instrumental intro (introMode) — removed the sung line(s) under [intro] and relabeled it [Instrumental Intro] — "${introResult.strippedLines[0]}"`);
  }
  if (endTagResult.changed) {
    warnings.push(`Track ${song.trackNo}: removed a trailing [end]/[outro] tag from the lyrics — it does nothing in Suno and only inflates render length.`);
  }

  warnings.push(...longStylePromptClauseWarnings(song.trackNo, stylePrompt));

  return { ...song, stylePrompt, lyrics, warnings };
}
