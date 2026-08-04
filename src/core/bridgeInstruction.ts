import type {
  BatchContext,
  GenerationOptions,
  GenrePack,
  MoodPack,
  PreassignedSongSlot,
  SeasonPack
} from '../types';
import { ARRANGEMENT_DENSITY_TEXT_BY_LEVEL, buildSystemInstruction, buildUserInstruction, songOutputShape, structureTemplateLegend } from './promptComposer';
import { resolvePackagingLanguage } from './packagingLanguage';
import { preallocateSongSlots } from './batchPreallocation';
import { buildSetOptions } from './multiSetGeneration';
import { buildSetConceptLine } from './setConcept';
import { moneyChordPresets } from '../data/moneyChords';
import { decomposeArtistReferences, decomposedReferenceDescriptors, isSafeDecomposedReference } from './artistReferenceDecomposer';
import { ERA_FORBIDDEN_DESCRIPTORS, ERA_LABEL, eraBucketForGenreId, type EraBucket } from '../data/eraExclusions';
import { buildSetName } from '../utils/setNaming';
import { resolveConstraintsFromOptions, type ResolvedConstraints } from './constraints';
import { audienceProfileForAgeGroup } from '../data/audienceProfiles';
import { currentWorkspaceId } from './workspaceScope';
import { vocabularyBankById } from '../data/vocabularyBanks';

/**
 * v3.66 (TASK C) — split out of claudeCodeBridge.ts (was 1,207 lines, one of
 * the largest and most frequently revised files in src/core). This module is
 * the instruction-text half of the bridge: everything that turns a
 * GenerationOptions + preassigned slot plan into the one self-contained
 * prompt a coding agent (Claude Code, Codex, ...) can run directly. The
 * import-side parsing (songs-output.json -> SongIdea[]) lives in
 * bridgeImport.ts; the recompose-instruction builder lives in
 * bridgeRecompose.ts. claudeCodeBridge.ts re-exports all three so no other
 * file's import path needed to change. Pure move — no logic was altered.
 */

export const CLAUDE_CODE_BRIDGE_OUTPUT_FILENAME = 'songs-output.json';

/**
 * TASK v3.69 (TASK B/C) — every bridge output used to be named exactly this,
 * every time — no history, and a re-run silently overwrote the previous
 * set's lyrics (see this task's own §0 problem statement). Defaults every
 * new instruction to a dated, channel/concept-named path under `lyrics/`
 * instead (utils/setNaming.ts's buildSetName), while
 * CLAUDE_CODE_BRIDGE_OUTPUT_FILENAME above stays exported unchanged for any
 * caller that still wants the old flat name (bridgeRecompose.ts's "same
 * shape as songs-output.json" phrasing doesn't depend on the literal
 * filename, so it's untouched).
 */
export function defaultBridgeOutputPath(opts: Pick<GenerationOptions, 'channel' | 'customConcept' | 'projectTitle'>): string {
  const conceptLabel = opts.customConcept?.trim() || opts.projectTitle;
  return `lyrics/${buildSetName({ date: new Date(), channelLabel: opts.channel.name, conceptLabel })}.json`;
}

/**
 * TASK v3.69 (TASK D) — an optional top-level "meta" object for the bridge
 * output JSON. Every value here is already fixed by the app before the
 * agent ever runs, so the instruction just tells the agent to copy this
 * verbatim rather than compute anything — bridgeImport.ts reads it back
 * (when present) to auto-fill setName/channel/generatedAt on import, but a
 * file with no "meta" at all still imports exactly as before (this task
 * must not make meta required — see its own prohibitions section).
 */
function buildBridgeMeta(
  opts: Pick<GenerationOptions, 'channel' | 'customConcept' | 'projectTitle' | 'songCount' | 'lyricLanguage'>,
  outputFilename: string
) {
  const setName = outputFilename.replace(/^lyrics\//, '').replace(/\.json$/, '');
  return {
    setName,
    generatedAt: new Date().toISOString(),
    channelId: opts.channel.id,
    channelLabel: opts.channel.name,
    conceptLabel: opts.customConcept?.trim() || opts.projectTitle,
    songCount: opts.songCount,
    lyricLanguage: opts.lyricLanguage
  };
}

/**
 * TASK v3.64 (TASK C) — real measurement showed a 3rd recurrence of a BPM-
 * narrowing bug (app plans 62-112, stddev ~14; real output measured 94-106,
 * stddev 3.0) that v3.60 TASK C had already reportedly fixed once. Direct
 * investigation this time found the app's own plan (preallocateSongSlots)
 * and this instruction's own "use exactly that BPM... verbatim" line both
 * already correct on the current build — meaning the real narrow-output
 * report was very likely generated against an older build (before this
 * exact wording existed) or is residual LLM non-compliance despite a
 * correct instruction, not a live app bug to chase a 4th time. This
 * timestamp lets a future report be time-correlated against exactly which
 * build actually produced it, instead of re-investigating from zero again.
 */
function instructionBuildMarkerLine(): string {
  return `[Generated ${new Date().toISOString()} — bridge instruction schema v3.64]`;
}

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
  /**
   * v3.63 재작성 (TASK D) — SetDirector's own segment/listening-context
   * interpretation (see core/setDirector.ts's SetPlan), included as a
   * "[세그먼트 해석]"/"[청취 상황]" section when present. Optional and
   * additive: every existing caller that doesn't go through SetDirector
   * (multiSetGeneration.ts, Step3Generate.tsx, most tests) omits this and
   * gets the exact same instruction text as before.
   */
  setDirectorInterpretation?: {
    segments: SetDirectorSegmentLike[];
    listeningContext: SetDirectorListeningContextLike;
  };
  /**
   * v4.2 (TASK A3, TASK F) — carries the concept's own era/title/vocabulary
   * constraints (core/constraints.ts's ResolvedConstraints) into the bridge
   * instruction as constraints, never verbatim phrasing to transcribe — same
   * "작곡하라" trust model as buildSetDirectorInterpretationSection above
   * (see this task's own §7 "문구를 verbatim으로 강제하지 말고 제약으로
   * 전달합니다"). Optional — omitted by every caller that doesn't go through
   * core/setDirector.ts's resolveConstraints path yet.
   */
  resolvedConstraints?: ResolvedConstraints;
}

/**
 * TASK F (7) — real measurement: a concept used to reach only genre
 * selection; title/vocabulary/era never crossed into the actual composing
 * instruction at all. This section is the missing half — constraints, not
 * verbatim text, per this task's own "작곡하라" convention (v3.62).
 */
function buildResolvedConstraintsSection(constraints: ResolvedConstraints): string {
  const lines = ['[이 세트의 컨셉 제약]'];
  if (!constraints.era.unspecified) {
    const adjacentText = constraints.era.adjacent
      .map(adjacent => `${ERA_LABEL[adjacent.era]}은 최대 ${Math.round(adjacent.maxShare * 100)}%`)
      .join(', ');
    const forbiddenText = constraints.era.forbidden.map(bucket => ERA_LABEL[bucket]).join(', ');
    lines.push(
      `  시대   ${ERA_LABEL[constraints.era.primary]} 중심(전체의 최소 50%).` +
      (adjacentText ? ` ${adjacentText}.` : '') +
      (forbiddenText ? ` ${forbiddenText}는 이 세트에 쓰지 마십시오.` : '')
    );
  }
  lines.push(
    '  제목   문장형·호명형·한 단어형·질문형·감탄형 등 여러 형태를 섞으십시오.',
    `         이미지 조합형([형용사][명사], 예: "Fogged Window")은 세트 전체에서 최대 ${constraints.title.maxPerPattern}곡까지만 쓰십시오 — 모든 곡을 같은 형태로 짓지 마십시오.`
  );
  if (constraints.vocabulary.forbidden.length) {
    lines.push(`  금지   ${constraints.vocabulary.forbidden.join(', ')}`);
  }
  lines.push(
    `  어휘   같은 단어를 이 세트에서 ${constraints.vocabulary.maxRepeatPerWord}회 넘게 쓰지 마십시오` +
    `(채널 정체성 어휘${constraints.vocabulary.identityWords.length ? ` — ${constraints.vocabulary.identityWords.join(', ')}` : ''}는 ${constraints.vocabulary.identityMaxRepeat}회까지 허용).` +
    // TASK v4.6 (TASK E) — every/before/more are ordinary connector words an
    // LLM reaches for by default across many songs without noticing the
    // pack-wide total; a real pack hit 69 uses of "every" alone. Named
    // explicitly since the generic cap line above is easy to read as being
    // about content nouns only.
    ' 특히 every, before, more 같은 단어를 여러 곡에 걸쳐 반복하지 마십시오.' +
    // TASK v4.8 (TASK C) — same fix, a new set of real offenders: a senior-
    // morning pack still hit 48회 (quiet) / 45회 (feel) / 34회 (light,
    // evening) after v4.6's every/before/more fix — these are mood/scene
    // words an LLM reaches for by default for this channel's own "quiet
    // morning reflection" register, same blind spot as before, just a
    // different word class. Named explicitly rather than doing v4.5's
    // vocabulary-bank rewrite (out of this task's own scope — "v4.5(어휘
    // 뱅크)를 이번에 하지 말 것. 지시문 문구만 강화합니다").
    ' 특히 quiet, feel, light, evening, morning 을 여러 곡에 걸쳐 반복하지 마십시오.'
  );
  return lines.join('\n');
}

