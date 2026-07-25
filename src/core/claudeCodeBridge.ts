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
import { ARRANGEMENT_DENSITY_TEXT_BY_LEVEL, buildSystemInstruction, buildUserInstruction, songOutputShape, structureTemplateLegend } from './promptComposer';
import { buildSignatureBlueprint } from './localGenerator';
import { scoreSongs } from './quality';
import { preallocateSongSlots, reconcileWithPreassignedSlot } from './batchPreallocation';
import { dedupeTitlesAcrossPack } from './lyricEngine';
import { buildSetOptions } from './multiSetGeneration';
import { buildSetConceptLine } from './setConcept';
import { moneyChordPresets } from '../data/moneyChords';
import { usesVocalQuota } from './vocalPlan';
import { lintInPackStyleSimilarity } from './diversityLinter';

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
 * TASK v3.35 (bridge split) — real measurement: a single coding-agent
 * response tops out well under what a 180-song ask needs (~625 output
 * tokens/song measured x 180 songs =~112,600 tokens, past every current
 * model's single-response output cap of 32K-64K) — Codex silently stopped
 * at 12/180 songs. 12-18 songs is the safe one-shot size, matching the
 * multi-set default of 18 songs/set (see core/multiSetGeneration.ts).
 */
export interface ClaudeCodeInstructionOptions {
  /** Defaults to CLAUDE_CODE_BRIDGE_OUTPUT_FILENAME; multi-set instructions use "songs-output-setNN.json" instead so N files can be produced/imported without overwriting each other. */
  outputFilename?: string;
  /** One-line per-set flavor hint (see core/setConcept.ts), included in the instruction when building a multi-set batch of instructions; omitted for a plain single-pack instruction. */
  conceptLine?: string;
  /** Markdown table summarizing set-level concept/season/money-chord/vocal quotas for bridge copy. */
  setPlanningTable?: string;
}

function buildBridgePayload(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  avoid: { usedTitles?: string[]; usedHooks?: string[] } | undefined,
  preassignedSongs: PreassignedSongSlot[],
  generateThumbnailText: boolean
) {
  const batch: BatchContext = {
    trackNoOffset: 0,
    totalSongCount: opts.songCount,
    usedTitles: avoid?.usedTitles ?? [],
    usedHooks: avoid?.usedHooks ?? [],
    lockedIdentity: null,
    preassignedSongs
  };
  const basePayload = buildUserInstruction(opts, genres, moods, season, batch, generateThumbnailText);
  return {
    batch,
    payload: {
      ...basePayload,
      preassignedSongs,
      outputShape: { songs: [songOutputShape(generateThumbnailText)] }
    }
  };
}

function titleInstructionLineFor(opts: GenerationOptions): string {
  const titleMode = opts.titleMode ?? 'ai-creative';
  return titleMode === 'local'
    ? '- "preassignedSongs" gives local planning slots. Copy the preassigned title in local title mode, but the final "hookPhrase" you write must exactly match the hook line repeated in that song\'s lyrics; never let the JSON hook and chorus hook diverge.'
    : '- "preassignedSongs" gives local planning slots and fallback placeholders. Write your OWN original title for each song, independent of the hookPhrase. You may use the slot hook or write a new original hook, but the final "hookPhrase" must exactly match the hook line that opens and closes every chorus in that song\'s lyrics. Write real Billboard Hot 100-style titles: single striking words, unexpected concrete nouns, short metaphors, or evocative images, never a restatement of the hook and never the same shape for every song. Keep the channel tone while varying the structure freely.';
}

// TASK v3.43 Part A2 — same forced-verbatim BPM instruction promptComposer.ts's
// buildBatchSystemNote now gives real API requests (kept in sync here per this
// file's existing convention — see titleInstructionLineFor's comment above):
// "tempo" was previously only a fallback-suggestion field, never enforced.
function tempoInstructionLine(): string {
  return '- Each "preassignedSongs" entry also includes "tempo" — use exactly that BPM number in that song\'s stylePrompt (e.g. "96 BPM"), verbatim. Do not invent a different tempo.';
}

// TASK v3.43 Step 2 (Part A3) — mirrors hookDeviceInstructionLine's
// verbatim-weave pattern for the newly-promoted instrumentSet slot field
// (see core/batchPreallocation.ts's preallocateSongSlots). instrumentSet is
// an array (2-3 names), so the agent weaves each one, not one ready phrase.
function instrumentInstructionLineFor(preassignedSongs: PreassignedSongSlot[]): string {
  return preassignedSongs.some(slot => slot.instrumentSet?.length)
    ? '- Each "preassignedSongs" entry also includes "instrumentSet" — an array of 2-3 instrument names; weave ALL of them into that song\'s stylePrompt as the instrument detail, verbatim (comma-separated is fine). Do not substitute different instruments, drop any of them, or paraphrase them away.'
    : '';
}

// TASK v3.43 Step 2 (Part A3) — arrangementDensity is a bare
// 'sparse'|'medium'|'full' tag, not pre-composed text, so this spells out
// each level's meaning once (mirrors promptComposer.ts's buildBatchSystemNote).
function arrangementDensityInstructionLineFor(preassignedSongs: PreassignedSongSlot[]): string {
  return preassignedSongs.some(slot => slot.arrangementDensity)
    ? `- Each "preassignedSongs" entry also includes "arrangementDensity" (one of sparse/medium/full) — weave a phrase describing that density into the stylePrompt: sparse = "${ARRANGEMENT_DENSITY_TEXT_BY_LEVEL.sparse}"; medium = "${ARRANGEMENT_DENSITY_TEXT_BY_LEVEL.medium}"; full = "${ARRANGEMENT_DENSITY_TEXT_BY_LEVEL.full}". Use the matching phrase (or a close paraphrase) verbatim; do not substitute a different density level.`
    : '';
}

// TASK v3.43 Step 2 (Part A3) — structureTemplate is a directive for that
// song's own lyric section order (see types.ts's field comment), not a
// stylePrompt phrase; the legend is sent once here rather than per-entry.
function structureTemplateInstructionLineFor(preassignedSongs: PreassignedSongSlot[]): string {
  return preassignedSongs.some(slot => slot.structureTemplate)
    ? `- Each "preassignedSongs" entry also includes "structureTemplate" (one of T1-T5). Structure templates, each a different lyric section order: ${structureTemplateLegend()}. Write THIS song's lyrics — actual section content, not the letter code — following its assigned template's section order exactly; do not default back to T1's shape for a track assigned a different template, and do not invent a different template than the one assigned.`
    : '';
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
}

function summarizeMoneyChord(opts: GenerationOptions, preassignedSongs: PreassignedSongSlot[]): string {
  const fromSlots = Array.from(new Set(
    preassignedSongs
      .map(slot => slot.moneyChordText.replace(/,\s*hook lands on the downbeat.*$/i, '').trim())
      .filter(Boolean)
  ));
  if (fromSlots.length > 0) {
    return fromSlots.length > 3 ? `${fromSlots.slice(0, 3).join(' / ')} / ...` : fromSlots.join(' / ');
  }
  if ((opts.moneyChordMode ?? 'default') === 'custom' && opts.customMoneyChord.trim()) return opts.customMoneyChord.trim();
  return moneyChordPresets[opts.moneyChordMode ?? 'default']?.compactProgression ?? 'default money chord progression';
}

/**
 * TASK v3.39 — counts the slots' own resolved vocalType rather than
 * recomputing scaleVocalQuota independently, so the set-planning table's
 * summary can never drift from what preassignedSongs (and therefore the
 * per-song "vocalText" instruction below) actually assigned.
 */
function summarizeVocalQuota(opts: GenerationOptions, preassignedSongs: PreassignedSongSlot[]): string {
  if (!usesVocalQuota(opts)) return 'single vocal identity';
  const counts = { male: 0, female: 0, mixed: 0 };
  for (const slot of preassignedSongs) {
    if (slot.vocalType) counts[slot.vocalType] += 1;
  }
  return `male ${counts.male}, female ${counts.female}, mixed ${counts.mixed}`;
}

interface BridgeSetPlanningRow {
  setIndex: number;
  setCount: number;
  conceptLine: string;
  seasonLabel: string;
  setOpts: GenerationOptions;
  preassignedSongs: PreassignedSongSlot[];
  outputFilename: string;
}

function buildSetPlanningTable(rows: BridgeSetPlanningRow[]): string {
  return [
    '| Set | Concept | Season | Money chord | Vocal quota | Output file |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(row => [
      `Set ${String(row.setIndex + 1).padStart(2, '0')}/${row.setCount}`,
      markdownCell(row.conceptLine),
      markdownCell(row.seasonLabel),
      markdownCell(summarizeMoneyChord(row.setOpts, row.preassignedSongs)),
      markdownCell(summarizeVocalQuota(row.setOpts, row.preassignedSongs)),
      row.outputFilename
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  ].join('\n');
}

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
  generateThumbnailText = false,
  instructionOptions: ClaudeCodeInstructionOptions = {}
): string {
  const outputFilename = instructionOptions.outputFilename ?? CLAUDE_CODE_BRIDGE_OUTPUT_FILENAME;
  const { batch, payload } = buildBridgePayload(opts, genres, moods, season, avoid, preassignedSongs, generateThumbnailText);
  const bridgeRulesBatch: BatchContext = { ...batch, preassignedSongs: [] };
  const rules = buildSystemInstruction(opts, bridgeRulesBatch, undefined, generateThumbnailText);

  // TASK v3.27/v3.28 (Part A2/B2) — same titleMode branch as
  // promptComposer.ts's buildBatchSystemNote, kept in sync here rather than
  // left to drift: an agent run through this bridge should get identical
  // title guidance to a real Batch API sub-request, not a weaker or
  // stronger version of it. v3.28 dropped the "title must equal/contain the
  // hook" constraint for ai-creative entirely — real measurement showed
  // titles still came back 100% identical to their hooks with that
  // constraint in place, even with v3.27's shape-rotation guidance.
  const titleInstructionLine = titleInstructionLineFor(opts);
  // TASK v3.39 — same verbatim-weave rule promptComposer.ts's
  // buildBatchSystemNote gives real API requests, kept in sync here per this
  // file's existing convention (see the titleInstructionLine/moneyChordText
  // comments above). Present for every channel now (TASK v3.39 Part H —
  // batchPreallocation.ts's preallocateSongSlots sets vocalText from
  // opts.vocalTone/channel.defaultVocal for non-kids channels too, not just
  // the kids per-song quota), since a real showa-cafe pack showed a selected
  // male vocal preset silently coming back female with no instruction at all
  // telling the agent to respect it.
  const vocalInstructionLine = preassignedSongs.some(slot => slot.vocalText)
    ? '- Each "preassignedSongs" entry also includes "vocalText" — weave that exact phrase into that song\'s stylePrompt as the vocal description, verbatim. Do not substitute a different vocal gender or type (e.g. male instead of female, or an adult voice for a kids choir) or paraphrase it away.'
    : '';
  // TASK v3.42 Part B2 — same verbatim-weave rule promptComposer.ts's
  // buildBatchSystemNote gives real API requests. Real measurement of a
  // generated 15-song pack found the reinforcement text every song got was
  // byte-identical ("hook lands on the downbeat, clear on-beat chord
  // changes, bass on the root, strong chorus lift") — this per-song
  // arrangement-contrast device is what replaces it.
  const hookDeviceInstructionLine = preassignedSongs.some(slot => slot.hookDeviceText)
    ? '- Each "preassignedSongs" entry also includes "hookDeviceText" — weave that exact phrase into that song\'s stylePrompt as an arrangement/production detail, verbatim. This is a per-song arrangement-contrast device (stop-time, key change, breakdown, etc); do not drop it, substitute a different device, or paraphrase it away, and never reuse the same device text word-for-word across two songs in this pack.'
    : '';
  const instrumentInstructionLine = instrumentInstructionLineFor(preassignedSongs);
  const arrangementDensityInstructionLine = arrangementDensityInstructionLineFor(preassignedSongs);
  const structureTemplateInstructionLine = structureTemplateInstructionLineFor(preassignedSongs);

  return [
    'You are generating song content for a Suno playlist pack as a one-shot task in this session — no Anthropic/OpenAI API call, write your result straight to a file.',
    instructionOptions.conceptLine ? `\nThis set's flavor: ${instructionOptions.conceptLine} — lean into this lead genre/season for the pack's overall tone, without abandoning the channel's core style.` : '',
    '',
    instructionOptions.setPlanningTable ? `Set planning table:\n${instructionOptions.setPlanningTable}` : '',
    '',
    rules,
    '',
    'Request payload for this pack (channel/genre/mood/season context, already-used titles/hooks to avoid, and this pack\'s preassigned title/hook per track):',
    '```json',
    JSON.stringify(payload, null, 2),
    '```',
    '',
    'Output requirement:',
    `- Write a new file named "${outputFilename}" in the current directory.`,
    `- Its content must be exactly { "songs": [ ... ] } — ${opts.songCount} objects total, one per song, matching "outputShape.songs[0]" above (title, hookPhrase, stylePrompt, lyrics, seasonMoment, listenerSituation, emotionArc, youtube{title,description,tags}, etc.).`,
    titleInstructionLine,
    // TASK v3.30 — real Codex-bridge output showed 20/20 titles and 19/20
    // hookPhrases copied verbatim from "alreadyUsedTitles"/"alreadyUsedHooks"
    // (just reshuffled to different track numbers) — the agent apparently
    // read those arrays as source material rather than a blocklist. The old
    // one-line "Never reuse..." bullet, buried 5th of 7 with no self-check
    // step, wasn't forceful enough. This is now a CRITICAL bullet stating
    // the exact forbidden count and an explicit before-writing verification
    // step. The app's import-time safety net (title dedup + hook-collision
    // warnings) still catches this if it happens again — see
    // dedupeTitlesAcrossPack/flagHookCollisions — but this is the first line
    // of defense.
    `- CRITICAL: Every one of the ${avoid?.usedTitles?.length ?? 0} titles in "alreadyUsedTitles" and every one of the ${avoid?.usedHooks?.length ?? 0} hooks in "alreadyUsedHooks" above is FORBIDDEN for this pack — they were already used by a previous pack, not source material to draw from. Before writing the file, check every song's "title" and "hookPhrase" against both lists; if any match (even reordered onto a different track), rewrite that title/hook to something new.`,
    '- CRITICAL: For every imported song, "hookPhrase" and "lyrics" are treated as a matched pair. The hookPhrase string must appear verbatim in the lyrics as the chorus bookend hook; the import step preserves that pair and will not rewrite hooks to match preassignedSongs.',
    // TASK v3.33 Part C — same "moneyChordText" field/instruction
    // promptComposer.ts's buildBatchSystemNote already gives real API
    // requests (kept in sync here rather than shared code, per this file's
    // existing convention — see the titleInstructionLine comment above):
    // a bare "money chords are mandatory" line reads as vague to Suno per
    // real listening feedback, so each preassignedSongs entry carries its
    // own ready-to-use progression + reinforcement text instead.
    '- Each "preassignedSongs" entry also includes "moneyChordText" — weave that exact phrase into that song\'s stylePrompt as the money-chord portion, verbatim. Do not substitute a different progression or paraphrase it away.',
    tempoInstructionLine(),
    hookDeviceInstructionLine,
    instrumentInstructionLine,
    arrangementDensityInstructionLine,
    structureTemplateInstructionLine,
    vocalInstructionLine,
    // TASK v3.35 — multi-set generation can prefix each song's title with
    // its set-local track number ("01. ", "02. ", ...) after import, using
    // the locally trusted trackNo (see core/multiSetGeneration.ts's
    // applySetTitlePrefix) — never the agent's own counting, which can be
    // wrong or inconsistent across a long output. Telling the agent not to
    // add its own numbering avoids a double/mismatched prefix if the app
    // applies one afterward.
    '- Do NOT prefix "title" with a track number or any "01.", "02." style numbering yourself — write only the creative title. If this pack needs numbered titles, the app adds that afterward from the trusted trackNo.',
    '- Do NOT include projectTitle, channelName, oneLineConcept, sonicSignature, vocalSignature, lyricRules, harmonyRules, or visualRules in the file — the app supplies those separately from local context.',
    '- The file itself must be raw JSON — no markdown fences, no surrounding prose, inside the file.',
    '- When done, tell me the file\'s path so I can import it back into Suno Weaver Studio.'
  ].join('\n');
}

