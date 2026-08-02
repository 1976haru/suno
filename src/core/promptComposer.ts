/**
 * v3.66 (TASK B) — this module is the local-preview path only.
 * The real production path (Claude Code bridge, claudeCodeBridge.ts) sends
 * plan/constraint data to a remote LLM, which writes the stylePrompt itself
 * and never calls anything in this file. This module exists so the app can
 * produce a full pack with no API call for preview purposes; do not treat
 * changes here as touching the pipeline users actually run in production.
 * See docs/v366-report.md for the full pipeline-role writeup.
 */
import type { BatchContext, GenerationOptions, GenrePack, MoodPack, SeasonPack } from '../types';
import { generationPacks } from '../data/presets';
import { moneyChordPresets, resolveEarwormMoneyChordMode } from '../data/moneyChords';
import { safeLyricRules } from '../data/lyrics';
import { composeStylePrompt as composeBudgetedStylePrompt } from './promptBudget';
import { compactDuration, compactHook, compactMoneyChord } from './soundSignature';
import { shuffle, STRUCTURE_TEMPLATE_SECTION_NOTES, type StructureTemplateId } from './lyricEngine';
import { resolveNegativeStyleText, mergeNegativeStyleText } from '../data/negativeStyles';
import { stripBpmText } from './bpmDedupe';
import { eraLyricGuidanceForArchetype } from '../data/japaneseEraGuidance';
import { buildReferenceMoodStyleClause } from './referenceMood';
import { audienceProfileForAgeGroup } from '../data/audienceProfiles';
import { resolveLyricRange } from './lyricMetrics';

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
 * far more directly than any duration-target label.
 *
 * TASK v3.70 (TASK B) — the 200-260 range this task originally set overshot:
 * real listening measured 3:42-4:10 songs (216-234 words, 8-11 sections)
 * against a 3:10-3:35 target. Lowered to 175-205 — combined with the
 * section-count cut in lyricEngine.ts's composeLyrics (dropping the useless
 * trailing [end] tag, a duplicated pre-chorus, and an "outro" this app's
 * lyrics engine never actually had a tag for), this is the fix real Suno
 * playback must confirm (see docs/v370-report.md §5 — text metrics alone are
 * not proof of a shorter render).
 *
 * v3.75 (TASK A) — 175-205 overcorrected the other way: a real 18-song pack
 * at 194 words/song (inside that band) rendered at an average 2:34 against
 * the same 3:10-3:35 target, with one track at 1:38. Word count alone isn't
 * the whole story here (a near-identical 191-word pack from before v3.71
 * rendered at 3:39) — v3.71's own template/instruction trims (dropping
 * [end], shortening STRUCTURE_TEMPLATE_SECTION_NOTES) likely removed more
 * effective render time than the word-count band alone can restore, and
 * v3.75's own introModePlan/structureTemplate reconciliation (see
 * core/introModePlan.ts) targets that directly. Raised to 215-230 as the
 * secondary lever per this task's own explicit priority order (instrumental
 * restoration and per-section length guidance first, word count last) —
 * see this file's own section-length instruction line below, added in the
 * same task.
 */
export const MIN_LYRIC_WORDS = 215;
export const MAX_LYRIC_WORDS = 230;

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
  | 'songRole' | 'motif' | 'listenerScene' | 'mixNotes' | 'genreNarrative' | 'genreSignature' | 'hookDevice' | 'introTexture' | 'arrangementDensity';

export const PROMPT_PRIORITY: PromptTermId[] = [
  'vocal', 'genreSignature', 'genreNarrative', 'moneyChord', 'introTexture', 'tempo', 'arrangementDensity', 'instruments', 'hookDevice',
  'earworm', 'genre', 'hook', 'duration', 'mood', 'season', 'songRole', 'motif', 'listenerScene', 'mixNotes', 'safety'
];

export const ESSENTIAL_TERM_IDS = new Set<PromptTermId>(['genre', 'vocal', 'genreSignature', 'hook', 'moneyChord', 'duration', 'introTexture', 'tempo']);

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
  mixNotes: '믹스 노트',
  genreNarrative: 'genre arrangement narrative',
  genreSignature: 'genre signature',
  hookDevice: 'hook device',
  introTexture: 'intro texture',
  arrangementDensity: 'arrangement density'
};

/**
 * v3.15 — earwormMode style-prompt atom (PART B of the brief): purely generic
 * composing-technique language — describes a technique, never a specific
 * song or artist. Kept out of ESSENTIAL_TERM_IDS since this is a preference
 * nudge, not a requirement — it's fine for composeStylePrompt to drop it
 * under budget pressure like any other non-essential atom.
 *
 * TASK v3.64-B — real measurement: a real 18-song pack carried the exact
 * same single fixed string ("simple stepwise melody, easy to hum,
 * singalong-friendly pop hook, predictable diatonic phrase structure") in
 * 18/18 songs (21% of the whole stylePrompt). Different instrumentation per
 * genre still read as "the same song" because the melodic-CONSTRUCTION
 * technique itself never varied — a listener remembers melody, not
 * instrumentation. Replaced the single string with this pool of 10
 * different (but equally generic, equally song/artist-free) melodic-design
 * descriptions; rotatingEarwormText below picks one per song so a set uses
 * several different designs instead of one repeated everywhere.
 */
export const EARWORM_STYLE_VARIANTS: string[] = [
  'simple stepwise melody, easy to hum',
  'narrow melodic range, repeated rhythmic figure',
  'symmetric four-bar phrases, predictable cadence',
  'call-and-response hook shape',
  'rising melodic sequence into the chorus',
  'two-note pickup leading every phrase',
  'hook built on the top three scale degrees',
  'descending resolution on the final hook line',
  'paired antecedent-consequent phrasing',
  "sustained note landing the hook's first word"
];

/**
 * TASK v3.64-B — same offset+modulo rotation pattern as
 * arrangementDensityLevel above: `index` cycles through the whole variant
 * pool so a set of up to ~20-40 songs never repeats one design more than a
 * handful of times, and `seed` only shifts which variant a given pack starts
 * on (so two different packs don't all open on variant 0).
 */
export function rotatingEarwormText(seed: number, index: number): string {
  const offset = Math.abs(seed) % EARWORM_STYLE_VARIANTS.length;
  return EARWORM_STYLE_VARIANTS[(index + offset) % EARWORM_STYLE_VARIANTS.length];
}

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
    .map(atom => stripBpmText(atom).trim())
    .filter(Boolean)
    .filter(atom => atom.toLowerCase() !== labelKey)
    .filter(atom => !atom.includes(' + '))
    .slice(0, hasShortPrompt ? 3 : 2);
}