/**
 * v3.63 재작성 (TASK D) — a structural (not imported-type) mirror of
 * core/setDirector.ts's SetSegment/ListeningContext. Kept as a local
 * interface rather than `import type { SetSegment } from './setDirector'`
 * so this module's own dependency graph doesn't gain a new edge toward
 * setDirector.ts (which itself depends on a long chain of core/* modules);
 * TypeScript's structural typing means any real SetSegment/ListeningContext
 * value already satisfies this shape with no adapter needed.
 */
interface SetDirectorSegmentLike {
  label: string;
  songCount: number;
  genreIds: string[];
  eraTag: string;
  descriptors: string[];
}

interface SetDirectorListeningContextLike {
  settingKo: string;
  dynamicCeiling: 'low' | 'medium' | 'wide';
  tempoHint?: [number, number];
  extraExclusions: string[];
}

/**
 * TASK D (5-2) — one segment per line, its own descriptors (already
 * safety-checked artist-name-free by setDirector.ts's own decomposition/
 * blending — never the segment label alone, which could theoretically be
 * "카펜터스풍" for display purposes only). The "그대로 쓸 필요 없습니다"
 * reminder matches this file's existing reference-not-verbatim convention
 * (see hookDeviceInstructionLineFor et al.).
 */
function buildSetDirectorInterpretationSection(segments: SetDirectorSegmentLike[], listeningContext: SetDirectorListeningContextLike): string {
  const segmentLines = segments.map(segment => `  ${segment.label} (${segment.songCount}곡): ${segment.descriptors.length ? segment.descriptors.join(', ') : segment.eraTag}`);
  const lines = [
    '[세그먼트 해석]',
    ...segmentLines,
    '  ※ 이 서술어를 그대로 쓸 필요 없습니다. 이 사운드를 이해하고 작곡하십시오.'
  ];
  const hasListeningContext = listeningContext.settingKo && listeningContext.settingKo !== '특별한 청취 상황 지정 없음';
  if (hasListeningContext) {
    const ceilingKo = { low: '낮게', medium: '보통으로', wide: '넓게' }[listeningContext.dynamicCeiling];
    const tempoNote = listeningContext.tempoHint ? ` 템포는 ${listeningContext.tempoHint[0]}-${listeningContext.tempoHint[1]} BPM 대역을 우선하십시오.` : '';
    const exclusionNote = listeningContext.extraExclusions.length ? ` ${listeningContext.extraExclusions.join(', ')}은(는) 피하십시오.` : '';
    lines.push(
      '',
      '[청취 상황]',
      `  ${listeningContext.settingKo} — 다이내믹을 ${ceilingKo} 유지하십시오.${tempoNote}${exclusionNote}`
    );
  }
  return lines.join('\n');
}

function buildBridgePayload(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  avoid: { usedTitles?: string[]; usedHooks?: string[] } | undefined,
  preassignedSongs: PreassignedSongSlot[],
  generateThumbnailText: boolean,
  outputFilename?: string
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
  const packagingLanguage = resolvePackagingLanguage(opts);
  return {
    batch,
    payload: {
      ...basePayload,
      preassignedSongs,
      outputShape: { songs: [songOutputShape(generateThumbnailText, packagingLanguage)] },
      ...(outputFilename ? { meta: buildBridgeMeta(opts, outputFilename) } : {})
    }
  };
}

/**
 * v3.75 (TASK D-3) — real measurement: 18/18 real titles were an
 * "[adjective] [noun]" image pair, none matching their own song's hook,
 * even though the hooks themselves ("Hold My Hand, Friend", "I Still
 * Believe", "I'm Coming Home") already read exactly like real 1960s/70s pop
 * titles. Traced to this line's own old wording — "never a restatement of
 * the hook" — which flatly forbade the single most common title shape for
 * that era (many 1960s-70s pop songs share their title with their hook or
 * chorus line verbatim: a title IS often just its hook). Now explicitly
 * allows and asks for a genuine mix instead of a blanket ban.
 */
function titleInstructionLineFor(opts: GenerationOptions): string {
  const titleMode = opts.titleMode ?? 'ai-creative';
  return titleMode === 'local'
    ? '- "preassignedSongs" gives local planning slots. Copy the preassigned title in local title mode, but the final "hookPhrase" you write must exactly match the hook line repeated in that song\'s lyrics; never let the JSON hook and chorus hook diverge.'
    : '- "preassignedSongs" gives local planning slots and fallback placeholders. You may use the slot hook or write a new original hook, but the final "hookPhrase" must exactly match the hook line that opens and closes every chorus in that song\'s lyrics. For the TITLE, use a genuine MIX of shapes across this pack, not one formula repeated on every song: for at least a third of the songs, the title should simply BE the hook line itself (or a near-verbatim variant of it) — this is the single most common title shape in real pop songs of this kind, especially older-pop eras, and titles that never match their own hook read as artificial. For the rest, write independent Billboard Hot 100-style titles: single striking words, unexpected concrete nouns, short metaphors, or evocative images. Never default to the same "[adjective] [noun]" image-pair shape for every song regardless of which approach you pick — vary the shape itself (a short phrase, a question, a name being addressed, a single word) as much as whether it matches the hook.';
}

/**
 * v4.3 (TASK A) — "한글 채널을 하면 영어제목(한글제목), 일본 채널을 하면
 * 영어제목(일본제목) 이렇게 표시됐으면 해. 그냥 직역하지 말고 올드팝
 * 채널이면 올드팝 채널 감성에 맞는 제목으로 해줘야 돼" (하루님). v3.62's own
 * "작곡하라" convention: this asks for intent (reinterpret the scene/
 * emotion), never a phrase to transcribe verbatim, matching every other
 * *InstructionLineFor function in this file. Returns '' for English
 * packaging — nothing to ask for.
 */
function titleLocalizedInstructionLineFor(opts: GenerationOptions): string {
  const packagingLanguage = resolvePackagingLanguage(opts);
  if (packagingLanguage === 'english') return '';
  const languageName = packagingLanguage === 'korean' ? 'Korean' : 'Japanese';
  const eraHint = opts.channel.archetype === 'senior-morning' || opts.channel.archetype === 'showa-70s' || opts.channel.archetype === 'oldpop-lounge'
    ? (packagingLanguage === 'korean'
      ? 'Reference the tone of 1970s-80s Korean 가요 (歌謡) titles — phrases like "그 시절", "~하던 날", "잊지 못할", "다시 만나면".'
      : 'Reference the tone of Showa-era (昭和) Japanese song titles — quiet, image-based, never a loanword transliteration.')
    : opts.channel.archetype === 'kids'
      ? (packagingLanguage === 'korean' ? 'Use simple words and onomatopoeia a young child understands.' : 'Use simple words and onomatopoeia a young child understands.')
      : (packagingLanguage === 'korean'
        ? 'Reference the tone of contemporary Korean pop/indie song titles.'
        : 'Reference the tone of contemporary Japanese pop song titles.');
  const lengthHint = packagingLanguage === 'korean' ? '3-10 characters (a short phrase, not a sentence)' : '3-12 characters (a short phrase, not a sentence)';
  return [
    '[제목] Title localization:',
    `  - Along with the English "title", write a "titleLocalized" field: a natural, idiomatic ${languageName} song title.`,
    '  - DO NOT translate the English title\'s words. Read this song\'s "listenerSituation" and "emotionArc" and re-express that scene/feeling as its own original ' + languageName + ' title — the kind a native speaker would actually give this song, not a rendering of the English one.',
    `  - ${eraHint}`,
    `  - Keep it to roughly ${lengthHint} — long titles get truncated in thumbnails and lists.`,
    packagingLanguage === 'korean'
      ? '  - Never write it as a phonetic transliteration of the English words (e.g. writing "Blue Cup" as "블루 컵") — that is not localization.'
      : '  - Never write it as a katakana phonetic transliteration of the English words (e.g. writing "Blue Cup" as "ブルーカップ") — that is not localization.',
    '  - Example: "title": "Blue Cup", "titleLocalized": "식어가는 찻잔" (NOT "파란 컵" — that is a literal translation, not a reinterpretation).',
    '  - This titleLocalized value is for on-screen display only; it is never pasted into Suno\'s own title field (which stays the plain English "title" — no parentheses).'
  ].join('\n');
}