export interface MultiSetBridgeInstruction {
  /** 0-based */
  setIndex: number;
  setOpts: GenerationOptions;
  outputFilename: string;
  instruction: string;
  preassignedSongs: PreassignedSongSlot[];
  conceptLine: string;
  avoid: { usedTitles: string[]; usedHooks: string[] };
}

export interface MultiSetBridgeMasterInstruction {
  setCount: number;
  songsPerSet: number;
  outputFilenames: string[];
  instruction: string;
  setInstructions: MultiSetBridgeInstruction[];
}

/**
 * TASK v3.35 (bridge split) — splits a multi-set bridge export into one
 * self-contained instruction per set (default 18 songs/set — see the
 * ClaudeCodeInstructionOptions doc comment for the real output-token
 * measurement behind that number), instead of one instruction asking for
 * every song in the whole run. Each set's instruction gets its own
 * "songs-output-setNN.json" filename and a cumulative avoid-list built the
 * same way core/multiSetGeneration.ts's runMultiSetGeneration threads
 * cross-set history — except here, since there's no real agent output yet
 * at the time all N instructions are built, the avoid-list is seeded from
 * each prior set's *preallocated* (deterministic, locally-decided)
 * titles/hooks rather than real agent output. This is the same fallback
 * every other generation path already leans on for parallel/unseen siblings
 * (preassignedSongs is deliberately labeled "fallback" in the instruction
 * text, not "must use") — callers that re-run this after real sets get
 * imported (see hooks/useMultiSetGenerationFlow.ts's sibling UI logic)
 * should pass the real imported titles/hooks in `initialAvoid` instead, so
 * later not-yet-copied instructions reflect what's actually been produced
 * so far.
 */