function uniqueInstrumentKey(value: string) {
  return value.toLowerCase().replace(/^light\s+/, '').replace(/^soft\s+/, '').replace(/^warm\s+/, '').trim();
}

export function arrangementNarrativeForGenres(genres: GenrePack[]): string | undefined {
  const narrative = genres[0]?.arrangementNarrative;
  return narrative ? stripBpmText(narrative) : undefined;
}

/** v3.52: preserve the genre's production vocabulary while rotating which
 * section/mix clauses lead each track, so a pack does not repeat one long
 * arrangement sentence verbatim on every song. */
export function rotatingArrangementNarrativeForGenres(genres: GenrePack[], index: number): string | undefined {
  const narrative = arrangementNarrativeForGenres(genres);
  if (!narrative) return undefined;
  const atoms = narrative.split(',').map(atom => atom.trim()).filter(Boolean);
  if (atoms.length <= 3) return narrative;
  const count = Math.min(5, atoms.length);
  const requiredIndexes = [
    atoms.findIndex(atom => /pre-chorus/i.test(atom)),
    atoms.findIndex(atom => /hook entry|downbeat|dropout|one-beat pause|rising sweep|drum pickup|walk-up|stop-and-go/i.test(atom)),
    atoms.findIndex(atom => /chorus/i.test(atom))
  ].filter(index => index >= 0);
  const selectedIndexes = new Set<number>(requiredIndexes);
  for (let offset = 0; selectedIndexes.size < count && offset < atoms.length; offset++) {
    selectedIndexes.add((Math.abs(index) * 2 + offset * 2) % atoms.length);
  }
  for (let offset = 0; selectedIndexes.size < count && offset < atoms.length; offset++) {
    selectedIndexes.add((Math.abs(index) + offset) % atoms.length);
  }
  const selected = Array.from(selectedIndexes).sort((a, b) => a - b).map(atomIndex => atoms[atomIndex]);
  return selected.join(', ');
}

export function hasArrangementNarrativeGenre(genres: GenrePack[]): boolean {
  return Boolean(arrangementNarrativeForGenres(genres));
}

export function buildGenrePromptSummary(genres: GenrePack[]) {
  const primary = genres[0];
  const secondary = genres.slice(1, 3);
  const genreNarrative = arrangementNarrativeForGenres(genres);
  const genreSignature = primary?.signatureSound || secondary.find(genre => genre.signatureSound)?.signatureSound;
  const genreAtoms = [
    primary ? stripBpmText(primary.styleCore) : undefined,
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
    genreNarrative,
    genreSignature,
    instruments
  };
}

/**
 * TASK v3.42 Part A1 — real measurement: 3 selected genre packs offered 9
 * unique instruments between them, but every song in a 15-song pack used
 * only the same first 2 (an anchor instrument plus whatever the word-budget
 * trim left standing, always in the same list order — see
 * promptBudget.ts's INSTRUMENTS_FLOOR_ATOMS). This rotates per song instead:
 * the first instrument (the channel's identity anchor, e.g. showa-cafe's
 * Rhodes) is always kept, and 1-2 more are seed-shuffled per trackNo from
 * the rest of buildGenrePromptSummary's pool — so different songs in the
 * same pack land on different combinations while the anchor still holds the
 * channel's sonic identity together.
 */
/**
 * TASK v3.43 Step 2 (Part A3) — the array form of rotatingInstrumentText's
 * anchor+rotate selection, extracted so a caller that needs the individual
 * instrument names (core/batchPreallocation.ts's PreassignedSongSlot.
 * instrumentSet, for per-name verbatim weave/repair) doesn't have to
 * re-split a comma-joined string back apart. rotatingInstrumentText itself
 * is unchanged (still the comma-joined string the local per-song prompt
 * assembly uses directly).
 */
export function rotatingInstrumentSet(genres: GenrePack[], seed: number, index: number): string[] {
  const { instruments } = buildGenrePromptSummary(genres);
  if (instruments.length <= 1) return instruments;
  const [anchor, ...rest] = instruments;
  const shuffled = shuffle(rest, seed + index * 151);
  const extraCount = rest.length >= 2 ? 1 + (index % 2) : Math.min(1, rest.length);
  return [anchor, ...shuffled.slice(0, extraCount)];
}

export function rotatingInstrumentText(genres: GenrePack[], seed: number, index: number): string {
  return rotatingInstrumentSet(genres, seed, index).join(', ');
}

/**
 * TASK v3.42 Part D follow-up — real measurement found genre atoms alone
 * accounted for 7 of the 15 clauses still common to every song after Parts
 * A-C's fixes (the 3 selected genre packs' styleCore/keyword text, always
 * concatenated identically every song since genre selection is a whole-pack
 * setting). Same anchor+rotate principle as rotatingInstrumentText: the
 * primary genre's first atom is the channel's core identity and always
 * stays first, but which of the remaining atoms (secondary-genre keywords,
 * and the rest of the primary genre's own styleCore) appear rotates per
 * song.
 */
export function rotatingGenreText(genres: GenrePack[], seed: number, index: number): string {
  const { genreText } = buildGenrePromptSummary(genres);
  const atoms = genreText.split(',').map(atom => atom.trim()).filter(Boolean);
  if (atoms.length <= 2) return genreText;
  const [anchor, ...rest] = atoms;
  const shuffled = shuffle(rest, seed + index * 337);
  const extraCount = Math.min(rest.length, 2 + (index % 2));
  const signature = genres[0]?.signatureSound;
  const signatureAtoms = signature ? signature.split(',').map(atom => atom.trim()).filter(Boolean).slice(0, 2) : [];
  const remainingCount = Math.max(0, extraCount - signatureAtoms.length);
  return [anchor, ...signatureAtoms, ...shuffled.slice(0, remainingCount)].join(', ');
}

/**
 * TASK v3.56 Part 2 — genreSignature was always attached verbatim (see
 * localGenerator.ts), so any song whose per-track PROMPT_PRIORITY rotation
 * (conceptDiversity.ts's promptPriorityForTrack) put genreSignature first in
 * the style prompt opened on the exact same literal clause every time (the
 * primary genre never changes within a pack, and its signatureSound text is
 * static) — a real measured cause of low opening-clause diversity across an
 * 18-song set. Same anchor+rotate principle as rotatingInstrumentText/
 * rotatingGenreText: the first atom (the genre's core identity, e.g. jazz-pop's
 * "light swing feel") stays the anchor so the essential identity is never
 * lost, but which of the remaining atoms lead varies per song, so a
 * genreSignature-first opening reads differently track to track instead of
 * repeating byte-for-byte.
 */