// TASK v3.43 Part A2 — same forced-verbatim BPM instruction promptComposer.ts's
// buildBatchSystemNote now gives real API requests (kept in sync here per this
// file's existing convention — see titleInstructionLineFor's comment above):
// "tempo" was previously only a fallback-suggestion field, never enforced.
function tempoInstructionLine(): string {
  return '- Each "preassignedSongs" entry also includes "tempo" - use exactly that BPM number in that song\'s stylePrompt (e.g. "96 BPM"), verbatim. Do not invent a different tempo.';
}

/**
 * v3.82 (TASK B) — real measurement: a 81 BPM track ran 4:16 against a
 * 3:15-3:35 target while carrying almost the exact same word count as two
 * other tracks at the same tempo that landed 3:30/3:58 — the actual
 * difference was 9 sections + 2 instrumental-type sections vs 8+1. A slow
 * tempo makes every section audibly LONGER in real time even at a flat word
 * count, so the "Length target" column (see perTrackPlanTable above) scales
 * both section count AND instrumental-section count with each track's own
 * BPM, not just word count. CRITICAL-prefixed and placed right next to the
 * existing CRITICAL tempo line (same reasoning as that line's own doc
 * comment: a rule buried 1000+ lines into a real 18-song instruction gets
 * missed).
 */
function songLengthInstructionLine(): string {
  return 'CRITICAL — length: each track\'s "Length target" column above gives that track\'s own section count, word count, and maximum instrumental-only-section count (counting the intro if it has no lyrics) — these already account for that track\'s own tempo (a slower BPM gets a SHORTER structure so the clock-time length still lands in the pack\'s target range). These are hard limits, not suggestions: going over the word/section count is a failure condition for that track, the same as missing its hookPhrase or tempo. Do not add an extra instrumental break, extended outro, or additional section beyond what that count allows just because the tempo feels slow, and do not pad a slow track\'s lyrics past its word ceiling because it "feels short on the page" — a short lyric at a slow tempo is correct, not unfinished; a slow track staying within its own target is what keeps it from running long.';
}

/**
 * TASK v4.11 (TASK A) — real measurement: even with the "Length target"
 * table column above and the CRITICAL line right next to it, a real
 * composed 18-song pack still violated 14/18 tracks, worst on the SLOWEST
 * tracks specifically (a 71 BPM track measured 220 words against a 165-185
 * target — 35 words over). The table cell and the generic CRITICAL line
 * both state the numbers once, in passive voice, with no per-track
 * reasoning, buried among ~20 other CRITICAL-prefixed rules in a long
 * instruction — easy to skim past. This adds one explicit callout per
 * slow-tier track (<=78 BPM, core/bpmLengthControl.ts's own slowest tier and
 * the one that measured worst) naming that track's own real BPM and the
 * concrete real-world consequence of ignoring its target ("40% longer at
 * the same word count") rather than just repeating the same bare numbers a
 * third time — a number with no reason attached is what got ignored before.
 */
function slowTrackLengthCallouts(slots: PreassignedSongSlot[]): string[] {
  const SLOW_TIER_MAX_BPM = 78;
  const slowSlots = slots.filter(slot => slot.tempo <= SLOW_TIER_MAX_BPM && slot.sectionCountRange && slot.wordCountRange);
  if (!slowSlots.length) return [];
  return [
    '',
    '[Slow-tempo tracks — read before writing these]',
    ...slowSlots.map(slot => {
      const [sMin, sMax] = slot.sectionCountRange!;
      const [wMin, wMax] = slot.wordCountRange!;
      return `- Track ${slot.trackNo} is slow — ${slot.tempo} BPM. At this tempo, the exact same section/word count as a faster track renders roughly 40% longer in real clock time; this is the actual, measured cause of past overlong renders, not a guess. MUST stay at ${sMin}-${sMax} sections and ${wMin}-${wMax} words for this track specifically. Do not add a section or extend a verse to make it "feel" like a complete song — at this tempo, ${wMin}-${wMax} words already fills the pack's target song length.`;
    })
  ];
}

// TASK v3.62 (TASK 1-1) — was "weave that exact phrase into that song's
// stylePrompt, verbatim." A real 1960s-flavored bridge pack got "warm
// string pad swell" and "layered backing" — production textures that
// didn't exist in that era — because the agent obeyed this line literally
// instead of using its own musical knowledge. introTextureText/
// instrumentSet/arrangementDensity/hookDeviceText/genreText are now
// reference information ("this channel usually sounds like...") instead
// of a verbatim requirement; the agent composes, it doesn't transcribe.
// tempo/structureTemplate/lyricThemeText/pov (below) are UNCHANGED and stay
// verbatim-required — those are app-planned structural determinism (this
// task's own "유지할 결정론" list), not stylistic wording.
function introTextureInstructionLineFor(preassignedSongs: PreassignedSongSlot[]): string {
  return preassignedSongs.some(slot => slot.introTextureText)
    ? '- Each "preassignedSongs" entry may include "introTextureText" - a REFERENCE for the kind of instrumental color this channel often opens with (intro-only, first ~5 seconds), not a phrase to copy. If it fits this song\'s genre/era, use it or something like it; if it doesn\'t (e.g. a synth texture suggested for a 1960s track), use your own musical judgment for an era-appropriate substitute instead. Never let it become the whole-song arrangement.'
    : '';
}

function negativeStyleInstructionLineFor(preassignedSongs: PreassignedSongSlot[]): string {
  return preassignedSongs.some(slot => slot.negativeStyleText)
    ? '- Keep "negativeStyleText" separate: do not put it in stylePrompt; the app exports it to Suno Exclude styles.'
    : '';
}

function genreInstructionLineFor(preassignedSongs: PreassignedSongSlot[]): string {
  return preassignedSongs.some(slot => slot.genreText)
    ? '- Each "preassignedSongs" entry also includes "genreText" - the genre/sub-style identity this track must stay recognizably within (do not substitute a different genre or the pack-level genre list). The exact wording is a reference, not a script: compose your own stylePrompt description of this genre rather than copying the phrase verbatim.'
    : '';
}

// TASK v3.62 (TASK 1-1) — instrumentSet/arrangementDensity are now the
// channel's typical instrumentation/density as reference, not a checklist
// every song must weave in verbatim (see introTextureInstructionLineFor's
// comment for why).
function instrumentInstructionLineFor(preassignedSongs: PreassignedSongSlot[]): string {
  return preassignedSongs.some(slot => slot.instrumentSet?.length)
    ? '- Each "preassignedSongs" entry may include "instrumentSet" — 2-3 instruments typical for this channel/genre, as REFERENCE, not a checklist to weave in verbatim. Use them if they suit this song\'s era and genre; substitute an era-appropriate equivalent if they don\'t (e.g. don\'t put a Rhodes electric piano in a 1962 doo-wop track just because instrumentSet suggested one for a different, later-era genre). Compose the instrumentation your own musical knowledge says is right for this song.'
    : '';
}

// v4.4 (TASK B) — this prohibition never actually existed in the bridge
// instruction (a real imported pack sang its own arrangement/production
// notes: "Spiccato strings flicker over quiet water", "The straight-pop
// drums move softly" — see data/arrangementVocabulary.ts's own doc comment
// for the fuller history). instrumentSet/arrangementDensity/hookDeviceText
// above are explicitly meant for the STYLE PROMPT only; nothing told the
// agent those same words could never be the LYRIC's grammatical subject.
// Added as a fixed CRITICAL line (not conditional on any one preassigned
// field) since it applies regardless of which of those fields this pack
// happens to use.
const ARRANGEMENT_VOCABULARY_LYRIC_PROHIBITION_LINE =
  '- CRITICAL: instrument/arrangement/production terms (guitar, strings, drums, piano, horns, reverb, stop-time, etc.) belong in the stylePrompt only. Never make one of these words the grammatical subject or actor of a lyric line (e.g. "the guitar keeps walking", "the strings will hold it tight") — lyrics describe feeling, scene, and people, not the arrangement performing itself. It is fine for a lyric to mention an instrument as an object a person interacts with ("I still play my father\'s guitar").';

