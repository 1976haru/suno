import type { BatchContext, GenerationOptions, GenrePack, MoodPack, SeasonPack } from '../types';
import { generationPacks } from '../data/presets';
import { moneyChordPresets, resolveEarwormMoneyChordMode } from '../data/moneyChords';
import { safeLyricRules } from '../data/lyrics';
import { composeStylePrompt as composeBudgetedStylePrompt } from './promptBudget';
import { compactDuration, compactHook, compactMoneyChord } from './soundSignature';

// TASK A1 (v3.5): Suno's style field truncates anything past 1,000 characters
// — a real measurement of 12 generated songs found 12/12 over that limit
// (avg 1,764 chars), meaning the app's core output couldn't actually be
// pasted into Suno. SAFE_TARGET leaves headroom under the hard limit since
// Suno's own limit isn't guaranteed to stay exactly 1,000 forever.
export const SUNO_STYLE_LIMIT = 1000;
export const SAFE_TARGET = 900;

/**
 * TASK v3.29 — a real 20-song remote-generated pack averaged 143 words/song
 * (20 lines each) and rendered at ~2:00-2:20 in Suno despite every song
 * targeting a 2:50-3:20 duration — the old "Keep song length controlled for
 * ${opts.durationTarget}" instruction only named the enum value itself, with
 * no concrete time range or word-count floor, so a short lyric was never
 * actually a rule violation. Suno's rendered length tracks lyric word count
 * far more directly than any duration-target label; 200-260 total words is
 * what actually produces a genuine ~2:50-3:20 song.
 */
export const MIN_LYRIC_WORDS = 200;
export const MAX_LYRIC_WORDS = 260;

/**
 * Priority order for TASK A2 — filled from the top down; once the running
 * length would cross the safe target, remaining non-essential ids are left
 * out (and recorded in droppedTerms) rather than truncating text mid-phrase.
 * The first six ids are essential and are never dropped, even if that pushes
 * the final prompt over SAFE_TARGET (better an over-length prompt the user
 * can see and trim than a silently incomplete one).
 */
export type PromptTermId =
  | 'genre' | 'vocal' | 'hook' | 'moneyChord' | 'duration' | 'tempo'
  | 'mood' | 'instruments' | 'season' | 'safety' | 'earworm'
  | 'songRole' | 'motif' | 'listenerScene' | 'mixNotes';

export const PROMPT_PRIORITY: PromptTermId[] = [
  'genre', 'vocal', 'hook', 'moneyChord', 'duration', 'tempo',
  'safety', 'earworm', 'mood', 'instruments', 'season',
  'songRole', 'motif', 'listenerScene', 'mixNotes'
];

export const ESSENTIAL_TERM_IDS = new Set<PromptTermId>(['genre', 'vocal', 'hook', 'moneyChord', 'duration', 'tempo']);

export const TERM_LABELS_KO: Record<PromptTermId, string> = {
  genre: '장르',
  vocal: '보컬',
  hook: '훅 반복 지시',
  moneyChord: '코드 진행',
  duration: '곡 길이',
  tempo: '템포',
  mood: '무드',
  instruments: '악기',
  season: '시즌',
  safety: '안전 문구',
  earworm: '이지 리스닝 훅',
  songRole: '트랙 역할',
  motif: '모티프',
  listenerScene: '청자 장면',
  mixNotes: '믹스 노트'
};

/**
 * v3.15 — earwormMode style-prompt atom (PART B of the brief): purely generic
 * composing-technique language (stepwise melody, phrase symmetry, diatonic
 * simplicity) — describes a technique, never a specific song or artist. Kept
 * out of ESSENTIAL_TERM_IDS since this is a preference nudge, not a
 * requirement — it's fine for composeStylePrompt to drop it under budget
 * pressure like any other non-essential atom.
 *
 * Deliberately compact (4 short atoms, ~13 words) rather than the brief's
 * full 6-phrase example text: composeStylePrompt's real per-song budget is a
 * soft 50-word cap (see promptBudget.ts's STYLE_WORD_TARGET_MAX), and a
 * measured mood/instrument-heavy channel was already floor-reducing those
 * categories before this atom was ever added — the full 6-phrase form would
 * simply never survive real generation, defeating the whole feature. Same
 * "verbose preset text -> terse tag" compaction this file already applies to
 * money chords/hooks/duration (see soundSignature.ts's compact* builders).
 */
export const EARWORM_STYLE_ATOMS = 'simple stepwise melody, easy to hum, singalong-friendly pop hook, predictable diatonic phrase structure';

export interface PromptPart {
  id: PromptTermId;
  text: string | undefined | null;
}

export interface StylePromptResult {
  prompt: string;
  length: number;
  withinLimit: boolean;
  /** Korean labels of dropped term categories (TASK A5 UI shows this verbatim). */
  droppedTerms: string[];
}