export function rotatingGenreSignatureText(genres: GenrePack[], seed: number, index: number): string {
  const signature = genres[0]?.signatureSound;
  if (!signature) return '';
  const atoms = signature.split(',').map(atom => atom.trim()).filter(Boolean);
  if (atoms.length <= 2) return signature;
  const [anchor, ...rest] = atoms;
  const shuffled = shuffle(rest, seed + index * 211);
  const extraCount = Math.min(rest.length, 2 + (index % 3));
  return [anchor, ...shuffled.slice(0, extraCount)].join(', ');
}

/**
 * TASK v3.42 Part A3 — rotates a song's arrangement weight through 3 levels
 * so the same genre doesn't render at identical density every time. Plain
 * index-modulo rotation (not shuffled) so the 3 levels visit every song
 * position roughly evenly across a pack; `seed` only offsets which level a
 * given pack starts on, so two different packs/sets don't all open sparse.
 */
export type ArrangementDensityLevel = 'sparse' | 'medium' | 'full';

const ARRANGEMENT_DENSITY_LEVELS: ArrangementDensityLevel[] = ['sparse', 'medium', 'full'];

/**
 * TASK v3.43 Step 2 (Part A3) — the descriptive stylePrompt phrase for each
 * level, keyed by name rather than array position so a caller (the batch/
 * bridge instruction legend, or core/batchPreallocation.ts's import repair)
 * can look one up from the bare 'sparse'|'medium'|'full' tag a
 * PreassignedSongSlot.arrangementDensity carries, without needing to know
 * this array's internal ordering.
 */
export const ARRANGEMENT_DENSITY_TEXT_BY_LEVEL: Record<ArrangementDensityLevel, string> = {
  sparse: 'spare arrangement, voice and one or two instruments, lots of space',
  medium: 'balanced small-combo arrangement',
  full: 'fuller arrangement with strings pad and layered backing'
};

/**
 * TASK v3.43 Step 2 (Part A3) — extracted so a caller that needs the bare
 * level tag (PreassignedSongSlot.arrangementDensity) doesn't have to
 * reverse-look-up arrangementDensityText's output. Same index math as
 * before (unchanged), so arrangementDensityText's own output is unaffected.
 */
export function arrangementDensityLevel(seed: number, index: number): ArrangementDensityLevel {
  const offset = Math.abs(seed) % ARRANGEMENT_DENSITY_LEVELS.length;
  return ARRANGEMENT_DENSITY_LEVELS[(index + offset) % ARRANGEMENT_DENSITY_LEVELS.length];
}

export function arrangementDensityText(seed: number, index: number): string {
  return ARRANGEMENT_DENSITY_TEXT_BY_LEVEL[arrangementDensityLevel(seed, index)];
}

/**
 * TASK v3.43 Step 2 (Part A3) — one-time legend mapping each structure-
 * template id to its section-order description (see core/lyricEngine.ts's
 * STRUCTURE_TEMPLATE_SECTION_NOTES), sent once in the batch/bridge
 * instructions rather than repeating the full description on every
 * "preassignedSongs" entry — each entry only carries the compact id
 * (PreassignedSongSlot.structureTemplate), the same discrete-id-plus-shared-
 * lookup-table pattern data/hookDevices.ts's getHookDeviceById already uses.
 */