function arrangementDensityInstructionLineFor(preassignedSongs: PreassignedSongSlot[]): string {
  return preassignedSongs.some(slot => slot.arrangementDensity)
    ? `- Each "preassignedSongs" entry may include "arrangementDensity" (one of sparse/medium/full) — a REFERENCE point for how full this song's arrangement should feel (sparse ~ "${ARRANGEMENT_DENSITY_TEXT_BY_LEVEL.sparse}"; medium ~ "${ARRANGEMENT_DENSITY_TEXT_BY_LEVEL.medium}"; full ~ "${ARRANGEMENT_DENSITY_TEXT_BY_LEVEL.full}"). Aim for that general density in your own words; you do not need to use this phrasing.`
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

/**
 * v4.5 (TASK A/B) — real measurement: a concept like "젊은 시절 춤추던 토요일
 * 밤" (a young Saturday night spent dancing) correctly assigned the
 * senior-saturday-dance-hall theme (scene: "spinning across a crowded dance
 * hall floor..."), but the ACTUAL sung lyrics still came back quiet and
 * solitary — a real Codex-bridge pack's top vocabulary was quiet/strum/
 * worn/guitar/strings, nothing danced. Root cause (this task's own TASK A
 * investigation): the old instruction below told the agent to use
 * lyricThemeText as "the song's primary lyric situation" — which the agent
 * apparently read as "fill in the listenerSituation JSON field", not
 * "the actual verses/chorus must depict this scene" — nothing told it NOT
 * to fall back to this app's own generic quiet-imagery default. Rewritten
 * to say explicitly that the LYRICS THEMSELVES (not just a metadata field)
 * must depict the scene, and to explicitly forbid the quiet-alone default.
 * See lyricThemeSceneSection below for the actual per-track scene block —
 * this line now just points at it instead of repeating scene text inline.
 */
function lyricThemeInstructionLineFor(preassignedSongs: PreassignedSongSlot[]): string {
  return preassignedSongs.some(slot => slot.lyricTheme || slot.lyricThemeText)
    ? '- Each "preassignedSongs" entry also includes "lyricThemeText" (and, for some tracks, "lyricThemeArc") - see the "[Lyric scenes]" section below for the full scene per track. This is not just a "listenerSituation" field to fill in: the actual sung verses/chorus of that song must depict this specific scene and its stated motion/energy, not a generic scene of your own choosing. Do not quote lyricThemeText verbatim as lyrics; write it out as a real scene in your own words. If "lyricThemeArc" is present, use it as the lyric emotional turn.'
    : '';
}

/** v4.5 (TASK B) — data/lyricThemes.ts's motionKo/castKo/eraSettingKo are short Korean axis labels (originally v3.64 "allocation diversity metadata only" — see that file's own field doc comment), not English prose; this is the fixed vocabulary actually in use across the theme pool today, so an English-reading bridge agent gets real words instead of untranslated Korean. Falls back to passing the raw Korean through for any label not yet in this map (e.g. a future theme entry), which is still better than silently dropping the axis. */
const SCENE_AXIS_LABEL_EN: Record<string, string> = {
  '계절이 바뀌는 순간': 'a change of season',
  '둘': 'two people',
  '여럿': 'a group',
  '오래전과 지금': 'long ago and now',
  '이동 중': 'in motion, traveling',
  '이동 중(기차)': 'traveling by train',
  '이동 중(드라이브)': 'traveling by car, a drive',
  '이동 중(차)': 'traveling by car',
  '이동(이별)': 'traveling, a parting',
  '젊은 날': 'younger days',
  '젊은 날 도시': 'younger days, in the city',
  '젊은 날 여름': 'younger days, summer',
  '젊은 날 여행': 'younger days, traveling',
  '정적': 'stillness',
  '정적(식탁)': 'stillness, at the table',
  '정적(준비)': 'stillness, getting ready',
  '정적(춤)': 'stillness before the dance',
  '춤': 'dancing',
  '현재': 'the present day',
  '혼자': 'alone',
  '혼자(기다리는)': 'alone, waiting',
  '혼자(여행)': 'alone, traveling',
  '혼자(준비)': 'alone, getting ready',
  '혼자(편지를 보내는)': 'alone, writing a letter'
};

function sceneAxisEn(labelKo: string | undefined): string | undefined {
  if (!labelKo) return undefined;
  return SCENE_AXIS_LABEL_EN[labelKo] ?? labelKo;
}

/**
 * v4.5 (TASK B, 2-2) — one block per track that has a lyricTheme, spelling
 * out the scene/arc/motion/cast/era-setting axes and ending with the exact
 * "do not default to quiet and alone" guardrail this task's own spec calls
 * for verbatim (§2-2's own "혼자 조용히 무언가를 바라보는 장면으로 바꾸지
 * 마십시오" — this app's default lyric imagery skews toward exactly that
 * shape, so a concept that explicitly asks for motion/energy needs an
 * explicit override, not just a positive description it can partially
 * ignore).
 */
function lyricThemeSceneSection(preassignedSongs: PreassignedSongSlot[]): string[] {
  const withScene = preassignedSongs.filter(slot => slot.lyricThemeText);
  if (!withScene.length) return [];
  const lines = withScene.flatMap(slot => {
    const axisParts = [
      slot.lyricThemeEraSettingKo ? `time: ${sceneAxisEn(slot.lyricThemeEraSettingKo)}` : '',
      slot.lyricThemeCastKo ? `cast: ${sceneAxisEn(slot.lyricThemeCastKo)}` : '',
      slot.lyricThemeMotionKo ? `motion: ${sceneAxisEn(slot.lyricThemeMotionKo)}` : ''
    ].filter(Boolean).join(' / ');
    return [
      `  Track ${slot.trackNo}: ${slot.lyricThemeText}`,
      slot.lyricThemeArc ? `    emotional turn: ${slot.lyricThemeArc}` : '',
      axisParts ? `    ${axisParts}` : ''
    ].filter(Boolean);
  });
  return [
    '',
    '[Lyric scenes] - write THIS scene into each track\'s actual verses/chorus, in your own words (never quote the description verbatim as a lyric line). Do NOT default to a quiet, solitary "watching something alone" scene for these tracks even if that is this app\'s usual mood elsewhere in the pack - if a scene names motion (dancing, driving, traveling) or more than one person present, the lyrics must show that motion/energy/company, not replace it with stillness or solitude.',
    ...lines
  ];
}

/**
 * v4.5 (TASK C, 3-3) — per-track "words to use / avoid", from the bank
 * data/vocabularyBanks.ts's vocabularyBankForScene already matched this
 * track to at design time (see batchPreallocation.ts/localGenerator.ts's
 * own vocabularyBankId field). This is the actual "connect the bank to
 * generation" step this task's own §0-3 found missing — the banks existed
 * (v4.2) but nothing fed them into a generation prompt until this line.
 * The "do not just list these words" caveat is this task's own explicit
 * §3-3 requirement ("그대로 나열하지 말고 이 세계의 언어로 자연스러운 가사를
 * 쓰십시오") — without it, a real risk is a lyric that reads like a word
 * bank dumped into sentence shape rather than an actual song.
 */
function vocabularyBankInstructionLineFor(preassignedSongs: PreassignedSongSlot[]): string[] {
  const withBank = preassignedSongs.filter(slot => slot.vocabularyBankId);
  if (!withBank.length) return [];
  const lines = withBank.map(slot => {
    const bank = vocabularyBankById(slot.vocabularyBankId!);
    if (!bank) return '';
    const use = [...bank.nouns.slice(0, 4), ...bank.verbs.slice(0, 3), ...bank.adjectives.slice(0, 3)].join(', ');
    const avoidWords = bank.avoid.length ? ` | avoid: ${bank.avoid.join(', ')}` : '';
    return `  Track ${slot.trackNo}: ${use}${avoidWords}`;
  }).filter(Boolean);
  if (!lines.length) return [];
  return [
    '',
    '[Vocabulary per track] - REFERENCE word lists matched to each track\'s own scene, not a checklist. Do NOT just list these words in a row or force all of them in - write natural, singable lyrics in your own words that happen to live in this same vocabulary world. A lyric that reads like a word list stitched together is worse than one that uses none of these words but still captures the scene. Where an "avoid" list is given, steer away from those words for this specific track (they belong to a different mood this scene isn\'t).',
    ...lines
  ];
}

/**
 * v4.5 (TASK B, 2-3) — set-wide motion/cast/era-setting counts, so the
 * agent sees it's writing a MIX of scene shapes across the pack, not just
 * one track's own scene in isolation (this task's own §2-3 "전부 혼자
 * 정적으로 만들지 마십시오"). Tracks with no theme/axis data at all are
 * simply excluded from that axis's tally, not counted as any bucket.
 */
function sceneAxisDistributionLine(preassignedSongs: PreassignedSongSlot[]): string {
  const tally = (extract: (slot: PreassignedSongSlot) => string | undefined) => {
    const counts = new Map<string, number>();
    for (const slot of preassignedSongs) {
      const value = extract(slot);
      if (!value) continue;
      const en = sceneAxisEn(value) ?? value;
      counts.set(en, (counts.get(en) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, count]) => `${label} ${count}`).join(', ');
  };
  const motion = tally(slot => slot.lyricThemeMotionKo);
  const cast = tally(slot => slot.lyricThemeCastKo);
  const era = tally(slot => slot.lyricThemeEraSettingKo);
  if (!motion && !cast && !era) return '';
  const parts = [
    motion ? `motion: ${motion}` : '',
    cast ? `cast: ${cast}` : '',
    era ? `time setting: ${era}` : ''
  ].filter(Boolean);
  return `Scene mix across this pack - ${parts.join(' | ')}. Keep this mix - do not flatten every track without an explicit motion/cast axis into the same quiet-alone shape either.`;
}

function povInstructionLineFor(preassignedSongs: PreassignedSongSlot[]): string {
  return preassignedSongs.some(slot => slot.pov)
    ? '- Each "preassignedSongs" entry also includes "pov" - write that song\'s lyrics from that exact point of view; do not substitute a different narrator perspective.'
    : '';
}

function sectionStyleInstructionLineFor(preassignedSongs: PreassignedSongSlot[]): string {
  return preassignedSongs.some(slot => slot.verseStyleText || slot.chorusStyleText)
    ? '- Each "preassignedSongs" entry also includes "verseStyleText" and "chorusStyleText" - write verse sections and chorus sections with those distinct approaches, verbatim as guidance. Do not let every song start with the same first-line shape or every chorus use the same sentence structure.'
    : '';
}

// TASK v3.62 (TASK 1-1) — moneyChordText is "<progression name> - <reinforcement
// phrase>" (core/soundSignature.ts's compactMoneyChord). The progression
// ITSELF (e.g. "I-V-vi-IV") is app-planned harmonic determinism and stays
// required; the reinforcement phrase after " - " ("gentle rocking sway,
// deeply nostalgic...") is stylistic wording, now reference-only like the
// other fields above.
function progressionNameOnly(moneyChordText: string): string {
  return moneyChordText.split(' - ')[0].trim();
}

function moneyChordInstructionLineFor(preassignedSongs: PreassignedSongSlot[]): string {
  const example = preassignedSongs.find(slot => slot.moneyChordText)?.moneyChordText;
  if (!example) return '';
  const progression = progressionNameOnly(example);
  return `- Each "preassignedSongs" entry also includes "moneyChordText" ("<progression> - <descriptive phrase>", e.g. "${example}"). Use the exact chord progression before the " - " in that song's stylePrompt (e.g. track's progression here would be "${progression}") — that harmonic choice is fixed by the app. The descriptive phrase after " - " is reference flavor, not required wording; describe the chorus lift/feel in your own words if you have a better one for this song's era and genre.`;
}

// TASK v3.62 (TASK 1-1) — was "weave that exact phrase... verbatim... never
// reuse the same device text word-for-word across two songs." Now a
// concept reference (the KIND of arrangement-contrast moment, e.g.
// stop-time/key-change/breakdown) rather than required wording — the
// "never reuse the same text" rule is now moot by construction, since nothing
// forces every song toward the same fixed phrase pool anymore.
function hookDeviceInstructionLineFor(preassignedSongs: PreassignedSongSlot[]): string {
  return preassignedSongs.some(slot => slot.hookDeviceText)
    ? '- Each "preassignedSongs" entry may include "hookDeviceText" — a REFERENCE arrangement-contrast idea for this song (stop-time, key change, breakdown, etc), not required wording. Use it, an era-appropriate variant of it, or a different device entirely if you have a better one for this specific song — just make sure the chorus doesn\'t feel static.'
    : '';
}

/**
 * TASK v3.64-B — same reference-not-verbatim pattern as
 * hookDeviceInstructionLineFor above. Real measurement: earworm mode's old
 * flat instruction ("include 'simple stepwise melody' and 'singalong-
 * friendly hook'") put that literal phrase pair in 18/18 songs' style
 * prompts in a real pack. Each song now gets its own assigned melodic-design
 * reference instead.
 */
function earwormInstructionLineFor(preassignedSongs: PreassignedSongSlot[]): string {
  return preassignedSongs.some(slot => slot.earwormText)
    ? '- Each "preassignedSongs" entry may include "earwormText" — a REFERENCE melodic-design idea for this song (not required wording, not a specific song/artist). Reflect that design in your own words rather than copying the phrase, and make sure no two songs in this set read as the same melodic-construction technique.'
    : '';
}

/**
 * TASK v4.11 (TASK B) — real waveform measurement: tracks 1-3's first 15
 * seconds rendered ~3.7dB quieter than that same track's own full-song
 * average (worst -4.5dB), even with an opening hook already in place — a
 * hook says WHAT the track opens with, never HOW LOUD, and Suno tends to
 * render an intro quietly by default regardless of content. Same
 * reference-not-verbatim pattern as hookDeviceInstructionLineFor: adapt the
 * wording if needed, but the LEVEL it describes (full from the first bar,
 * no quiet fade-in) must survive. Tracks 1-3 only, by construction
 * (openingLoudnessText is never set beyond track 3) — applying this to
 * every track would flatten the pack's own back-half dynamic build.
 */
function openingLoudnessInstructionLineFor(preassignedSongs: PreassignedSongSlot[]): string {
  return preassignedSongs.some(slot => slot.openingLoudnessText)
    ? '- Each of tracks 1-3\'s "preassignedSongs" entry may include "openingLoudnessText" — this track\'s opening must play at FULL playback level from the very first bar, not a quiet fade-in or a hushed intro that builds up. Weave that idea (in your own words, or close to the given phrase) into this track\'s stylePrompt alongside its opening-hook descriptor. This is about mix LEVEL, not emotional intensity — a lyrically quiet/reflective opening still needs to render at full volume; do not apply this phrase to any track beyond 1-3, which would flatten the pack\'s own back-half dynamic build.'
    : '';
}

/**
 * TASK v3.62 (TASK 1-2) — anachronism guardrail. Consolidated into one
 * bullet (grouped by era, listing affected track numbers) rather than
 * repeated per-song, to keep the instruction's overall length reasonable.
 * Reads from src/data/eraExclusions.ts, the same table
 * core/compositionScorer.ts's blocking check reads — the two stay in sync
 * by construction (this is prevention; the scorer is detection).
 */
function eraGuardrailLines(preassignedSongs: PreassignedSongSlot[]): string[] {
  const byBucket = new Map<EraBucket, number[]>();
  for (const slot of preassignedSongs) {
    const bucket = eraBucketForGenreId(slot.genreId);
    if (!bucket || bucket === 'timeless') continue;
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), slot.trackNo]);
  }
  if (!byBucket.size) return [];
  const rows = [...byBucket.entries()].map(([bucket, trackNos]) => {
    const forbidden = ERA_FORBIDDEN_DESCRIPTORS[bucket];
    return `  Tracks ${trackNos.join(', ')} (${ERA_LABEL[bucket]}): do not use ${forbidden.map(term => `"${term}"`).join(', ')} — anachronistic for this era.`;
  });
  return [
    '- CRITICAL — era authenticity: some tracks in this pack are era-specific old-pop genres. A song\'s stylePrompt must never describe production/instrumentation that did not exist yet (or was long obsolete) in that track\'s era. Specifically:',
    ...rows,
    '  If you are unsure whether something fits an era, choose the more conservative, clearly-period-appropriate option.'
  ];
}