// TASK A3 — descriptor words that show up once per genre/mood/season pack
// and pile up into visible padding once several packs are combined (e.g.
// two "nostalgic ..." genre styleCores plus the "nostalgic" mood pack).
// Only these two were confirmed repeating 3x+ in the actual measured output.
const REPEATED_ADJECTIVES = ['warm', 'nostalgic'];
const ADJECTIVE_CAP = 2;

function splitAtoms(text: string | undefined | null): string[] {
  if (!text) return [];
  return text.split(/[;,]/).map(part => part.trim()).filter(Boolean);
}

/** ids defaults to a same-length array of a placeholder id when called with plain strings (the public dedupeTerms() case, which doesn't need id tracking). */
function capRepeatedAdjectives(atoms: string[], ids: PromptTermId[]): { id: PromptTermId; text: string }[] {
  const counts = new Map<string, number>();
  return atoms
    .map((atom, i) => {
      let text = atom;
      for (const word of REPEATED_ADJECTIVES) {
        const re = new RegExp(`\\b${word}\\b`, 'i');
        if (!re.test(text)) continue;
        const count = (counts.get(word) || 0) + 1;
        counts.set(word, count);
        if (count > ADJECTIVE_CAP) {
          text = text.replace(re, '').replace(/\s{2,}/g, ' ').trim();
        }
      }
      return { id: ids[i], text };
    })
    .filter(entry => Boolean(entry.text));
}

/**
 * TASK A3 — three passes, in order: (1) exact case-insensitive duplicate
 * removal, (2) containment removal (if atom A's text is fully contained in
 * atom B's, drop A and keep the more specific B — "acoustic guitar" vs.
 * "fingerpicked acoustic guitar"), (3) adjective-repeat suppression (see
 * capRepeatedAdjectives). Exported for direct testing.
 */