export function buildMultiSetClaudeCodeInstructions(
  baseOpts: GenerationOptions,
  setCount: number,
  songsPerSet: number,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  initialAvoid: { usedTitles?: string[]; usedHooks?: string[] } | undefined,
  generateThumbnailText = false
): MultiSetBridgeInstruction[] {
  const results: MultiSetBridgeInstruction[] = [];
  let usedTitles = [...(initialAvoid?.usedTitles ?? [])];
  let usedHooks = [...(initialAvoid?.usedHooks ?? [])];

  for (let index = 0; index < setCount; index++) {
    const setOpts = buildSetOptions(baseOpts, index, setCount, songsPerSet);
    const avoid = { usedTitles, usedHooks };
    const preassignedSongs = preallocateSongSlots(setOpts, genres, avoid);
    const conceptLine = buildSetConceptLine(setOpts.channel, season.label, index, setCount);
    const outputFilename = `songs-output-set${String(index + 1).padStart(2, '0')}.json`;
    const setPlanningTable = buildSetPlanningTable([{
      setIndex: index,
      setCount,
      conceptLine,
      seasonLabel: season.label,
      setOpts,
      preassignedSongs,
      outputFilename
    }]);
    const instruction = buildClaudeCodeInstruction(setOpts, genres, moods, season, avoid, preassignedSongs, generateThumbnailText, { outputFilename, conceptLine, setPlanningTable });

    results.push({ setIndex: index, setOpts, outputFilename, instruction, preassignedSongs, conceptLine, avoid });
    usedTitles = [...usedTitles, ...preassignedSongs.map(slot => slot.title)];
    usedHooks = [...usedHooks, ...preassignedSongs.map(slot => slot.hookPhrase)];
  }

  return results;
}