/** TASK v3.62 (TASK 1-2/2-2) — Suno reads stylePrompt as a descriptor list, not prose; a real pack measured 106 comma-separated descriptors in one stylePrompt because the old approach had to fill every protected/essential atom regardless of whether the song needed it. */
function descriptorCountInstructionLine(): string {
  return '- stylePrompt must be a comma-separated list of roughly 25-35 short descriptors (genre, era, instruments, rhythm feel, harmony color, vocal description, tempo, structure/production notes) — not full sentences and not padded to hit a fixed checklist. Write only what is musically true and useful for THIS song; stop once you have described it well, even if that is fewer than 35 descriptors.';
}

/**
 * TASK v3.71 (TASK B) — real measurement: a generated bridge instruction
 * (97,378 chars) had ZERO mentions of "Male Vocal"/"duet"/"vocalType",
 * despite v3.70 adding a conditional instruction line for exactly this.
 * That line only fired when `preassignedSongs.some(slot => slot.vocalGender
 * === 'duet')` — a narrower check than it looks: vocalGender is only ever
 * set to 'duet' when either the manual per-track vocalType quota assigns
 * 'mixed', or matchVocalPreset(vocalText) finds an EXACT string match
 * against one of vocalPresets.ts's two hard-coded duet prompts — a real
 * duet vocalText can easily be one of ADULT_VOCAL_DESCRIPTIONS.mixed's 4
 * OTHER rotating wordings and silently fail that exact-match check, leaving
 * vocalGender undefined even though the song is unmistakably a duet.
 *
 * Rather than keep chasing every way vocalGender inference can miss, this
 * renders an explicit, always-present per-track vocal composition table
 * (never gated behind a single fragile boolean), with detection that
 * accepts either the inferred vocalGender OR the literal word "duet"
 * appearing anywhere in vocalText as a directly-visible fallback signal.
 */
function isDuetSlot(slot: PreassignedSongSlot): boolean {
  return slot.vocalGender === 'duet' || /\bduet\b/i.test(slot.vocalText ?? '');
}