export function dedupeTerms(atoms: string[]): string[] {
  const seen = new Set<string>();
  const exactDeduped = atoms.filter(atom => {
    const key = atom.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const containmentDeduped = exactDeduped.filter((atom, i) => {
    const lower = atom.toLowerCase();
    return !exactDeduped.some((other, j) => {
      if (i === j) return false;
      const otherLower = other.toLowerCase();
      if (otherLower.length <= lower.length) return false;
      return otherLower.includes(lower);
    });
  });

  const placeholderIds = containmentDeduped.map(() => 'mood' as PromptTermId);
  return capRepeatedAdjectives(containmentDeduped, placeholderIds).map(entry => entry.text);
}

/**
 * TASK A1/A2 — the single place that turns a bag of tagged phrase parts into
 * one Suno-safe style prompt string. Callers (buildStylePrompt below, and
 * localGenerator's per-song assembly) just tag every fragment with its
 * PromptTermId; this function groups atoms by id, dedupes non-essential
 * groups, then fills the prompt in priority order until the safe target is
 * reached, dropping whatever's left (never mid-phrase — whole atoms only).
 */
export function composeStylePrompt(parts: PromptPart[], limit: number = SAFE_TARGET, safeTarget: number = SAFE_TARGET): StylePromptResult {
  const atomsById = new Map<PromptTermId, string[]>();
  for (const part of parts) {
    const atoms = splitAtoms(part.text);
    if (!atoms.length) continue;
    atomsById.set(part.id, [...(atomsById.get(part.id) || []), ...atoms]);
  }

  // Global exact dedupe first — safe even for essential ids, since it only
  // ever removes a literal repeat, never rewrites meaning-bearing content.
  const seen = new Set<string>();
  for (const id of PROMPT_PRIORITY) {
    const atoms = atomsById.get(id);
    if (!atoms) continue;
    atomsById.set(id, atoms.filter(atom => {
      const key = atom.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }));
  }

  // Containment removal + adjective capping only ever touch non-essential
  // ids — essential ids are always included whole, never rewritten. This
  // runs once, globally, across every non-essential atom together (not
  // per-id) — otherwise a word like "warm" could independently hit its cap
  // in the mood group, the season group, and the safety group and still
  // show up 6+ times in the final prompt.
  const nonEssentialIds = PROMPT_PRIORITY.filter(id => !ESSENTIAL_TERM_IDS.has(id));
  const flatAtoms: string[] = [];
  const flatIds: PromptTermId[] = [];
  for (const id of nonEssentialIds) {
    for (const atom of atomsById.get(id) || []) {
      flatAtoms.push(atom);
      flatIds.push(id);
    }
  }
  const keepMask = flatAtoms.map((atom, i) => {
    const lower = atom.toLowerCase();
    return !flatAtoms.some((other, j) => {
      if (i === j) return false;
      const otherLower = other.toLowerCase();
      if (otherLower.length <= lower.length) return false;
      return otherLower.includes(lower);
    });
  });
  const containedFilteredAtoms = flatAtoms.filter((_, i) => keepMask[i]);
  const containedFilteredIds = flatIds.filter((_, i) => keepMask[i]);
  const cappedAtoms = capRepeatedAdjectives(containedFilteredAtoms, containedFilteredIds);
  for (const id of nonEssentialIds) atomsById.set(id, []);
  cappedAtoms.forEach(({ id, text }) => atomsById.get(id)!.push(text));

  const droppedTerms: string[] = [];
  const keptChunks: string[] = [];
  let currentLength = 0;

  for (const id of PROMPT_PRIORITY) {
    const atoms = atomsById.get(id);
    if (!atoms || !atoms.length) continue;
    const chunk = atoms.join(', ');
    const essential = ESSENTIAL_TERM_IDS.has(id);
    const projected = currentLength + (currentLength ? 2 : 0) + chunk.length;
    if (!essential && projected > safeTarget) {
      droppedTerms.push(TERM_LABELS_KO[id]);
      continue;
    }
    keptChunks.push(chunk);
    currentLength = projected;
  }

  const prompt = keptChunks.join(', ');
  return {
    prompt,
    length: prompt.length,
    withinLimit: prompt.length <= limit,
    droppedTerms
  };
}

export function buildDurationControl(target: GenerationOptions['durationTarget']) {
  if (target === 'under3m30') {
    return 'concise radio edit, very short intro, no long instrumental break, no extended outro, no unnecessary repetition, complete song around 3 minutes 10 seconds, never exceed 3 minutes 35 seconds';
  }
  if (target === 'under4m') {
    return 'short radio edit, short intro, short bridge, no long instrumental break, no extended outro, complete song under 4 minutes';
  }
  return 'playlist-friendly short song, quick intro, compact structure, no long instrumental break, complete song around 2 minutes 50 seconds to 3 minutes 20 seconds';
}

export function resolveMoneyChordText(opts: GenerationOptions) {
  if (opts.moneyChordMode === 'custom' && opts.customMoneyChord.trim()) {
    return `custom chord progression: ${opts.customMoneyChord.trim()}, with a clear emotional chorus lift`;
  }
  const effectiveMode = resolveEarwormMoneyChordMode(opts.moneyChordMode, opts.earwormMode);
  return moneyChordPresets[effectiveMode]?.prompt ?? moneyChordPresets.default.prompt;
}

function shortPromptKeywords(genre: GenrePack): string[] {
  const hasShortPrompt = Boolean(genre.shortPrompt);
  const source = genre.shortPrompt || genre.styleCore;
  const labelKey = genre.label.toLowerCase();
  return source
    .split(/[;,]/)
    .map(atom => atom.trim())
    .filter(Boolean)
    .filter(atom => atom.toLowerCase() !== labelKey)
    .filter(atom => !/\b\d{2,3}\s*-\s*\d{2,3}\s*bpm\b/i.test(atom))
    .filter(atom => !atom.includes(' + '))
    .slice(0, hasShortPrompt ? 3 : 2);
}

function uniqueInstrumentKey(value: string) {
  return value.toLowerCase().replace(/^light\s+/, '').replace(/^soft\s+/, '').replace(/^warm\s+/, '').trim();
}

export function buildGenrePromptSummary(genres: GenrePack[]) {
  const primary = genres[0];
  const secondary = genres.slice(1, 3);
  const genreAtoms = [
    primary?.styleCore,
    ...secondary.flatMap(genre => shortPromptKeywords(genre).slice(0, 3))
  ].filter(Boolean) as string[];

  const instruments: string[] = [];
  const seenInstruments = new Set<string>();
  const candidateInstruments = [
    ...(primary?.instruments.slice(0, 4) || []),
    ...secondary.flatMap(genre => genre.instruments)
  ];
  for (const instrument of candidateInstruments) {
    const key = uniqueInstrumentKey(instrument);
    if (seenInstruments.has(key)) continue;
    seenInstruments.add(key);
    instruments.push(instrument);
    if (instruments.length >= 5) break;
  }

  return {
    genreText: dedupeTerms(genreAtoms).join(', '),
    instruments
  };
}

/**
 * Channel/pack-level prompt fragments, tagged with their TASK A2 priority id
 * so a caller (buildStylePrompt below, or localGenerator's per-song
 * assembly, which adds hook/tempo/songRole/motif/listenerScene/mixNotes on
 * top) can hand the whole set to composeStylePrompt() and get one
 * budgeted, deduped, Suno-safe string back. TASK A4: opts.channel.
 * visualIdentity is deliberately absent — it's typography/art-direction
 * language for the thumbnail spec, not a music-style term, and mixing it
 * into the music prompt both wastes budget and confuses Suno.
 */
export function buildChannelPromptParts(opts: GenerationOptions, genres: GenrePack[], moods: MoodPack[], season: SeasonPack): PromptPart[] {
  const { genreText, instruments } = buildGenrePromptSummary(genres);
  const instrumentText = instruments.join(', ');
  const generationPack = generationPacks.find(pack => pack.id === opts.audience);
  const moodText = [moods.flatMap(m => m.emotionWords).join(', '), generationPack?.audienceNote].filter(Boolean).join(', ');

  // TASK G1 (v3.10) — moneyChord/duration used to carry the full long-form
  // preset text ("money chord foundation: major-key money chord progression
  // with I-V-vi-IV and vi-IV-I-V movement, ...", "concise radio edit, very
  // short intro, no long instrumental break, ..."), which alone was ~35-45
  // words and the main reason non-persona prompts landed at 100+ words even
  // after every non-essential atom was trimmed (see STYLE_WORD_TARGET_MAX).
  // Reusing the same terse builders Persona mode already proved out
  // (compactMoneyChord/compactDuration) converges both modes on the same
  // short-tag style Suno actually responds best to.
  const money = compactMoneyChord(opts);
  // TASK v3.29 — includeMinimumFloor=true only here: this is the main
  // (non-persona) style prompt, which has ~900 chars of budget headroom
  // (SAFE_TARGET) to spare for the "not a short cut" reinforcement. Persona
  // mode's own duration text (soundSignature.ts's buildPersonaStylePrompt/
  // openingDurationText) stays on the default (false) — its ~200-char
  // budget has no room for it.
  const duration = compactDuration(opts.durationTarget, false, true);

  // TASK F4 (v3.7) — avoid/copyright text used to live here as a 'safety'
  // style-prompt atom, but a negative instruction ("avoid drums") inside
  // Suno's Style field is unreliable — Suno's own Advanced Options has a
  // dedicated Exclude field for exactly this. See buildExcludePrompt below;
  // its output is meant for that separate field, never pasted into Style.
  return [
    { id: 'genre', text: genreText },
    { id: 'vocal', text: opts.vocalTone || opts.channel.defaultVocal },
    { id: 'moneyChord', text: money },
    { id: 'duration', text: duration },
    { id: 'mood', text: moodText },
    { id: 'instruments', text: instrumentText },
    { id: 'season', text: `${season.keywords.join(', ')} mood` },
    ...(opts.earwormMode ? [{ id: 'earworm' as const, text: EARWORM_STYLE_ATOMS }] : [])
  ];
}

/**
 * TASK F4 (v3.7) — text for Suno's separate Advanced Options -> Exclude
 * field, never for the Style field itself. Previously this text
 * ("avoid: ...; avoid famous artist imitation, ...") was concatenated
 * straight into the Style prompt, which (a) burned 100+ characters of a
 * 1,000-character budget on every single song, and (b) put a negative
 * instruction in the one field Suno is documented to handle negatives
 * unreliably in.
 */
export function buildExcludePrompt(opts: GenerationOptions): string {
  const atoms = [
    ...(opts.avoidWords.trim() ? splitAtoms(opts.avoidWords) : []),
    'famous artist imitation',
    'copied melodies',
    'copyrighted song references',
    'soundalike vocals'
  ];
  return dedupeTerms(atoms).join(', ');
}

/**
 * Backward-compatible plain-string entry point (channel-level only, no
 * per-song hook/tempo/scene parts — see localGenerator.ts for the full,
 * budget-enforced per-song prompt that actually gets pasted into Suno).
 * Since this is only a partial building block, not the final pasted text,
 * it dedupes (TASK A3) but never budget-drops a term — the 900-char safe
 * target is enforced once, on the complete per-song prompt, not here.
 */
export function buildStylePrompt(opts: GenerationOptions, genres: GenrePack[], moods: MoodPack[], season: SeasonPack): string {
  return composeBudgetedStylePrompt(buildChannelPromptParts(opts, genres, moods, season), SUNO_STYLE_LIMIT, Number.MAX_SAFE_INTEGER).prompt;
}

/**
 * TASK A4 (v3.3): the lyric engine now bookends every chorus with the hook,
 * but Suno itself only honors that structure if the style prompt tells it
 * to. Always in English (Suno parses English style-prompt instructions more
 * reliably), regardless of lyricLanguage — only the hook phrase itself is
 * in the song's own language. 'poetic' depth softens the repeat count so
 * hook repetition doesn't fight a more literary lyric flow.
 *
 * TASK G1 (v3.10) — reuses the same terse compactHook builder Persona mode
 * already proved out ('hook "X" repeats chorus 4x'), replacing the old
 * 4-clause form ('hook "X", short repeated chorus hook, identical melody,
 * 3-4 clear returns') that alone cost ~11 words of every non-persona
 * prompt's word budget.
 */
export function hookStyleDirectives(hookPhrase: string, lyricDepth: GenerationOptions['lyricDepth']): string {
  return compactHook(hookPhrase, lyricDepth, false);
}

/**
 * TASK E1 (v3.5): the batch note (track offset, total count) is the only
 * part of the system instruction that changes from one batch call to the
 * next within a single generation run. Keeping it out of buildSystemInstruction's
 * cacheable text (see buildStableSystemText) is what lets Anthropic's prompt
 * cache actually hit on batch 2+ — a single interpolated string that changes
 * every call can never be a stable cache prefix.
 */
export function buildBatchSystemNote(opts: GenerationOptions, batch: BatchContext, generateThumbnailText = false): string {
  const hasOpeningRoleSlot = batch.preassignedSongs?.some(slot => slot.songRole === 'cold-open' || slot.songRole === 'flagship');
  // TASK I1 (v3.11) — the preassigned songRole string alone ('cold-open',
  // 'flagship') doesn't tell a remote model what those roles mean; this is
  // the same "no instrumental intro" / "representative, not heavy" guidance
  // the local generator already bakes into its own style-prompt duration
  // atom and songRole distribution (see core/localGenerator.ts).
  const openingRoleNote = hasOpeningRoleSlot
    ? `\n- A song whose preassigned songRole is "cold-open": open with the hook itself, no instrumental intro — lyrics and stylePrompt should reflect "hook heard immediately". A song whose songRole is "flagship": keep it representative and catchy but only light-to-medium emotional weight, never as heavy as a late-pack emotional peak.`
    : '';
  // TASK v3.23 — branch, don't delete: generateThumbnailText (default off —
  // the user makes thumbnails externally) toggles whether thumbnailText is
  // still one of the fields the model writes freely around the fixed
  // preassigned ones, so it can be switched back on later without
  // reintroducing this whole note from scratch.
  const preassignedFreeFields = generateThumbnailText
    ? 'lyrics, stylePrompt, seasonMoment, listenerSituation, thumbnailText, youtube'
    : 'lyrics, stylePrompt, seasonMoment, listenerSituation, youtube';
  // TASK v3.27/v3.28 (Part A) — 'ai-creative' (default) is the fix for
  // titles reading as structurally uniform across a pack: they were never
  // actually written by the model, just copied verbatim from
  // core/lyricEngine.ts's titleFromHook (hook phrase as-is, or "<time word>
  // <hook>" — a narrow, mechanical derivation). v3.28 removed the "title
  // must equal/contain the hook" constraint entirely for this mode (real
  // measurement: 12 titles all identical to their hooks even with v3.27's
  // shape rotation, because that constraint left almost no room to actually
  // diverge) — the hookPhrase itself still repeats verbatim in the lyrics/
  // chorus per the Hook rules above, but the title is now a fully
  // independent creative choice. hookPhrase/songRole/emotionArc/trackNo
  // still stay locked either way (title-only collision risk is handled
  // after the fact — see core/lyricEngine.ts's dedupeTitlesAcrossPack —
  // since parallel batches/chunks still can't see each other's real title
  // pick).
  const titleMode = opts.titleMode ?? 'ai-creative';
  const preassignedTitleNote = titleMode === 'local'
    ? `Do NOT invent a different title, hookPhrase, trackNo, or emotionArc — copy these fields verbatim into your output for the matching trackNo, and only write the remaining content (${preassignedFreeFields}) around them.`
    : `Do NOT invent a different hookPhrase, trackNo, or emotionArc — copy those verbatim. The "title" field there is only a fallback placeholder: write your OWN original title for each song instead, independent of the hookPhrase (see the Hook rules above — the title no longer needs to equal or contain the hook). Write real Billboard Hot 100-style titles: single striking words, unexpected concrete nouns, short metaphors, or evocative images — never a restatement of the hook, and never the same shape for every song in the pack. Keep the channel's tone (e.g. nostalgic, elegant) while varying the structure freely. Also write the remaining content (${preassignedFreeFields}) around these fields.`;
  const preassignedNote = batch.preassignedSongs?.length
    ? `\n- "preassignedSongs" in the user payload is a fixed, already-decided list of {trackNo, title, hookPhrase, songRole, tempo, emotionArc} for every song in this request. ${preassignedTitleNote} This is what keeps parallel batches from colliding on hook/identity.${openingRoleNote}`
    : '';
  return `\n\nBatch mode:\n- This request only covers tracks ${batch.trackNoOffset + 1} to ${batch.trackNoOffset + opts.songCount} out of ${batch.totalSongCount} total songs in the pack.\n- Number "trackNo" starting at ${batch.trackNoOffset + 1}, not 1.\n- Never reuse any title or hook phrase already listed in "alreadyUsedTitles" / "alreadyUsedHooks" in the user payload.\n- If "lockedIdentity" is present in the user payload, reuse its sonicSignature, vocalSignature, lyricRules, harmonyRules, and visualRules verbatim so the whole pack stays consistent across batches.${preassignedNote}`;
}

/**
 * v3.15 — earwormMode's remote-provider counterpart to the local hook
 * contest's familiarity weighting (see core/openingContest.ts). Describes
 * generic, decades-old songwriting techniques only (short repeatable hooks,
 * common progressions, stepwise melody) — never a specific song or artist,
 * same boundary as EARWORM_STYLE_ATOMS and the money-chord nudge.
 */
const EARWORM_SYSTEM_NOTE = '\n\nEarworm mode is on for this request:\n- Prefer a hook phrase that is short, easy to hum on first listen, and repeats its own rhythmic shape.\n- Prefer the most common, widely-shared pop chord progression available (e.g. I-V-vi-IV or the canon progression) over a more distinctive one.\n- In "stylePrompt", include generic technique language such as "simple stepwise melody" and "singalong-friendly hook" where it fits within the character budget.\n- This only raises the odds of a familiar-feeling result; it is not a guarantee, and it never means referencing or imitating any specific existing song or artist.';

/**
 * TASK v3.21 — totalSongCountOverride decouples "how many songs does the
 * cacheable stable text say this pack has" from "does this call also append
 * the volatile batch note". Without it, the stable text embedded
 * opts.songCount directly — which is the *per-chunk* count at every real
 * Anthropic call site (see providers/anthropic.ts's generateWithAnthropic),
 * not the pack total. That was invisible while real-time chunks were
 * uniform (e.g. 6 or 12 songs each), but v3.21's small (1-3 song) chunks
 * make a differently-sized tail chunk routine (e.g. 7 songs -> 3+3+1),
 * silently changing "Generate exactly N songs" text between chunks and
 * breaking the cache_control:ephemeral prefix match on every size change —
 * a correctness-invisible, cost-only bug (paying the ~1.25x cache-write
 * price repeatedly instead of the ~0.1x cache-read price from chunk 2 on).
 * providers/anthropic.ts's cacheable-block call site passes this explicitly
 * (batch.totalSongCount) while passing no `batch`, so the stable text stays
 * byte-identical across every chunk of the same pack without also inlining
 * the (correctly volatile) batch note a second time.
 */
export function buildSystemInstruction(opts: GenerationOptions, batch?: BatchContext, totalSongCountOverride?: number, generateThumbnailText = false) {
  const batchNote = batch ? buildBatchSystemNote(opts, batch, generateThumbnailText) : '';
  const earwormNote = opts.earwormMode ? EARWORM_SYSTEM_NOTE : '';
  const totalSongCount = totalSongCountOverride ?? batch?.totalSongCount ?? opts.songCount;

  const minHookRepeats = opts.lyricDepth === 'poetic' ? 3 : 4;
  // TASK v3.23 — branch, don't delete: default off (user makes thumbnails
  // externally) drops the ask and the schema field; on restores both.
  const youtubeMetadataLine = generateThumbnailText
    ? '- Include YouTube title, description, tags, and thumbnail text for every song.'
    : '- Include YouTube title, description, and tags for every song.';
  // TASK v3.28 — real measurement showed 'ai-creative' titles still all
  // matched their hooks verbatim, because this rule left the model no real
  // room to diverge even with v3.27's shape-rotation guidance. 'local' keeps
  // the old rule (irrelevant either way — reconcileWithPreassignedSlot
  // discards the model's own title in that mode), 'ai-creative' drops the
  // hook-binding constraint entirely: the hookPhrase still repeats verbatim
  // in the lyrics/chorus per the rule below, but the title is now free.
  const titleModeForHookRule = opts.titleMode ?? 'ai-creative';
  const titleHookRuleLine = titleModeForHookRule === 'local'
    ? '- The song\'s title must equal the hook phrase, or contain it verbatim (never a different phrase from the hook).'
    : '- The song\'s title is INDEPENDENT from the hookPhrase — do not just reuse or lightly reword the hook as the title. Write a genuinely different, evocative title the way real Billboard Hot 100 song titles work: a single striking word, an unexpected concrete noun, a short metaphor, or an image, not a restatement of the hook.';

  return `You are Suno Weaver Studio, a commercial playlist song planner. Generate original Suno-ready style prompts, lyrics, and YouTube metadata.

Rules:
- Never imitate a specific artist, singer, band, producer, existing song, melody, lyric, hook, or copyrighted work.
- Do not use "in the style of", "sounds like", "as sung by", or similar imitation language.
- Money chords are mandatory, but the output must still feel original.
- This playlist pack has ${totalSongCount} songs total, generated as one coherent set — a single request may cover only part of the pack at a time (see the batch note below for this request's exact scope, if present).
- Keep a stable sonic/vocal identity across all tracks while varying situations, hooks, titles, and lyrical images.
- Sequence the songs naturally: opener, early lift, middle depth, late-set highlight, warm closer.
- Lyrics must use Suno section tags and must be ready to paste separately from the style prompt.
- Each song's "lyrics" must total ${MIN_LYRIC_WORDS}-${MAX_LYRIC_WORDS} words (not counting section tags like [chorus]) — this is what actually determines Suno's rendered length; a short ~100-150 word lyric renders as a short ~2:00-2:20 song regardless of any target duration. Target render length for this pack: ${compactDuration(opts.durationTarget, true)}.
${youtubeMetadataLine}
- Return valid JSON only, matching the requested PlaylistBlueprint shape.
- CRITICAL: Return ONLY the JSON object. No markdown, no code fences (no \`\`\`), no prose, no explanation, and no closing remarks before or after it. The response must start with { and end with } — nothing else outside those two characters.
- CRITICAL: Every string value must itself be valid JSON. Encode every line break inside "lyrics" (or any other field) as the two characters \\n, never a literal newline — a raw newline inside a JSON string makes the whole response unparseable. Escape any literal double-quote character inside a string as \\".
- CRITICAL: "stylePrompt" is pasted directly into Suno's style field, which truncates past ${SUNO_STYLE_LIMIT} characters. Keep every stylePrompt at or under ${SAFE_TARGET} characters — pack it with genre, vocal, hook-repeat instruction, money chord, duration, and tempo first, and only add mood/instrument/season detail if there is room left. Never let it run long; a shorter, focused prompt beats a longer one that gets cut off mid-sentence.
- Do not include typography, logo, or thumbnail art-direction language (e.g. font style) in "stylePrompt" — that belongs only in visual/thumbnail fields, never in the music style prompt.

Hook rules (each song's hookPhrase):
- The hook must be a short, singable phrase of 2-5 words, in Title Case, never starting with a lowercase letter.
${titleHookRuleLine}
- The hook line must open and close every chorus section (bookend), repeating at least ${minHookRepeats} times across the whole song.
- Never address an inanimate object as if it were a person (e.g. "Hold on, coffee" or "Close your eyes, doorway") — vocative phrasing may only address a person or an abstract/personified noun (a friend, a season, "my love"), never a physical object.

Safety rules:
${safeLyricRules.map(rule => `- ${rule}`).join('\n')}${earwormNote}${batchNote}`;
}

/**
 * TASK v3.23 — shared by buildUserInstruction (OpenAI) and
 * buildChannelSystemBlock (Anthropic's cacheable block), which otherwise
 * duplicate this exact array/schema. Keeping one shared source instead of
 * two hand-copies is what stops them drifting out of sync — see TASK
 * v3.21's comment on buildSystemInstruction for the caching bug that exact
 * kind of drift caused once before (a schema value that silently varied
 * between what should have been byte-identical cached blocks).
 */
function batchPlanningBullets(generateThumbnailText: boolean): string[] {
  return [
    'Use one recurring visual motif across the pack, but do not repeat the same lyric line.',
    'Track 1 should introduce the playlist identity clearly.',
    'Tracks 2-5 should establish variety without breaking the channel promise.',
    'Middle tracks should add emotional depth and different listener situations.',
    'Final tracks should resolve warmly and feel like a natural closer.',
    generateThumbnailText
      ? 'Avoid repeating the same opening image, chorus first line, or thumbnail phrase.'
      : 'Avoid repeating the same opening image or chorus first line.',
    'Never repeat any title or hook phrase from alreadyUsedTitles / alreadyUsedHooks.'
  ];
}

/** TASK v3.23 — see batchPlanningBullets' comment; the per-song output schema shared by both outputShape blocks. Exported for TASK v3.24's claudeCodeBridge.ts, which reuses this same schema for its own (narrower, songs-only) outputShape instead of re-authoring a third copy. */
export function songOutputShape(generateThumbnailText: boolean) {
  return {
    trackNo: 1,
    title: 'string',
    seasonMoment: 'string',
    listenerSituation: 'string',
    emotionArc: 'string',
    hookPhrase: 'string',
    stylePrompt: 'string',
    lyrics: 'string with [intro], [verse 1], [chorus], [verse 2], [short bridge], [final chorus], [end]',
    ...(generateThumbnailText ? { thumbnailText: 'string' } : {}),
    youtube: {
      title: 'string',
      description: 'string',
      tags: ['string'],
      ...(generateThumbnailText ? { thumbnailText: 'string' } : {})
    },
    youtubeTitleKo: 'string optional',
    youtubeTitleJa: 'string optional',
    qualityScore: 0,
    warnings: []
  };
}

export function buildUserInstruction(opts: GenerationOptions, genres: GenrePack[], moods: MoodPack[], season: SeasonPack, batch?: BatchContext, generateThumbnailText = false) {
  const generationPack = generationPacks.find(pack => pack.id === opts.audience);

  return {
    channel: opts.channel,
    projectTitle: opts.projectTitle,
    songCount: opts.songCount,
    lyricLanguage: opts.lyricLanguage,
    market: opts.market,
    audience: opts.audience,
    generationPack,
    genrePacks: genres,
    moodPacks: moods,
    season,
    vocalTone: opts.vocalTone || opts.channel.defaultVocal,
    perspective: opts.perspective,
    lyricDepth: opts.lyricDepth,
    moneyChordMode: opts.moneyChordMode,
    customMoneyChord: opts.moneyChordMode === 'custom' ? opts.customMoneyChord : undefined,
    customConcept: opts.customConcept,
    avoidWords: opts.avoidWords,
    earwormMode: opts.earwormMode ?? false,
    trackNoOffset: batch?.trackNoOffset ?? 0,
    totalSongCount: batch?.totalSongCount ?? opts.songCount,
    alreadyUsedTitles: batch?.usedTitles ?? [],
    alreadyUsedHooks: batch?.usedHooks ?? [],
    lockedIdentity: batch?.lockedIdentity ?? null,
    batchPlanning: batchPlanningBullets(generateThumbnailText),
    outputShape: {
      projectTitle: 'string',
      channelName: 'string',
      oneLineConcept: 'string',
      sonicSignature: 'string',
      vocalSignature: 'string',
      lyricRules: ['string'],
      harmonyRules: ['string'],
      visualRules: ['string'],
      songs: [songOutputShape(generateThumbnailText)]
    }
  };
}

/**
 * TASK E1 (v3.5) — everything from buildUserInstruction() that stays
 * byte-identical across every batch of one generation run (channel profile,
 * genre/mood/season packs, the output JSON schema, the static planning
 * bullets). Sent once as a second cache_control block in Anthropic's
 * `system` array (see providers/anthropic.ts) instead of being re-sent
 * inside every batch's user message — that's most of the token bulk in a
 * typical request, and it never changes within a run.
 */
export function buildChannelSystemBlock(opts: GenerationOptions, genres: GenrePack[], moods: MoodPack[], season: SeasonPack, generateThumbnailText = false): string {
  const generationPack = generationPacks.find(pack => pack.id === opts.audience);
  const block = {
    channel: opts.channel,
    generationPack,
    genrePacks: genres,
    moodPacks: moods,
    season,
    batchPlanning: batchPlanningBullets(generateThumbnailText),
    outputShape: {
      projectTitle: 'string',
      channelName: 'string',
      oneLineConcept: 'string',
      sonicSignature: 'string',
      vocalSignature: 'string',
      lyricRules: ['string'],
      harmonyRules: ['string'],
      visualRules: ['string'],
      songs: [songOutputShape(generateThumbnailText)]
    }
  };
  return `Channel profile and output schema for this generation run (stable across every batch):\n${JSON.stringify(block, null, 2)}`;
}

/**
 * TASK E1 (v3.5) — the lean, per-batch-varying half of the user payload:
 * everything buildChannelSystemBlock() doesn't already cover. Crucially,
 * alreadyUsedTitles/alreadyUsedHooks (which grow every batch) live here,
 * never in a cached block — caching a growing list would either invalidate
 * the cache every batch or, worse, silently cache a stale (too-short) list.
 */
export function buildAnthropicUserPayload(opts: GenerationOptions, batch?: BatchContext) {
  return {
    projectTitle: opts.projectTitle,
    songCount: opts.songCount,
    lyricLanguage: opts.lyricLanguage,
    market: opts.market,
    audience: opts.audience,
    vocalTone: opts.vocalTone || opts.channel.defaultVocal,
    perspective: opts.perspective,
    lyricDepth: opts.lyricDepth,
    moneyChordMode: opts.moneyChordMode,
    customMoneyChord: opts.moneyChordMode === 'custom' ? opts.customMoneyChord : undefined,
    customConcept: opts.customConcept,
    avoidWords: opts.avoidWords,
    earwormMode: opts.earwormMode ?? false,
    trackNoOffset: batch?.trackNoOffset ?? 0,
    totalSongCount: batch?.totalSongCount ?? opts.songCount,
    alreadyUsedTitles: batch?.usedTitles ?? [],
    alreadyUsedHooks: batch?.usedHooks ?? [],
    lockedIdentity: batch?.lockedIdentity ?? null,
    preassignedSongs: batch?.preassignedSongs ?? []
  };
}