export function structureTemplateLegend(): string {
  return (Object.keys(STRUCTURE_TEMPLATE_SECTION_NOTES) as StructureTemplateId[])
    .map(id => `${id}: ${STRUCTURE_TEMPLATE_SECTION_NOTES[id]}`)
    .join('; ');
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
  const { genreText, genreNarrative, genreSignature, instruments } = buildGenrePromptSummary(genres);
  const instrumentText = instruments.join(', ');
  const generationPack = generationPacks.find(pack => pack.id === opts.audience);
  const referenceMoodClause = buildReferenceMoodStyleClause(opts.referenceMood);
  // TASK v3.58 (TASK 4) — audience-level constraints (vocal register,
  // diction clarity, mix character; see types.ts's AudienceProfile) used to
  // be appended here, but 'mood' is non-essential and low-priority enough
  // that real measurement found them surviving in as few as 6/18 songs
  // under normal budget pressure. They're now woven into the per-song
  // 'vocal' atom instead (core/localGenerator.ts, essential/never dropped)
  // — see that call site's own comment.
  const moodText = [moods.flatMap(m => m.emotionWords).join(', '), generationPack?.audienceNote, referenceMoodClause].filter(Boolean).join(', ');

  // TASK G1 (v3.10) — moneyChord/duration used to carry the full long-form
  // preset text ("money chord foundation: major-key money chord progression
  // with I-V-vi-IV and vi-IV-I-V movement, ...", "concise radio edit, very
  // short intro, no long instrumental break, ..."), which alone was ~35-45
  // words and the main reason non-persona prompts landed at 100+ words even
  // after every non-essential atom was trimmed (see STYLE_WORD_TARGET_MAX).
  // Reusing the same terse builders Persona mode already proved out
  // (compactMoneyChord/compactDuration) converges both modes on the same
  // short-tag style Suno actually responds best to.
  // TASK v3.33 Part C — includeFeelReinforcement:true always here: real
  // listening feedback found the bare progression name alone ("I-V-vi-IV
  // progression") reads as vague to Suno. See soundSignature.ts's
  // compactMoneyChord for why this stays essential (never trimmed)
  // automatically. When a per-song progression quota is
  // active (senior-morning/showa-cafe, see core/moneyChordPlan.ts), this
  // atom is overridden per-song in localGenerator.ts's own loop — this call
  // only ever supplies the flat, whole-pack fallback.
  const money = compactMoneyChord(opts, { includeFeelReinforcement: true });
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
    { id: 'genreSignature', text: genreSignature },
    { id: 'vocal', text: opts.vocalTone || opts.channel.defaultVocal },
    { id: 'genreNarrative', text: genreNarrative },
    { id: 'moneyChord', text: money },
    { id: 'duration', text: duration },
    { id: 'mood', text: moodText },
    { id: 'instruments', text: instrumentText },
    { id: 'season', text: `${season.keywords.join(', ')} mood` }
    // TASK v3.64-B — earworm's atom moved out of this whole-pack part list:
    // it's now a per-song rotation (rotatingEarwormText), added directly in
    // each caller's per-song loop instead of here, since this function has
    // no per-song index to rotate on.
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
export function buildExcludePrompt(
  opts: Pick<GenerationOptions, 'avoidWords' | 'channel' | 'negativeStyle'>,
  genres: GenrePack[] = [],
  /**
   * v3.67 (TASK B) — this track's own killing point may relax specific
   * audience-profile exclusions (see data/killingPoints.ts's
   * KillingPoint.relaxes / data/audienceProfiles.ts's relaxableAtPeak).
   * Only entries that are actually in relaxableAtPeak are ever dropped —
   * anything in hardExclusions (or simply not in relaxableAtPeak) always
   * stays in the exclude text regardless of what this list contains.
   * Undefined/empty behaves exactly as before this task.
   */
  relaxedExclusions: readonly string[] = []
): string {
  const audienceProfile = audienceProfileForAgeGroup(opts.channel.audience);
  const relaxable = new Set(audienceProfile.relaxableAtPeak);
  const relaxedNow = new Set(relaxedExclusions.filter(item => relaxable.has(item)));
  const exclusionsForThisSong = audienceProfile.exclusions.filter(item => !relaxedNow.has(item));
  return mergeNegativeStyleText(
    opts.avoidWords,
    resolveNegativeStyleText(opts, genres),
    'famous artist imitation, copied melodies, copyrighted song references, soundalike vocals',
    // TASK v3.58 (TASK 4) — audience-level exclusions apply regardless of
    // genre (see types.ts's AudienceProfile) — e.g. a senior channel never
    // wants "shouted or belted high notes" whether the song is jazz-pop or
    // acoustic-pop this track.
    exclusionsForThisSong.join(', ')
  );
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
  // independent creative choice. songRole/trackNo always stay locked;
  // emotionArc always stays locked too (metadata-only, no reason for the
  // model to invent it). title-only collision risk is handled after the
  // fact — see core/lyricEngine.ts's dedupeTitlesAcrossPack — since parallel
  // batches/chunks still can't see each other's real title pick.
  const titleMode = opts.titleMode ?? 'ai-creative';
  const titleInstruction = titleMode === 'local'
    ? 'Do NOT invent a different title — copy it verbatim into your output for the matching trackNo.'
    : 'The "title" field there is only a fallback placeholder: write your OWN original title for each song instead, independent of the hookPhrase (see the Hook rules above — the title no longer needs to equal or contain the hook). Write real Billboard Hot 100-style titles: single striking words, unexpected concrete nouns, short metaphors, or evocative images — never a restatement of the hook, and never the same shape for every song in the pack. Keep the channel\'s tone (e.g. nostalgic, elegant) while varying the structure freely.';
  // TASK v3.33 — hookMode's own axis, independent of titleMode (see
  // GenerationOptions.hookMode's comment for why: a hook pool of ~400
  // combinatorial phrases per channel can't sustain 90+ songs/week, so
  // 'ai-creative' (default) lets the model write its own hook per song
  // instead of copying the pool-drawn slot value verbatim — checked for
  // collisions against the channel's hook ledger afterward
  // (core/hookDedup.ts) rather than pre-decided. 'pool' keeps the old
  // unconditional verbatim-copy behavior.
  const hookMode = opts.hookMode ?? 'ai-creative';
  const hookInstruction = hookMode === 'pool'
    ? 'Do NOT invent a different hookPhrase — copy it verbatim into your output for the matching trackNo.'
    : 'The "hookPhrase" field there is only a fallback suggestion: write your OWN original hook for each song instead — 2-5 words, Title Case, singable (see the Hook rules above) — matching this channel\'s tone. Never reuse a hook already listed in "alreadyUsedHooks" in the user payload. The hook you write must bookend every chorus in the lyrics you write for that song.';
  // TASK v3.33 Part C — moneyChordText is per-trackNo (core/moneyChordPlan.ts
  // may assign a different progression to different tracks within the same
  // pack, pinning cold-open/flagship to the channel's signature — see
  // core/batchPreallocation.ts's preallocateSongSlots), so it must be copied
  // verbatim per song rather than left to the model's own "money chords are
  // mandatory" judgment, which real listening feedback found reads as vague.
  const moneyChordInstruction = 'Each entry also includes "moneyChordText" — weave that exact phrase (progression tag plus its reinforcement/downbeat language) into that song\'s stylePrompt as the money-chord portion, verbatim. Do not substitute a different progression or paraphrase it away.';
  // TASK v3.39 — mirrors moneyChordInstruction's verbatim-weave pattern for
  // the per-song vocal description (see core/vocalPlan.ts/
  // core/batchPreallocation.ts's preallocateSongSlots). TASK v3.39 Part H
  // extended vocalText to every channel, not just the kids per-song quota —
  // a real showa-cafe pack showed a selected male vocal preset silently
  // coming back female with nothing in the instructions telling the model to
  // respect the selection.
  const hasVocalText = batch.preassignedSongs?.some(slot => slot.vocalText);
  const hasVocalVariant = batch.preassignedSongs?.some(slot => slot.vocalVariantText && slot.vocalVariantText !== slot.vocalText);
  const hasConceptText = batch.preassignedSongs?.some(slot => slot.conceptText);
  const conceptInstruction = hasConceptText
    ? ' Each entry also includes "conceptText" and optional "conceptLyricImages" — weave conceptText into the genre/sound description and use conceptLyricImages as concrete lyric imagery. Do not replace the concept with a generic pack description.'
    : '';
  const vocalInstruction = hasVocalText
    ? ' Each entry also includes "vocalText" — weave that exact phrase into that song\'s stylePrompt as the vocal description, verbatim. Do not substitute a different vocal gender or type (e.g. male instead of female, or an adult voice for a kids choir) or paraphrase it away.'
    : '';
  // TASK v3.42 Part B2 — mirrors moneyChordInstruction/vocalInstruction's
  // verbatim-weave pattern. Real measurement found the fixed reinforcement
  // text every song used to get ("hook lands on the downbeat, ...") was
  // byte-identical across all 15 songs in a pack — this per-song device is
  // what replaces it, and needs the same "don't paraphrase it away"
  // enforcement or a model will happily substitute its own generic phrasing.
  const hasHookDeviceText = batch.preassignedSongs?.some(slot => slot.hookDeviceText);
  const hookDeviceInstruction = hasHookDeviceText
    ? ' Each entry also includes "hookDeviceText" — weave that exact phrase into that song\'s stylePrompt as an arrangement/production detail, verbatim. This is a per-song arrangement-contrast device (stop-time, key change, breakdown, etc); do not drop it, substitute a different device, or paraphrase it away, and never reuse the same device text word-for-word across two songs in this request.'
    : '';
  // TASK v3.43 Part A2 — "tempo" was already listed in preassignedFieldList
  // below but never forced or given its own instruction, unlike title/hook/
  // moneyChordText: a Batch/bridge stylePrompt could carry any BPM figure (or
  // none) with nothing telling the model this trackNo has a specific planned
  // tempo. Forced like moneyChordText/hookDeviceText below.
  const hasIntroTextureText = batch.preassignedSongs?.some(slot => slot.introTextureText);
  const introTextureInstruction = hasIntroTextureText
    ? ' Each entry also includes "introTextureText" - weave that exact phrase into that song\'s stylePrompt, verbatim. It is an intro-only first-5-seconds texture; do not turn that instrument into the whole-song arrangement.'
    : '';
  const hasNegativeStyleText = batch.preassignedSongs?.some(slot => slot.negativeStyleText);
  const negativeStyleInstruction = hasNegativeStyleText
    ? ' Each entry also includes "negativeStyleText"; keep it separate from stylePrompt. Do not put negativeStyleText into stylePrompt; the app exports it to Suno Exclude styles.'
    : '';
  const hasGenreText = batch.preassignedSongs?.some(slot => slot.genreText);
  const genreInstruction = hasGenreText
    ? ' Each entry also includes "genreText" - weave that exact per-song lead/blended genre phrase into stylePrompt; do not replace it with the pack-level genre list.'
    : '';
  const tempoInstruction = ' Each entry also includes "tempo" - use exactly that BPM number in that song\'s stylePrompt (e.g. "96 BPM"), verbatim. Do not invent a different tempo.';
  // TASK v3.43 Step 2 (Part A3) — mirrors hookDeviceInstruction's verbatim-
  // weave pattern for the per-song instrument rotation (see
  // core/promptComposer.ts's rotatingInstrumentSet), newly promoted to a
  // slot field so Batch/bridge songs get the same per-song variety the
  // local path already has. instrumentSet is an array (2-3 names), so the
  // agent weaves each one rather than a single ready-made phrase.
  const hasInstrumentSet = batch.preassignedSongs?.some(slot => slot.instrumentSet?.length);
  const instrumentInstruction = hasInstrumentSet
    ? ' Each entry also includes "instrumentSet" — an array of 2-3 instrument names; weave ALL of them into that song\'s stylePrompt as the instrument detail, verbatim (comma-separated is fine). Do not substitute different instruments, drop any of them, or paraphrase them away.'
    : '';
  // TASK v3.43 Step 2 (Part A3) — arrangementDensity is a bare
  // 'sparse'|'medium'|'full' tag (see core/promptComposer.ts's
  // arrangementDensityLevel), not pre-composed text, so the instruction
  // spells out each level's meaning once here rather than repeating a full
  // phrase on every entry.
  const hasArrangementDensity = batch.preassignedSongs?.some(slot => slot.arrangementDensity);
  const arrangementDensityInstruction = hasArrangementDensity
    ? ` Each entry also includes "arrangementDensity" (one of sparse/medium/full) — weave a phrase describing that density into the stylePrompt: sparse = "${ARRANGEMENT_DENSITY_TEXT_BY_LEVEL.sparse}"; medium = "${ARRANGEMENT_DENSITY_TEXT_BY_LEVEL.medium}"; full = "${ARRANGEMENT_DENSITY_TEXT_BY_LEVEL.full}". Use the matching phrase (or a close paraphrase of it) verbatim; do not substitute a different density level.`
    : '';
  // TASK v3.43 Step 2 (Part A3) — structureTemplate shapes that trackNo's
  // lyric section order rather than naming a stylePrompt phrase to copy (see
  // types.ts's field comment), but "don't invent a different X" still
  // applies in spirit — the agent shouldn't ignore its assigned template and
  // default back to T1's shape. The legend is sent once (not per-entry) —
  // see core/promptComposer.ts's structureTemplateLegend. There is no
  // post-hoc stylePrompt injection for this one (see reconcileWithPreassignedSlot);
  // import only warns if the template's marker never shows up in the lyrics.
  const hasStructureTemplate = batch.preassignedSongs?.some(slot => slot.structureTemplate);
  const structureTemplateInstruction = hasStructureTemplate
    ? ` Each entry also includes "structureTemplate" (one of T1-T5). Structure templates, each a different lyric section order: ${structureTemplateLegend()}. Write THIS song's lyrics — actual section content, not the letter code — following its assigned template's section order exactly; do not default back to T1's shape for a track assigned a different template, and do not invent a different template than the one assigned.`
    : '';
  // v3.82 (TASK B) — mirrors core/bridgeInstruction.ts's identical
  // songLengthInstructionLine/Length-target-column addition (same real
  // T1/T4/T7 measurement — see core/bpmLengthControl.ts's own doc comment):
  // a slow-BPM track needs FEWER sections/words and a tighter instrumental-
  // section cap than a fast one to land in the same clock-time target.
  const hasLengthTarget = batch.preassignedSongs?.some(slot => slot.sectionCountRange);
  const lengthTargetInstruction = hasLengthTarget
    ? ' Each entry also includes "sectionCountRange", "wordCountRange", and "maxInstrumentalSections" — that track\'s own BPM-appropriate targets (a slower tempo gets a shorter structure so it still lands in the pack\'s target song length). Stay within these instead of one flat target regardless of tempo; do not add an extra instrumental-only section beyond maxInstrumentalSections (counting the intro if it has no lyrics) just because the tempo feels slow.'
    : '';
  // TASK v3.67 (TASK A) — killingPointText is conveyed as INTENT, never a
  // verbatim phrase to force-copy (unlike hookDeviceText/moneyChordText
  // above) — the whole point is that the composer decides the concrete
  // wording; this only tells them WHERE this track's one designed peak
  // moment belongs and that it should read as the song's standout moment.
  // Absent entirely for a track with no killing point (arc peakStrength
  // 'none') — that silence is deliberate, not a gap to fill in.
  const hasKillingPoint = batch.preassignedSongs?.some(slot => slot.killingPointText);
  // v3.75 (TASK B) — real waveform measurement of a real pack: songs WITH a
  // killing point still averaged only 3.3dB of dynamic range (target 6dB+)
  // and one track's loudest moment measured in the first 20% of the song
  // instead of the back half — the peak was there, but too small and often
  // in the wrong place to read as "the moment". The old instruction only
  // said what the peak IS, never that it must be audibly the loudest/
  // fullest point or that the material leading into it should hold back to
  // give it something to rise from — added below without touching
  // hardExclusions (a dynamic build-and-release is not the same thing as a
  // belted high note or harsh top end, which stay banned regardless).
  const killingPointInstruction = hasKillingPoint
    ? ' Each entry may also include "killingPointText" and "killingPointPlacement" — a one-line description of that song\'s single designed peak moment and where it falls (final-chorus/bridge/mid-instrumental/pre-chorus/outro). Understand the musical idea and make that moment the song\'s most memorable one, in your own words — do not quote killingPointText verbatim, and do not add a second comparable peak moment elsewhere in the same song. This should be the loudest, fullest, most energetic point of the ENTIRE song, clearly audible as a lift, not a small nudge — and the section immediately before it should stay noticeably more restrained (thinner arrangement, lower energy) so the peak has something real to rise from, rather than the whole song sitting at one constant level. This dynamic build-and-release is separate from the audience\'s own vocal-register/production exclusions below (no belting, no harsh top end) — build energy through arrangement fullness and dynamics, not through those banned techniques. A track with no killingPointText should stay comfortably at its usual level throughout, with no invented peak of its own.'
    : '';
  const hasLyricTheme = batch.preassignedSongs?.some(slot => slot.lyricTheme || slot.lyricThemeText);
  const lyricThemeInstruction = hasLyricTheme
    ? ' Each entry also includes "lyricTheme" and "lyricThemeText" - treat lyricThemeText as that song\'s primary lyric scene, copy it into output.lyricThemeText if you include the field, and make listenerSituation support that scene rather than replacing it with a generic situation or seasonMoment. Use lyricThemeArc as the emotional turn when present.'
    : '';
  const hasPov = batch.preassignedSongs?.some(slot => slot.pov);
  const povInstruction = hasPov
    ? ' Each entry also includes "pov" - write that song\'s lyrics from that exact point of view; do not substitute a different narrator perspective.'
    : '';
  const hasSectionStyles = batch.preassignedSongs?.some(slot => slot.verseStyle || slot.chorusStyle || slot.verseStyleText || slot.chorusStyleText);
  const sectionStyleInstruction = hasSectionStyles
    ? ' Each entry also includes "verseStyleText" and "chorusStyleText" - write the verse sections and chorus sections with those different lyric-writing approaches; do not let every section use the same sentence pattern.'
    : '';
  const preassignedFieldList = [
    'trackNo', 'title', 'hookPhrase', 'songRole', 'tempo', 'emotionArc', 'moneyChordText',
    ...(hasGenreText ? ['genreId', 'genreText'] : []),
    ...(hasHookDeviceText ? ['hookDeviceText'] : []),
    ...(hasIntroTextureText ? ['introTextureText'] : []),
    ...(hasNegativeStyleText ? ['negativeStyleText'] : []),
    ...(hasInstrumentSet ? ['instrumentSet'] : []),
    ...(hasArrangementDensity ? ['arrangementDensity'] : []),
    ...(hasStructureTemplate ? ['structureTemplate'] : []),
    ...(hasLengthTarget ? ['sectionCountRange', 'wordCountRange', 'maxInstrumentalSections'] : []),
    ...(hasKillingPoint ? ['killingPointText', 'killingPointPlacement'] : []),
    ...(hasLyricTheme ? ['lyricTheme', 'lyricThemeText', 'lyricThemeArc'] : []),
    ...(hasPov ? ['pov'] : []),
    ...(hasSectionStyles ? ['verseStyle', 'verseStyleText', 'chorusStyle', 'chorusStyleText'] : []),
    ...(hasVocalText ? ['vocalText', ...(hasVocalVariant ? ['vocalVariantText'] : [])] : []),
    ...(hasConceptText ? ['conceptText', 'conceptLyricImages'] : [])
  ].join(', ');
  const forcedFieldsList = [
    'trackNo', 'emotionArc', 'moneyChordText', 'tempo',
    ...(hasGenreText ? ['genreText'] : []),
    ...(hasHookDeviceText ? ['hookDeviceText'] : []),
    ...(hasIntroTextureText ? ['introTextureText'] : []),
    ...(hasNegativeStyleText ? ['negativeStyleText'] : []),
    ...(hasInstrumentSet ? ['instrumentSet'] : []),
    ...(hasArrangementDensity ? ['arrangementDensity'] : []),
    ...(hasStructureTemplate ? ['structureTemplate'] : []),
    ...(hasVocalText ? ['vocalText', ...(hasVocalVariant ? ['vocalVariantText'] : [])] : []),
    ...(hasConceptText ? ['conceptText', 'conceptLyricImages'] : [])
  ].join(', ').replace(/, ([^,]*)$/, ', or $1');
  const preassignedNote = batch.preassignedSongs?.length
    ? `\n- "preassignedSongs" in the user payload is a fixed, already-decided list of {${preassignedFieldList}} for every song in this request. Do NOT invent a different ${forcedFieldsList} - copy those verbatim. ${titleInstruction} ${hookInstruction} ${moneyChordInstruction}${genreInstruction}${hookDeviceInstruction}${introTextureInstruction}${negativeStyleInstruction}${tempoInstruction}${lengthTargetInstruction}${instrumentInstruction}${arrangementDensityInstruction}${structureTemplateInstruction}${killingPointInstruction}${lyricThemeInstruction}${povInstruction}${sectionStyleInstruction}${vocalInstruction}${conceptInstruction} Also write the remaining content (${preassignedFreeFields}) around these fields. This is what keeps parallel batches from colliding on identity.${openingRoleNote}`
    : '';
  return `\n\nBatch mode:\n- This request only covers tracks ${batch.trackNoOffset + 1} to ${batch.trackNoOffset + opts.songCount} out of ${batch.totalSongCount} total songs in the pack.\n- Number "trackNo" starting at ${batch.trackNoOffset + 1}, not 1.\n- Never reuse any title or hook phrase already listed in "alreadyUsedTitles" / "alreadyUsedHooks" in the user payload.\n- If "lockedIdentity" is present in the user payload, reuse its sonicSignature, vocalSignature, lyricRules, harmonyRules, and visualRules verbatim so the whole pack stays consistent across batches.${preassignedNote}`;
}

/**
 * v3.15 — earwormMode's remote-provider counterpart to the local hook
 * contest's familiarity weighting (see core/openingContest.ts). Describes
 * generic, decades-old songwriting techniques only — never a specific song
 * or artist, same boundary as EARWORM_STYLE_VARIANTS and the money-chord
 * nudge.
 *
 * TASK v3.64-B — was "include generic technique language such as 'simple
 * stepwise melody' and 'singalong-friendly hook'" verbatim, every request,
 * every song — a real 18-song pack measured that literal phrase pair in
 * 18/18 stylePrompts. Now points at each song's own preassignedSongs entry
 * (see hookDeviceInstructionLineFor's identical reference-not-verbatim
 * pattern in claudeCodeBridge.ts) when one is available, so each song gets
 * a different assigned melodic-design direction instead of the whole pack
 * reaching for the same two phrases. Falls back to a still-varied general
 * instruction when no preassignedSongs plan exists (e.g. the OpenAI batch
 * branch, which doesn't forward preassignedSongs).
 */
function earwormSystemNote(hasPreassignedEarworm: boolean): string {
  const styleLine = hasPreassignedEarworm
    ? '- Each song\'s own "preassignedSongs" entry includes "earwormText" - a REFERENCE melodic-design idea for that song (not required wording, not a specific song/artist). Reflect that design in your own words rather than copying the phrase, and make sure no two songs in this set read as the same melodic-construction technique.'
    : '- In "stylePrompt", describe the melody using varied, generic construction language (phrase shape, range, cadence, repetition) - pick a different melodic-design description for each song rather than reusing the same phrase across the set.';
  return `\n\nEarworm mode is on for this request:\n- Prefer a hook phrase that is short, easy to hum on first listen, and repeats its own rhythmic shape.\n- Prefer the most common, widely-shared pop chord progression available (e.g. I-V-vi-IV or the canon progression) over a more distinctive one.\n${styleLine}\n- This only raises the odds of a familiar-feeling result; it is not a guarantee, and it never means referencing or imitating any specific existing song or artist.`;
}

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
  const earwormNote = opts.earwormMode ? earwormSystemNote(Boolean(batch?.preassignedSongs?.some(slot => slot.earwormText))) : '';
  const eraLyricGuidance = eraLyricGuidanceForArchetype(opts.channel.archetype);
  const totalSongCount = totalSongCountOverride ?? batch?.totalSongCount ?? opts.songCount;
  // v4.1 (TASK B) -- was a flat MIN_LYRIC_WORDS/MAX_LYRIC_WORDS (English-only)
  // instruction regardless of opts.lyricLanguage; now reads the real
  // per-language target (core/lyricMetrics.ts's resolveLyricRange). English
  // still resolves to the same 215-230 (MIN_LYRIC_WORDS/MAX_LYRIC_WORDS stay
  // exported as that English default/fallback, unchanged).
  const lyricUnitLabel = opts.lyricLanguage === 'japanese' ? 'characters' : 'words';
  const [minLyricUnits, maxLyricUnits] = resolveLyricRange(opts.lyricLanguage, audienceProfileForAgeGroup(opts.channel.audience)).primaryRange;

  // TASK v3.70 (TASK C) — real listening feedback: every chorus (including
  // the two earlier ones) bookended the hook, so the same line sang ~6x/song
  // in an identical shape. Lowered from "at least 4, bookending every
  // chorus" to "around 4, only the final chorus bookends" — see the Hook
  // rules section below for the actual per-chorus instruction.
  const targetHookRepeats = opts.lyricDepth === 'poetic' ? 3 : 4;
  // TASK v3.23 — branch, don't delete: default off (user makes thumbnails
  // externally) drops the ask and the schema field; on restores both.
  // TASK v3.60 (TASK F-2) — the app already strips any Suno/AI-generation
  // keyword from public tags at import time (exportCompliance.ts's
  // sanitizePublicYoutubeTags), so an agent that spends effort adding one
  // anyway is effort wasted, not a real risk; stated so the agent doesn't
  // bother in the first place.
  const youtubeMetadataLine = generateThumbnailText
    ? '- Include YouTube title, description, tags, and thumbnail text for every song. Do not include "Suno", "AI-generated", or similar generation-tool keywords in "tags" — those are filtered out before anything goes public, so there is no benefit to adding them.'
    : '- Include YouTube title, description, and tags for every song. Do not include "Suno", "AI-generated", or similar generation-tool keywords in "tags" — those are filtered out before anything goes public, so there is no benefit to adding them.';
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
- Money chords are mandatory, but the output must still feel original. If "preassignedSongs" is present below, use each song's own "moneyChordText" verbatim (see the batch note) — it already names the exact progression plus how to make it audible (chord changes locked to the beat, bass on the root, a real cadence lift into the chorus), not just the bare progression name.
- This playlist pack has ${totalSongCount} songs total, generated as one coherent set — a single request may cover only part of the pack at a time (see the batch note below for this request's exact scope, if present).
- Keep a stable sonic/vocal identity across all tracks while varying situations, hooks, titles, and lyrical images.
- Sequence the songs naturally: opener, early lift, middle depth, late-set highlight, warm closer.
- Lyrics must use Suno section tags and must be ready to paste separately from the style prompt.
- CRITICAL — do NOT add an "[end]" or "[outro]" tag (or any closing/fade-out tag) after the final chorus. Neither does anything in Suno — they only add a section that inflates the song's render length past its target duration. The final chorus (or that structure template's own tagged final-chorus marker) is the LAST thing in "lyrics"; nothing follows it. Real, previously-shipped mistake: every song in a real pack ended with a trailing "[end]" tag despite this exact instruction being given.
- CRITICAL — arrangement/production vocabulary belongs ONLY in "stylePrompt", never in "lyrics". If "preassignedSongs" gives you "introTextureText", "instrumentSet", "arrangementDensity", "hookDeviceText", or "moneyChordText" to weave in, those exact words (and any other instrument name, playing technique, or production/mix term — guitar, piano, drums, strings, brass, percussion, stop-time, breakdown, tape saturation, etc.) go into the stylePrompt string only. A lyric line must never describe what an instrument or the arrangement is doing — a listener sings words, not a mix note. Forbidden examples (real, previously-shipped mistakes): "Spiccato strings flicker over quiet water", "The straight-pop drums move softly", "Now the stop-time opens brighter", "The bass and drums fall silent". Section tags themselves ([breakdown], [instrumental hook], etc.) are fine; a sentence describing the arrangement underneath one is not.
- Each song's hookPhrase must not contradict that song's own "listenerSituation" on time of day — if the scene is a morning/dawn moment, the hook (and the lyrics built around it) must not say "tonight"/"night"/"evening"/"midnight", and vice versa. Real, previously-shipped mistake: listenerSituation "sitting with morning coffee before the day begins" paired with hookPhrase "Stay with Me Tonight".
- Each song's "lyrics" must total ${minLyricUnits}-${maxLyricUnits} ${lyricUnitLabel} (not counting section tags like [chorus]) — this is what actually determines Suno's rendered length; a short lyric renders noticeably shorter than target regardless of any target duration. Target render length for this pack: ${compactDuration(opts.durationTarget, true)}.
- Give each section room to breathe rather than compressing it to hit the word count with fewer, shorter sections: a verse should run 5-6 lines, a pre-chorus or bridge 2-4 lines, a chorus 3-4 lines including its repeated hook line. A 2-3 line verse undercuts both the word-count floor above and the target render length even when the section TAGS match the assigned structure template.
- Every song should include at least one genuinely wordless instrumental moment somewhere — either an instrumental intro before the first vocal line (when this song's plan calls for one, see "Intro" below) or, for a song whose intro is vocal, a short 4-8 bar instrumental break/solo before the final chorus with no lyric line under it. This costs a few seconds of render time without adding a single word of lyric content, and real listening measured most of a pack coming back with no instrumental section at all despite being planned.
- Include this exact phrase as one of stylePrompt's own descriptor clauses in EVERY song, verbatim: "${compactDuration(opts.durationTarget, false, true)}". Every song in this pack carries the identical phrase — that is intentional and required, not a "shared/redundant atom" to trim, vary, or omit; this is the one clause allowed to repeat identically across every song in the pack.
${youtubeMetadataLine}
- Return valid JSON only, matching the requested PlaylistBlueprint shape.
- CRITICAL: Return ONLY the JSON object. No markdown, no code fences (no \`\`\`), no prose, no explanation, and no closing remarks before or after it. The response must start with { and end with } — nothing else outside those two characters.
- CRITICAL: Every string value must itself be valid JSON. Encode every line break inside "lyrics" (or any other field) as the two characters \\n, never a literal newline — a raw newline inside a JSON string makes the whole response unparseable. Escape any literal double-quote character inside a string as \\".
- CRITICAL: "stylePrompt" is pasted directly into Suno's style field, which truncates past ${SUNO_STYLE_LIMIT} characters. Keep every stylePrompt at or under ${SAFE_TARGET} characters — pack it with genre, vocal, hook-repeat instruction, money chord, duration, and tempo first, and only add mood/instrument/season detail if there is room left. Never let it run long; a shorter, focused prompt beats a longer one that gets cut off mid-sentence.
- Keep negativeStyleText out of stylePrompt. It belongs only in the separate Suno Exclude styles field.
- Do not include typography, logo, or thumbnail art-direction language (e.g. font style) in "stylePrompt" — that belongs only in visual/thumbnail fields, never in the music style prompt.

Hook rules (each song's hookPhrase):
- The hook must be a short, singable phrase of 2-5 words, in Title Case, never starting with a lowercase letter.
${titleHookRuleLine}
- The hook line appears exactly ONCE in every earlier chorus-type section (not open-and-close both) — vary whether it's the first line, second line, or last line of that chorus block, from song to song. Only the FINAL chorus bookends: the hook opens AND closes it (2 occurrences there only). This gives roughly ${targetHookRepeats} hook occurrences total across the whole song (earlier choruses x1 each + final chorus x2) — do not exceed this by bookending every chorus like the final one; a real previous pack over-repeated the hook by doing exactly that (open, one line, hook again, three lines, hook again — every single chorus, every song), which read as repetitive on close listening.
- CRITICAL: Every one of those hook occurrences inside "lyrics" must match "hookPhrase" EXACTLY, character for character, including its Title Case — do not lowercase or otherwise reword the hook when it's sung. (Sentence-case display for pasting into Suno is handled separately by the app at copy time — the stored "lyrics" field must keep the verbatim match so the app's own quality checks can find it.)
- Never address an inanimate object as if it were a person (e.g. "Hold on, coffee" or "Close your eyes, doorway") — vocative phrasing may only address a person or an abstract/personified noun (a friend, a season, "my love"), never a physical object.

Safety rules:
${safeLyricRules.map(rule => `- ${rule}`).join('\n')}${eraLyricGuidance ? `\n- ${eraLyricGuidance}\n- Record factual human lyric edits when provided; never claim that a song is eligible for collecting-society registration.` : ''}${earwormNote}${batchNote}`;
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
    excludePrompt: 'string optional; Suno Exclude styles text, never mixed into stylePrompt',
    // TASK v3.70 (TASK B) — dropped "[end]" from this example: real bridge
    // output was literally reproducing every tag named here, and "[end]"
    // reads as nothing in Suno (see this task's own real-length measurement).
    // The final chorus is the last section of the song, nothing after it.
    lyrics: 'string with section tags following the assigned structureTemplate\'s exact order (see the structure-template legend below) — the final section (e.g. final chorus) is the LAST thing in the string; do not add a trailing [end] or [outro] tag after it',
    ...(generateThumbnailText ? { thumbnailText: 'string' } : {}),
    youtube: {
      title: 'string',
      description: 'string',
      tags: ['string'],
      ...(generateThumbnailText ? { thumbnailText: 'string' } : {})
    },
    youtubeTitleKo: 'string optional',
    youtubeTitleJa: 'string optional',
    genreId: 'string optional; copy from preassignedSongs if present',
    genreText: 'string optional; copy from preassignedSongs if present',
    lyricTheme: 'string optional; copy from preassignedSongs if present',
    lyricThemeText: 'string optional; copy from preassignedSongs if present',
    lyricThemeArc: 'string optional; copy from preassignedSongs if present',
    pov: 'string optional; copy from preassignedSongs if present',
    verseStyle: 'string optional; copy from preassignedSongs if present',
    verseStyleText: 'string optional; copy from preassignedSongs if present',
    chorusStyle: 'string optional; copy from preassignedSongs if present',
    chorusStyleText: 'string optional; copy from preassignedSongs if present',
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
    customLyricThemeScene: opts.customLyricThemeScene,
    avoidWords: opts.avoidWords,
    negativeStyle: resolveNegativeStyleText(opts),
    japaneseEraLyricGuidance: eraLyricGuidanceForArchetype(opts.channel.archetype),
    introUniqueness: opts.introUniqueness ?? 50,
    diversityAllocations: opts.diversityAllocations ?? [],
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
    japaneseEraLyricGuidance: eraLyricGuidanceForArchetype(opts.channel.archetype),
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
    customLyricThemeScene: opts.customLyricThemeScene,
    avoidWords: opts.avoidWords,
    negativeStyle: resolveNegativeStyleText(opts),
    introUniqueness: opts.introUniqueness ?? 50,
    diversityAllocations: opts.diversityAllocations ?? [],
    earwormMode: opts.earwormMode ?? false,
    trackNoOffset: batch?.trackNoOffset ?? 0,
    totalSongCount: batch?.totalSongCount ?? opts.songCount,
    alreadyUsedTitles: batch?.usedTitles ?? [],
    alreadyUsedHooks: batch?.usedHooks ?? [],
    lockedIdentity: batch?.lockedIdentity ?? null,
    preassignedSongs: batch?.preassignedSongs ?? []
  };
}