function vocalCompositionLabel(slot: PreassignedSongSlot): string {
  if (isDuetSlot(slot)) return 'Male-Female Duet';
  if (slot.vocalGender === 'male' || slot.vocalType === 'male') return 'Male Solo';
  if (slot.vocalGender === 'female' || slot.vocalType === 'female') return 'Female Solo';
  if (slot.vocalGender === 'mixed' || slot.vocalType === 'mixed') return 'Mixed Group/Choir';
  return 'Solo (see this track\'s own vocalText)';
}

function vocalCompositionSection(preassignedSongs: PreassignedSongSlot[]): string {
  const rows = preassignedSongs.map(slot => `  Track ${slot.trackNo}: ${vocalCompositionLabel(slot)}`);
  const hasDuet = preassignedSongs.some(isDuetSlot);
  const lines = ['[This set\'s vocal composition]', ...rows];
  if (hasDuet) {
    lines.push(
      '',
      '[Duet track rule — REQUIRED for every track marked "Male-Female Duet" above]',
      'Mark who sings each section directly in that song\'s own lyrics section tags — e.g.:',
      '  [Verse 1: Male Vocal]',
      '  [Verse 2: Female Vocal]',
      '  [Pre-Chorus: Female Vocal]',
      '  [Chorus: Male and Female Duet]',
      '  [Bridge: Male and Female Call and Response]',
      '  [Final Chorus: Male and Female Duet Harmony]',
      'Without this per-section tag, Suno renders the whole song in a single voice regardless of what the style prompt says. Verses must alternate between the two singers.'
    );
  }
  lines.push(
    '',
    '[Solo/group tracks]',
    'Do NOT add any per-section vocal-assignment tag (e.g. ": Male Vocal", ": Female Vocal") to a track NOT marked "Male-Female Duet" above — only duet tracks get them. Adding one to a solo/group track confuses Suno.'
  );
  return lines.join('\n');
}

/**
 * TASK v3.62 (TASK 1-3) — a per-song slot only sees itself; without whole-
 * pack context, 18 independently-composed songs can converge on the same
 * couple of "safe" instrument choices (the exact complaint TASK 1's own
 * diagnosis makes about template dictation, just relocated to the LLM
 * instead of fixed). One consolidated table, built from the same
 * preassignedSongs already in the JSON payload, so the agent can see its
 * neighbors before composing any one track.
 */
/**
 * v3.82 (TASK B) — "Length target" column: real measurement traced a
 * 4:16 render (target 3:15-3:35) to a slow-BPM track (81) carrying the same
 * section/word count as a similar-length faster track — the composer had
 * no idea a slow tempo needed a SHORTER structure to land in the same
 * clock-time target (see core/bpmLengthControl.ts's own doc comment).
 * Undefined for any slot missing these fields (defensive only — both
 * core/batchPreallocation.ts and core/localGenerator.ts always set them).
 */
function lengthTargetCell(slot: PreassignedSongSlot): string {
  if (!slot.sectionCountRange || !slot.wordCountRange) return '-';
  const [sMin, sMax] = slot.sectionCountRange;
  const [wMin, wMax] = slot.wordCountRange;
  const cap = slot.maxInstrumentalSections ?? 1;
  return `${sMin}-${sMax} sections, ${wMin}-${wMax} words, max ${cap} instrumental section${cap === 1 ? '' : 's'}`;
}