/**
 * TASK v3.40 (bridge master mode): Codex/Claude Code can perform a loop in
 * one session, so users should not have to paste N separate prompts for N
 * sets. This keeps the existing per-set instruction builder as the source of
 * truth, then packs those same set specs into one master instruction that
 * tells the coding agent to generate and save each set sequentially.
 */
export function buildMultiSetClaudeCodeMasterInstruction(
  baseOpts: GenerationOptions,
  setCount: number,
  songsPerSet: number,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  initialAvoid: { usedTitles?: string[]; usedHooks?: string[] } | undefined,
  generateThumbnailText = false
): MultiSetBridgeMasterInstruction {
  const setInstructions = buildMultiSetClaudeCodeInstructions(baseOpts, setCount, songsPerSet, genres, moods, season, initialAvoid, generateThumbnailText);
  const totalSongs = setCount * songsPerSet;
  const rules = buildSystemInstruction({ ...baseOpts, songCount: totalSongs }, undefined, totalSongs, generateThumbnailText);
  const titleInstructionLine = titleInstructionLineFor(baseOpts);
  const vocalInstructionLine = setInstructions.some(item => item.preassignedSongs.some(slot => slot.vocalText))
    ? '- Each "preassignedSongs" entry also includes "vocalText" - weave that exact phrase into that song\'s stylePrompt as the vocal description, verbatim. Do not substitute a different vocal gender or type (e.g. male instead of female, or an adult voice for a kids choir) or paraphrase it away.'
    : '';
  const hookDeviceInstructionLine = setInstructions.some(item => item.preassignedSongs.some(slot => slot.hookDeviceText))
    ? '- Each "preassignedSongs" entry also includes "hookDeviceText" - weave that exact phrase into that song\'s stylePrompt as an arrangement/production detail, verbatim. This is a per-song arrangement-contrast device; do not drop it, substitute a different device, or paraphrase it away, and never reuse the same device text word-for-word across two songs.'
    : '';
  const allSlots = setInstructions.flatMap(item => item.preassignedSongs);
  const instrumentInstructionLine = instrumentInstructionLineFor(allSlots);
  const arrangementDensityInstructionLine = arrangementDensityInstructionLineFor(allSlots);
  const structureTemplateInstructionLine = structureTemplateInstructionLineFor(allSlots);
  const setPlanningTable = buildSetPlanningTable(setInstructions.map(item => ({
    setIndex: item.setIndex,
    setCount,
    conceptLine: item.conceptLine,
    seasonLabel: season.label,
    setOpts: item.setOpts,
    preassignedSongs: item.preassignedSongs,
    outputFilename: item.outputFilename
  })));
  const sets = setInstructions.map(item => {
    const { payload } = buildBridgePayload(item.setOpts, genres, moods, season, item.avoid, item.preassignedSongs, generateThumbnailText);
    return {
      setNo: item.setIndex + 1,
      setTotal: setCount,
      outputFilename: item.outputFilename,
      conceptLine: item.conceptLine,
      requestPayload: payload
    };
  });
  const masterPayload = {
    masterMode: true,
    setCount,
    songsPerSet,
    totalSongCount: totalSongs,
    outputFilenames: setInstructions.map(item => item.outputFilename),
    sets
  };

  const instruction = [
    'You are generating multiple Suno playlist sets in one coding-agent session - no Anthropic/OpenAI API call, write every result straight to files.',
    '',
    'MASTER MODE:',
    `- Generate ${setCount} sets sequentially, Set 01 through Set ${String(setCount).padStart(2, '0')}, ${songsPerSet} songs per set.`,
    '- Do not stop after the first file. Finish every set and write every requested output file.',
    '- For each set, use that set\'s requestPayload exactly as if it were a normal one-pack Claude Code bridge request.',
    '- After writing a set, add the actual generated titles and hookPhrases from that file to your avoid list before composing the next set. Later sets must not reuse earlier-set titles or hooks.',
    '- If any title or hook collides with alreadyUsedTitles/alreadyUsedHooks or a prior set in this master run, rewrite it before writing the file.',
    '',
    'Set planning table:',
    setPlanningTable,
    '',
    rules,
    '',
    'Master request payload:',
    '```json',
    JSON.stringify(masterPayload, null, 2),
    '```',
    '',
    'Output requirement for every set:',
    '- Write exactly one raw JSON file per set, named by that set\'s "outputFilename".',
    '- Each file content must be exactly { "songs": [ ... ] }, with no markdown fences and no surrounding prose inside the file.',
    `- Each set file must contain exactly ${songsPerSet} song objects matching requestPayload.outputShape.songs[0].`,
    titleInstructionLine,
    '- CRITICAL: For every song, "hookPhrase" and "lyrics" are treated as a matched pair. The hookPhrase string must appear verbatim in the lyrics as the chorus bookend hook.',
    '- Each "preassignedSongs" entry includes "moneyChordText" - weave that exact phrase into that song\'s stylePrompt as the money-chord portion, verbatim.',
    tempoInstructionLine(),
    hookDeviceInstructionLine,
    instrumentInstructionLine,
    arrangementDensityInstructionLine,
    structureTemplateInstructionLine,
    vocalInstructionLine,
    '- Do NOT prefix "title" with a track number or any "01.", "02." style numbering yourself - write only the creative title. The app adds numbering after import when enabled.',
    '- Do NOT include projectTitle, channelName, oneLineConcept, sonicSignature, vocalSignature, lyricRules, harmonyRules, or visualRules in the files.',
    '- When done, tell me the paths of all files so I can import them back into Suno Weaver Studio.'
  ].join('\n');

  return {
    setCount,
    songsPerSet,
    outputFilenames: setInstructions.map(item => item.outputFilename),
    instruction,
    setInstructions
  };
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

function normalizedHookKey(hook: string): string {
  return hook.trim().toLowerCase();
}

function appendWarning(song: SongIdea, warning: string): SongIdea {
  return song.warnings.includes(warning)
    ? song
    : { ...song, warnings: [...song.warnings, warning] };
}

function flagHookCollisions(songs: SongIdea[], avoidHooks: string[] = []): { songs: SongIdea[]; warnings: string[] } {
  const warnings: string[] = [];
  let nextSongs = songs;
  const historicalHooks = new Set(avoidHooks.map(normalizedHookKey).filter(Boolean));
  const byHook = new Map<string, SongIdea[]>();

  for (const song of songs) {
    const key = normalizedHookKey(song.hookPhrase);
    if (!key) continue;
    byHook.set(key, [...(byHook.get(key) ?? []), song]);
  }

  function warnTrack(trackNo: number, warning: string) {
    nextSongs = nextSongs.map(song => song.trackNo === trackNo ? appendWarning(song, warning) : song);
    warnings.push(warning);
  }

  for (const [key, matches] of byHook) {
    if (historicalHooks.has(key)) {
      for (const song of matches) {
        warnTrack(song.trackNo, `Track ${song.trackNo}: hookPhrase "${song.hookPhrase}" duplicates a hook already used by this channel. Regenerate this song; import does not auto-rewrite hooks because that would desync lyrics.`);
      }
    }
    if (matches.length > 1) {
      const trackNos = matches.map(song => song.trackNo).join(', ');
      const warning = `Tracks ${trackNos}: hookPhrase "${matches[0].hookPhrase}" is duplicated within this import. Regenerate one of these songs; import does not auto-rewrite hooks because that would desync lyrics.`;
      for (const song of matches) {
        nextSongs = nextSongs.map(candidate => candidate.trackNo === song.trackNo ? appendWarning(candidate, warning) : candidate);
      }
      warnings.push(warning);
    }
  }

  return { songs: nextSongs, warnings };
}

/**
 * Builds the song from the bridge agent's raw JSON, then reconciles only the
 * slot-owned planning fields. Bridge import preserves the agent's hookPhrase
 * and emotionArc so the stored hook stays aligned with the generated lyrics;
 * songRole remains slot-owned because it controls playlist/opening structure.
 * Title behavior still follows titleMode: local mode forces the slot title,
 * while ai-creative mode trusts the imported title unless it is blank.
 */
function normalizeImportedSong(
  raw: unknown,
  index: number,
  slotByTrackNo: Map<number, PreassignedSongSlot>,
  titleMode: 'local' | 'ai-creative'
): NormalizeSuccess | NormalizeFailure {
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

  const rawSong: SongIdea = {
    trackNo: claimedTrackNo,
    title: String(obj.title),
    seasonMoment: isNonEmptyString(obj.seasonMoment) ? obj.seasonMoment : '',
    listenerSituation: isNonEmptyString(obj.listenerSituation) ? obj.listenerSituation : '',
    emotionArc: isNonEmptyString(obj.emotionArc) ? obj.emotionArc : '',
    hookPhrase: String(obj.hookPhrase),
    stylePrompt: String(obj.stylePrompt),
    lyrics: String(obj.lyrics),
    ...(isNonEmptyString(obj.thumbnailText) ? { thumbnailText: obj.thumbnailText } : {}),
    youtube,
    ...(isNonEmptyString(obj.youtubeTitleKo) ? { youtubeTitleKo: obj.youtubeTitleKo } : {}),
    ...(isNonEmptyString(obj.youtubeTitleJa) ? { youtubeTitleJa: obj.youtubeTitleJa } : {}),
    qualityScore: 0,
    warnings: []
  };
  return { song: reconcileWithPreassignedSlot(rawSong, slot, titleMode, { keepHook: true, keepEmotionArc: true }) };
}

export interface ImportSongsReport {
  blueprint: PlaylistBlueprint | null;
  importedCount: number;
  skippedCount: number;
  skippedReasons: string[];
  warnings: string[];
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
  preassignedSongs: PreassignedSongSlot[] = [],
  /** TASK v3.27 (Part A3) — the channel's cross-pack title history (same avoid.usedTitles the caller already fetched via hookLedger's safeAvoidSet for preallocateSongSlots), so an AI-creative title that happens to match an older pack's title still gets caught and uniquified. */
  avoidTitles: string[] = [],
  /** Channel hook history from hookLedger. Bridge imports warn on collisions but never rewrite hooks, because rewriting only hookPhrase would desync the lyrics. */
  avoidHooks: string[] = []
): ImportSongsReport {
  // TASK v3.27 (Part B1) — reproduced crash: importSongsJson accessed
  // season.label (and iterated genres/moods) unconditionally, so calling it
  // before a channel/season is actually selected threw instead of reporting
  // a clear reason. opts/genres/moods/season are typed as required, but a
  // real call site can still hand this an undefined/partial value at
  // runtime — guard defensively rather than trust the type alone.
  if (!season?.label || !opts?.channel || !Array.isArray(genres) || !Array.isArray(moods)) {
    return { blueprint: null, importedCount: 0, skippedCount: 0, skippedReasons: ['채널·시즌 설정을 먼저 선택한 뒤 가져오기를 실행하세요.'], warnings: [] };
  }

  let parsed: unknown;
  try {
    parsed = parseLeniently(rawText);
  } catch {
    return { blueprint: null, importedCount: 0, skippedCount: 0, skippedReasons: ['JSON을 해석하지 못했습니다 — 파일 내용이 올바른 JSON인지 확인하세요.'], warnings: [] };
  }

  const rawSongs = extractSongsArray(parsed);
  if (!rawSongs.length) {
    return { blueprint: null, importedCount: 0, skippedCount: 0, skippedReasons: ['"songs" 배열을 찾지 못했습니다.'], warnings: [] };
  }

  const titleMode = opts.titleMode ?? 'ai-creative';
  const slotByTrackNo = new Map(preassignedSongs.map(slot => [slot.trackNo, slot]));
  const validSongs: SongIdea[] = [];
  const skippedReasons: string[] = [];

  rawSongs.forEach((raw, index) => {
    const result = normalizeImportedSong(raw, index, slotByTrackNo, titleMode);
    if ('error' in result) {
      skippedReasons.push(result.error);
      return;
    }
    validSongs.push(result.song);
  });

  if (!validSongs.length) {
    return { blueprint: null, importedCount: 0, skippedCount: rawSongs.length, skippedReasons, warnings: [] };
  }

  // TASK B1 — "trackNo 재정렬(1..N 연속)": sort by each song's claimed
  // trackNo, then renumber sequentially so skipped/out-of-order entries never
  // leave gaps or duplicates in the final pack.
  validSongs.sort((a, b) => a.trackNo - b.trackNo);
  const renumbered = validSongs.map((song, idx) => ({ ...song, trackNo: idx + 1 }));

  const hookCollisionResult = flagHookCollisions(renumbered, avoidHooks);
  const scored = scoreSongs(hookCollisionResult.songs, opts.channel, opts.lyricLanguage);
  // TASK v3.27 (Part A3) — an AI-creative title wasn't locally pre-decided
  // (unlike hookPhrase), so two songs in this import — or this import
  // against an older pack's title history — can still collide; catch and
  // auto-uniquify it here, the same pass every generation path now runs.
  const { songs: deduped } = dedupeTitlesAcrossPack(scored, avoidTitles);
  const concept = opts.customConcept || `${opts.channel.name} ${season.label} playlist with ${genres.map(g => g.label).join(' + ')}`;
  const blueprint = buildSignatureBlueprint(opts, genres, moods, season, concept, deduped);

  // TASK v3.43 Part A4 — a bridge/coding-agent pack skips every real API
  // call's own per-request variation, so it's exactly the path most exposed
  // to a coding agent falling back to one template stylePrompt reused across
  // every track (see core/diversityLinter.ts's lintInPackStyleSimilarity —
  // the real bug it guards against measured a 90.3% average / 100% max
  // pairwise similarity). Previously this check only ran at display time in
  // Step4Result.tsx, after the import had already succeeded; running it here
  // surfaces the same warning in the import report itself, before the user
  // ever navigates away.
  const similarityReport = lintInPackStyleSimilarity(deduped.map(song => ({ trackNo: song.trackNo, stylePrompt: song.stylePrompt })));
  // TASK v3.43 Step 2 (Part A4) — "무엇이 고정돼 있는지 보이게": whenever the
  // linter actually has something to say, also surface exactly which
  // clauses are common to every song, so the warning isn't just "the pack
  // is too similar" with no lead on what to change.
  const commonClausesNote = (similarityReport.warnings.length || similarityReport.errors.length) && similarityReport.commonClauses.length
    ? [`Clauses common to every song in this pack: ${similarityReport.commonClauses.join(', ')}`]
    : [];

  return {
    blueprint,
    importedCount: deduped.length,
    skippedCount: rawSongs.length - deduped.length,
    skippedReasons,
    warnings: [...hookCollisionResult.warnings, ...similarityReport.warnings, ...similarityReport.errors, ...commonClausesNote]
  };
}