function perTrackPlanTable(preassignedSongs: PreassignedSongSlot[], genres: GenrePack[]): string {
  const genreLabel = (genreId: string | undefined) => genres.find(g => g.id === genreId)?.label ?? genreId ?? '-';
  const hasLengthTarget = preassignedSongs.some(slot => slot.sectionCountRange);
  const rows = preassignedSongs.map(slot => [
    String(slot.trackNo),
    markdownCell(genreLabel(slot.genreId)),
    `${slot.tempo} BPM`,
    markdownCell(slot.vocalText ?? slot.vocalType ?? '-'),
    markdownCell(slot.songRole),
    ...(hasLengthTarget ? [markdownCell(lengthTargetCell(slot))] : [])
  ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  return [
    hasLengthTarget ? '| Track | Genre | BPM | Vocal | Role | Length target |' : '| Track | Genre | BPM | Vocal | Role |',
    hasLengthTarget ? '| --- | --- | --- | --- | --- | --- |' : '| --- | --- | --- | --- | --- |',
    ...rows
  ].join('\n');
}

function eraLabelForSlot(slot: PreassignedSongSlot, genres: GenrePack[]): string {
  const genre = genres.find(g => g.id === slot.genreId);
  if (genre?.eraTag) return genre.eraTag;
  const bucket = eraBucketForGenreId(slot.genreId);
  return bucket ? ERA_LABEL[bucket] : '-';
}

/** TASK v3.64 (TASK B) — plain-language instruction per introMode, so the agent knows what to actually write instead of the app silently deleting a leaked sung line under [intro] after the fact. */
const INTRO_MODE_LABEL: Record<string, string> = {
  instrumental: 'instrumental (no lyric line under [intro])',
  'vocal-immediate': 'no [intro] tag at all — singing starts immediately',
  'vocal-after-texture': 'short [intro] line allowed'
};

/** TASK v3.64 (TASK A) — English scene-frame labels for the agent (see data/lyricThemes.ts's LyricTheme.frameId for the canonical list). */
const LYRIC_FRAME_LABEL: Record<string, string> = {
  'solitary-object': 'solitary reflection with an object',
  'young-first-love': 'young first love',
  'summer-night': 'a summer night out',
  'dance-saturday': 'a Saturday-night dance',
  'reunion-parting': 'a reunion or a parting',
  'letter-sending': 'sending or awaiting a letter',
  'city-lights': 'city lights at night',
  'travel-window': 'travel, watching the world go by',
  'shared-table': 'a shared table with others',
  'season-turning': 'a season turning'
};

function frameLabelForSlot(slot: PreassignedSongSlot): string {
  const frameId = slot.lyricFrameId ?? 'solitary-object';
  return LYRIC_FRAME_LABEL[frameId] ?? frameId;
}

function setPlanTrackTable(preassignedSongs: PreassignedSongSlot[], genres: GenrePack[]): string {
  const genreLabel = (genreId: string | undefined) => genres.find(g => g.id === genreId)?.label ?? genreId ?? '-';
  const rows = preassignedSongs.map(slot => [
    String(slot.trackNo),
    markdownCell(genreLabel(slot.genreId)),
    markdownCell(eraLabelForSlot(slot, genres)),
    `${slot.tempo} BPM`,
    markdownCell(slot.vocalType ?? slot.vocalGender ?? slot.vocalText ?? '-'),
    markdownCell(slot.structureTemplate ?? '-'),
    markdownCell(slot.introMode ? INTRO_MODE_LABEL[slot.introMode] : '-'),
    markdownCell(frameLabelForSlot(slot)),
    markdownCell(slot.songRole)
  ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  return [
    '| Track | Genre | Era | BPM | Vocal | Structure | Intro | Scene frame | Role |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows
  ].join('\n');
}

/**
 * TASK v3.64 (TASK A-5) — real measurement: 18/18 songs used the identical
 * "solitary senior with an object" scene frame. This distribution line lets
 * the agent see the whole pack's scene-frame spread at a glance, so it
 * doesn't independently converge on the same safe scene for every track
 * even though each track's own lyricThemeText already differs.
 */
function frameDistributionLine(preassignedSongs: PreassignedSongSlot[]): string {
  const byFrame = new Map<string, number[]>();
  for (const slot of preassignedSongs) {
    const frameId = slot.lyricFrameId ?? 'solitary-object';
    byFrame.set(frameId, [...(byFrame.get(frameId) ?? []), slot.trackNo]);
  }
  const parts = [...byFrame.entries()].map(([frameId, trackNos]) => `${LYRIC_FRAME_LABEL[frameId] ?? frameId} (${trackNos.join(',')})`);
  return `Scene frames used in this pack: ${parts.join('; ')}. Each track's own scene/lyricThemeText is the specific detail — write a genuinely different kind of moment per frame, not the same "alone, looking at something" scene with the object swapped out.`;
}

function groupLetters(index: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return letters[index] || `G${index + 1}`;
}

function splitTrackGroups(entries: [string, number[]][], maxSize: number, labels?: Record<string, string>): string[] {
  const rows: string[] = [];
  let groupIndex = 0;
  for (const [id, trackNos] of entries) {
    for (let cursor = 0; cursor < trackNos.length; cursor += maxSize) {
      const slice = trackNos.slice(cursor, cursor + maxSize);
      const prefix = labels?.[id] ? `${labels[id]} ${groupLetters(groupIndex)}` : groupLetters(groupIndex);
      rows.push(`${prefix}:${slice.join(',')}`);
      groupIndex += 1;
    }
  }
  return rows;
}

function groupedBySlotValue(
  preassignedSongs: PreassignedSongSlot[],
  valueFor: (slot: PreassignedSongSlot) => string | undefined,
  maxSize: number,
  labels?: Record<string, string>
) {
  const byValue = new Map<string, number[]>();
  for (const slot of preassignedSongs) {
    const value = valueFor(slot) || 'auto';
    byValue.set(value, [...(byValue.get(value) ?? []), slot.trackNo]);
  }
  return splitTrackGroups([...byValue.entries()], maxSize, labels).join('  ');
}

/**
 * TASK v3.67 (TASK A) — one line per track that has a killing point,
 * conveyed as intent (see data/killingPoints.ts / types.ts's
 * PreassignedSongSlot.killingPointText field comment): the composer decides
 * the exact wording, never a phrase to quote. Omitted entirely when no
 * track in this request has one (e.g. every track this batch owns happens
 * to be an arc peakStrength 'none' track).
 */
/**
 * v3.75 (TASK B) — mirrors promptComposer.ts's buildBatchSystemNote killing-
 * point strengthening (same real-measurement rationale: 3.3dB average
 * dynamic range on tracks WITH a killing point, one track's loudest moment
 * in the first 20% instead of the back half). Kept in sync with that
 * file's own wording per this module's existing convention.
 */
function killingPointSection(preassignedSongs: PreassignedSongSlot[]): string[] {
  const withKillingPoint = preassignedSongs.filter(slot => slot.killingPointText);
  if (!withKillingPoint.length) return [];
  return [
    '',
    '[Killing points] - each track\'s one designed peak moment, an idea to realize in your own words, never a phrase to quote verbatim. This should be the loudest, fullest, most energetic point of the ENTIRE song — clearly audible as a lift, not a small nudge — and the section right before it should stay noticeably more restrained (thinner arrangement, lower energy) so the peak has something real to rise from, instead of the whole song sitting at one constant level. Build this through arrangement fullness and dynamics, never through belting or harsh top end — the audience\'s vocal-register/production exclusions elsewhere in this instruction still apply in full at the peak. A track not listed here has no designed peak moment — keep it comfortably at its usual level throughout, do not invent one.',
    ...withKillingPoint.map(slot => `  Track ${slot.trackNo} (${slot.killingPointPlacement}): ${slot.killingPointText}`)
  ];
}

export function buildSetPlanHandoffSection(preassignedSongs: PreassignedSongSlot[], genres: GenrePack[]): string {
  if (!preassignedSongs.length) return '';
  const densityLabels: Record<string, string> = { sparse: 'sparse', medium: 'medium', full: 'full', auto: 'auto' };
  return [
    '[SetPlan handoff]',
    `[This pack's ${preassignedSongs.length}-track plan]`,
    setPlanTrackTable(preassignedSongs, genres),
    '',
    'Follow each track\'s "Intro" column exactly: "instrumental" tracks must have NO lyric line under [intro] (an instrumental cue there is fine, e.g. "[intro]" with nothing sung until the next tag); "no [intro] tag at all" tracks should skip the [intro] tag entirely and start singing right away; "short [intro] line allowed" tracks may have a brief sung line there.',
    '',
    frameDistributionLine(preassignedSongs),
    sceneAxisDistributionLine(preassignedSongs),
    '',
    '[Diversity groups] - constraints, not wording to copy:',
    `introTexture ${groupedBySlotValue(preassignedSongs, slot => slot.introTextureId, 4)}`,
    `hookDevice ${groupedBySlotValue(preassignedSongs, slot => slot.hookDeviceId, 4)}`,
    `arrangementDensity ${groupedBySlotValue(preassignedSongs, slot => slot.arrangementDensity, 5, densityLabels)}`,
    'Tracks in the same group may share a similar approach; tracks in different groups must feel clearly different. Choose the concrete musical wording yourself.',
    ...lyricThemeSceneSection(preassignedSongs),
    ...vocabularyBankInstructionLineFor(preassignedSongs),
    ...killingPointSection(preassignedSongs)
  ].join('\n');
}

/**
 * TASK v3.62 (TASK 1) — the concept agent already decomposes an artist
 * reference in customConcept into generic era/instrumentation/harmony/
 * rhythm/production/vocal descriptors for genre RECOMMENDATION
 * (conceptAgent.ts) and for the local generation path's stylePrompt atom
 * pool (localGenerator.ts's artistStyleAtomPool) — but never for the
 * bridge instruction, so a bridge user's "비틀즈 스타일로" never reached the
 * agent as anything but the customConcept free text itself. Same
 * decomposition, same never-the-artist's-name safety rule
 * (isSafeDecomposedReference / decomposedReferenceDescriptors never include
 * matchedSurface), framed explicitly as "interpret, don't quote."
 */
function artistReferenceInstructionLines(opts: GenerationOptions): string[] {
  const references = decomposeArtistReferences(opts.customConcept || '').filter(isSafeDecomposedReference);
  if (!references.length) return [];
  const lines = references.flatMap(ref => [
    `  ${ref.eraTag}:`,
    `    ${decomposedReferenceDescriptors(ref).filter(d => d !== ref.eraTag).join(' / ')}`
  ]);
  return [
    '',
    '[Reference interpretation] — the user mentioned an artist/sound reference. Below is what that reference sounds like, described generically:',
    ...lines,
    '  Do NOT use these exact words as a checklist and do NOT name the artist anywhere in stylePrompt/lyrics/youtube fields. Understand what this sound IS, then compose this song with your own musical knowledge so it authentically fits that sound and this song\'s own genre/era.'
  ];
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
 *
 * TASK v3.72 (TASK A) — usesVocalQuota is now unconditional (every archetype
 * gets a real male/female/duet quota by default — see vocalPlan.ts), so the
 * old "single vocal identity" fallback for an unquota'd pack is dead code;
 * removed rather than left as an unreachable branch. An empty
 * `preassignedSongs` (e.g. songCount 0) still degrades gracefully to
 * "male 0, female 0, mixed 0" rather than throwing.
 */
function summarizeVocalQuota(preassignedSongs: PreassignedSongSlot[]): string {
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
      markdownCell(summarizeVocalQuota(row.preassignedSongs)),
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
  const outputFilename = instructionOptions.outputFilename ?? defaultBridgeOutputPath(opts);
  const { batch, payload } = buildBridgePayload(opts, genres, moods, season, avoid, preassignedSongs, generateThumbnailText, outputFilename);
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
  const titleLocalizedInstructionLine = titleLocalizedInstructionLineFor(opts);
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
  const conceptInstructionLine = preassignedSongs.some(slot => slot.conceptText)
    ? '- Each "preassignedSongs" entry also includes "conceptText" and optional "conceptLyricImages". Weave the concept into the song\'s genre/sound description and use the images in the lyrics.'
    : '';
  const hookDeviceInstructionLine = hookDeviceInstructionLineFor(preassignedSongs);
  const earwormInstructionLine = earwormInstructionLineFor(preassignedSongs);
  const openingLoudnessInstructionLine = openingLoudnessInstructionLineFor(preassignedSongs);
  const instrumentInstructionLine = instrumentInstructionLineFor(preassignedSongs);
  const arrangementDensityInstructionLine = arrangementDensityInstructionLineFor(preassignedSongs);
  const structureTemplateInstructionLine = structureTemplateInstructionLineFor(preassignedSongs);
  const introTextureInstructionLine = introTextureInstructionLineFor(preassignedSongs);
  const negativeStyleInstructionLine = negativeStyleInstructionLineFor(preassignedSongs);
  const genreInstructionLine = genreInstructionLineFor(preassignedSongs);
  const lyricThemeInstructionLine = lyricThemeInstructionLineFor(preassignedSongs);
  const povInstructionLine = povInstructionLineFor(preassignedSongs);
  const sectionStyleInstructionLine = sectionStyleInstructionLineFor(preassignedSongs);

  return [
    instructionBuildMarkerLine(),
    '',
    // TASK v3.62 — C안's core reframing: composer, not scribe. Everything
    // below "preassignedSongs" plans (track order, BPM, genre, structure,
    // hook uniqueness) is still fixed by the app; everything about HOW a
    // song sounds (instrumentation choice, arrangement wording, density
    // phrasing) is now this agent's own musical judgment to exercise within
    // the constraints and era below — not a template to fill in.
    'You are an experienced music composer/producer generating song content for a Suno playlist pack as a one-shot task in this session — no Anthropic/OpenAI API call, write your result straight to a file. Compose each song using your own musical knowledge within the plan and constraints below; do not treat reference fields as scripts to transcribe verbatim.',
    instructionOptions.conceptLine ? `\nThis set's flavor: ${instructionOptions.conceptLine} — lean into this lead genre/season for the pack's overall tone, without abandoning the channel's core style.` : '',
    '',
    instructionOptions.setPlanningTable ? `Set planning table:\n${instructionOptions.setPlanningTable}` : '',
    '',
    buildSetPlanHandoffSection(preassignedSongs, genres),
    '',
    instructionOptions.setDirectorInterpretation
      ? buildSetDirectorInterpretationSection(instructionOptions.setDirectorInterpretation.segments, instructionOptions.setDirectorInterpretation.listeningContext)
      : '',
    '',
    instructionOptions.resolvedConstraints ? buildResolvedConstraintsSection(instructionOptions.resolvedConstraints) : '',
    '',
    // TASK v3.64 (TASK C) — the "use exactly that BPM, verbatim" rule
    // already existed but was buried after the full per-song JSON payload
    // (1000+ lines into a real 18-song instruction); a real pack still
    // measured BPM stddev collapsing from a planned ~14 down to ~3. Whether
    // that was a stale build or the agent smoothing tempos toward a
    // comfortable middle regardless, repeating the rule here — right next
    // to the BPM column it refers to — costs one line and removes any
    // excuse for missing it.
    'CRITICAL — tempo: use each track\'s own "BPM" value from the table above exactly, in every song\'s stylePrompt. Do not average, round toward a comfortable middle, or otherwise smooth tempos across tracks — the spread between tracks is intentional.',
    '',
    // TASK v3.62 (TASK 1-3) — per-track plan table so all N songs in this
    // one instruction are visible to each other before any one is composed
    // (prevents independently-composed songs from converging on the same
    // couple of "safe" instrument/vocal choices).
    `This pack's ${preassignedSongs.length} tracks (plan fixed by the app — compose within each row, do not renumber or reorder):`,
    perTrackPlanTable(preassignedSongs, genres),
    '',
    vocalCompositionSection(preassignedSongs),
    ...artistReferenceInstructionLines(opts),
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
    `- If the "lyrics" folder doesn't exist yet, create it first.`,
    `- Never overwrite an existing file. If "${outputFilename}" already exists, append "_02" (then "_03", etc.) before the .json extension and write there instead.`,
    `- Its content must be exactly { "songs": [ ... ] } — ${opts.songCount} objects total, one per song, matching "outputShape.songs[0]" above (title, hookPhrase, stylePrompt, lyrics, seasonMoment, listenerSituation, emotionArc, youtube{title,description,tags}, etc.).`,
    '- Optional (recommended): also add a top-level "meta" field alongside "songs" — { "meta": { ... }, "songs": [ ... ] } — copying "meta" from the request payload above verbatim. Do not invent or recompute any of its values yourself.',
    titleInstructionLine,
    titleLocalizedInstructionLine,
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
    moneyChordInstructionLineFor(preassignedSongs),
    genreInstructionLine,
    tempoInstructionLine(),
    songLengthInstructionLine(),
    ...slowTrackLengthCallouts(preassignedSongs),
    descriptorCountInstructionLine(),
    ...eraGuardrailLines(preassignedSongs),
    hookDeviceInstructionLine,
    earwormInstructionLine,
    openingLoudnessInstructionLine,
    introTextureInstructionLine,
    negativeStyleInstructionLine,
    instrumentInstructionLine,
    ARRANGEMENT_VOCABULARY_LYRIC_PROHIBITION_LINE,
    arrangementDensityInstructionLine,
    structureTemplateInstructionLine,
    lyricThemeInstructionLine,
    povInstructionLine,
    sectionStyleInstructionLine,
    vocalInstructionLine,
    conceptInstructionLine,
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
    // TASK v3.69 (TASK B) — "lyrics/<setName>_setNN.json", not
    // buildSetName's own collision-suffix scheme (bare "_02") — a multi-set
    // run's set index is a different concept (this is set N of M in one
    // run) from two unrelated same-day sets colliding on the same name.
    const setConceptLabel = setOpts.customConcept?.trim() || setOpts.projectTitle;
    const outputFilename = `lyrics/${buildSetName({ date: new Date(), channelLabel: setOpts.channel.name, conceptLabel: setConceptLabel })}_set${String(index + 1).padStart(2, '0')}.json`;
    const setPlanningTable = buildSetPlanningTable([{
      setIndex: index,
      setCount,
      conceptLine,
      seasonLabel: season.label,
      setOpts,
      preassignedSongs,
      outputFilename
    }]);
    // v4.4 (TASK F) — same wiring gap as the single-pack path
    // (buildClaudeCodeInstruction's own call site notes): resolvedConstraints
    // existed and rendered real instruction text but no caller ever passed
    // it in, including this multi-set loop.
    const resolvedConstraints = resolveConstraintsFromOptions(setOpts, audienceProfileForAgeGroup(setOpts.audience), currentWorkspaceId());
    const instruction = buildClaudeCodeInstruction(setOpts, genres, moods, season, avoid, preassignedSongs, generateThumbnailText, { outputFilename, conceptLine, setPlanningTable, resolvedConstraints });

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
  const conceptInstructionLine = setInstructions.some(item => item.preassignedSongs.some(slot => slot.conceptText))
    ? '- Each "preassignedSongs" entry also includes "conceptText" and optional "conceptLyricImages". Weave the concept into the song\'s genre/sound description and use the images in the lyrics.'
    : '';
  const allSlots = setInstructions.flatMap(item => item.preassignedSongs);
  const hookDeviceInstructionLine = hookDeviceInstructionLineFor(allSlots);
  const earwormInstructionLine = earwormInstructionLineFor(allSlots);
  const openingLoudnessInstructionLine = openingLoudnessInstructionLineFor(allSlots);
  const genreInstructionLine = genreInstructionLineFor(allSlots);
  const instrumentInstructionLine = instrumentInstructionLineFor(allSlots);
  const arrangementDensityInstructionLine = arrangementDensityInstructionLineFor(allSlots);
  const structureTemplateInstructionLine = structureTemplateInstructionLineFor(allSlots);
  const introTextureInstructionLine = introTextureInstructionLineFor(allSlots);
  const negativeStyleInstructionLine = negativeStyleInstructionLineFor(allSlots);
  const lyricThemeInstructionLine = lyricThemeInstructionLineFor(allSlots);
  const povInstructionLine = povInstructionLineFor(allSlots);
  const sectionStyleInstructionLine = sectionStyleInstructionLineFor(allSlots);
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
    const { payload } = buildBridgePayload(item.setOpts, genres, moods, season, item.avoid, item.preassignedSongs, generateThumbnailText, item.outputFilename);
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
    instructionBuildMarkerLine(),
    '',
    'You are an experienced music composer/producer generating multiple Suno playlist sets in one coding-agent session - no Anthropic/OpenAI API call, write every result straight to files. Compose each song using your own musical knowledge within the plan and constraints below; do not treat reference fields as scripts to transcribe verbatim.',
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
    `All ${allSlots.length} tracks across every set (plan fixed by the app — compose within each row, do not renumber or reorder):`,
    buildSetPlanHandoffSection(allSlots, genres),
    '',
    // TASK v3.64 (TASK C) — see the single-pack instruction's own comment on why this is repeated here, right after the BPM column, instead of only appearing once near the JSON payload.
    'CRITICAL — tempo: use each track\'s own "BPM" value from the table above exactly, in every song\'s stylePrompt. Do not average, round toward a comfortable middle, or otherwise smooth tempos across tracks — the spread between tracks is intentional.',
    '',
    perTrackPlanTable(allSlots, genres),
    '',
    vocalCompositionSection(allSlots),
    ...artistReferenceInstructionLines(baseOpts),
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
    '- If the "lyrics" folder doesn\'t exist yet, create it first.',
    '- Never overwrite an existing file. If a set\'s "outputFilename" already exists, append "_02" (then "_03", etc.) before the .json extension and write there instead.',
    '- Each file content must be exactly { "songs": [ ... ] }, with no markdown fences and no surrounding prose inside the file.',
    `- Each set file must contain exactly ${songsPerSet} song objects matching requestPayload.outputShape.songs[0].`,
    '- Optional (recommended): also add a top-level "meta" field alongside "songs" in each set file — { "meta": { ... }, "songs": [ ... ] } — copying that set\'s "requestPayload.meta" verbatim. Do not invent or recompute any of its values yourself.',
    titleInstructionLine,
    titleLocalizedInstructionLineFor(baseOpts),
    '- CRITICAL: For every song, "hookPhrase" and "lyrics" are treated as a matched pair. The hookPhrase string must appear verbatim in the lyrics as the chorus bookend hook.',
    moneyChordInstructionLineFor(allSlots),
    genreInstructionLine,
    tempoInstructionLine(),
    songLengthInstructionLine(),
    ...slowTrackLengthCallouts(allSlots),
    descriptorCountInstructionLine(),
    ...eraGuardrailLines(allSlots),
    hookDeviceInstructionLine,
    earwormInstructionLine,
    openingLoudnessInstructionLine,
    introTextureInstructionLine,
    negativeStyleInstructionLine,
    instrumentInstructionLine,
    ARRANGEMENT_VOCABULARY_LYRIC_PROHIBITION_LINE,
    arrangementDensityInstructionLine,
    structureTemplateInstructionLine,
    lyricThemeInstructionLine,
    povInstructionLine,
    sectionStyleInstructionLine,
    vocalInstructionLine,
    conceptInstructionLine,
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
