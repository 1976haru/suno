import type {
  BatchContext,
  GenerationOptions,
  GenrePack,
  MoodPack,
  PreassignedSongSlot,
  ScenePlanningMode,
  SeasonPack,
  WorkspaceId
} from '../types';
import { ARRANGEMENT_DENSITY_TEXT_BY_LEVEL, buildSystemInstruction, buildUserInstruction, songOutputShape, structureTemplateLegend } from './promptComposer';
import { buildExplorationInstructionLines, selectExplorationTrackNos, type ExplorationSlotPlan } from './explorationSlots';
import { resolveFlagshipVariationPlan, buildFlagshipVariationInstructionLines } from './comboVariations';
import { resolveFlagshipCombo } from './verifiedCombos';
import type { VerifiedCombo } from '../data/verifiedCombos';
import { resolveTitleLocalizedLanguage } from './packagingLanguage';
import { TITLE_ERA_HINT_RETRO_ARCHETYPES } from '../data/archetypeAudienceProfiles';
import { isKidsArchetype } from '../utils/channelArchetype';
import { preallocateSongSlots } from './batchPreallocation';
import { APP_VERSION } from './buildInfo';
import { buildSetOptions } from './multiSetGeneration';
import { buildSetConceptLine } from './setConcept';
import { moneyChordPresets } from '../data/moneyChords';
import { decomposeArtistReferences, decomposedReferenceDescriptors, isSafeDecomposedReference } from './artistReferenceDecomposer';
import { ERA_FORBIDDEN_DESCRIPTORS, ERA_LABEL, eraBucketForGenreId, type EraBucket } from '../data/eraExclusions';
import { buildSetName } from '../utils/setNaming';
import { resolveConstraintsFromOptions, type ResolvedConstraints } from './constraints';
import { audienceProfileForChannelArchetype } from '../data/audienceProfiles';
import { currentWorkspaceId } from './workspaceScope';
import { workspaceForArchetype } from '../data/workspaces';
import { buildPolicyExplorationInstructionLines, type PolicyExplorationSlotPlan } from './explorationPolicyEngine';
import { buildIdolPartPatternSet, renderIdolPartPatternLine } from './idolPartPattern';
import { hashSeed } from '../utils/prng';
import { vocabularyBankById } from '../data/vocabularyBanks';
import { isGenreEligibleForArchetype } from '../data/genreLibrary';

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
    lyricLanguage: opts.lyricLanguage,
    // 지시문 18 (TASK C-2) — 앱이 이 요청을 만든 시점의 자기 버전. 지시문
    // 스스로 "meta를 verbatim으로 복사하라"고 이미 요구하므로(위 doc comment),
    // 이 필드도 별도 지시문 없이 자동으로 응답에 실려 돌아온다.
    bridgeVersion: APP_VERSION
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

/**
 * v5.22 (AXIS 1) — the concept-driven-scene generation context: recent
 * scene summaries (core/situationLedger.ts's recentSituations) and recent
 * exact lyric lines (core/lyricLineLedger.ts's recentLyricLines) a bridge
 * agent must avoid re-using. Deliberately its OWN parameter, not folded
 * into the `avoid: { usedTitles, usedHooks }` shape every other generation
 * call site (slot preallocation, hook dedup, batch generation, ...) already
 * shares — those consumers need usedTitles/usedHooks for real collision
 * avoidance during PLANNING; this is purely bridge-instruction prompt text,
 * so widening that shared type would ripple through ~20 unrelated call
 * sites for zero benefit.
 */
export interface ConceptSceneContext {
  recentSituations: string[];
  recentLyricLines: string[];
  /**
   * 지시문 10 (TASK B-4-3) — cross-SET opening-line avoid list (first 6
   * words of each song's own opening line, last 5 sets —
   * core/situationLedger.ts's recentOpenings). Optional/defaults to [] at
   * every real call site below, same "always present, even empty" shape as
   * recentSituations/recentLyricLines above — never widens the shared
   * `avoid: {usedTitles, usedHooks}` type real slot-preallocation reads,
   * same reasoning this interface's own top doc comment already gives for
   * those two fields.
   */
  recentOpenings?: string[];
}

/**
 * codex 지시문 02 (TASK D) — real trigger condition, mirrored exactly from
 * conceptSceneInstructionLines's own guard (`if (!conceptSceneContext)
 * return []`) + its own `opts.customConcept?.trim()` check just below it —
 * this resolver exists so lyricThemeInstructionLineFor/lyricThemeSceneSection
 * (the fixed-pool side) can ask "is the OTHER scene system also about to
 * fire for this same instruction" without duplicating that condition a
 * third time. Only ever 'concept-generated' in the single-pack bridge path
 * (buildClaudeCodeInstruction) — master mode (buildMultiSetClaudeCodeMasterInstruction)
 * never passes a conceptSceneContext at all today, so it always resolves
 * 'fixed-pool' there, unchanged from pre-this-task behavior. 'same-story-
 * comparison' has no real opts/context signal to key off yet — see
 * types.ts's ScenePlanningMode doc comment for why it's still a real type
 * member rather than removed.
 */
export function resolveScenePlanningMode(opts: Pick<GenerationOptions, 'customConcept'>, conceptSceneContext: ConceptSceneContext | undefined): ScenePlanningMode {
  return conceptSceneContext && opts.customConcept?.trim() ? 'concept-generated' : 'fixed-pool';
}

function buildBridgePayload(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  avoid: { usedTitles?: string[]; usedHooks?: string[] } | undefined,
  preassignedSongs: PreassignedSongSlot[],
  generateThumbnailText: boolean,
  outputFilename?: string,
  conceptSceneContext?: ConceptSceneContext
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
  const titleLocalizedLanguage = resolveTitleLocalizedLanguage(opts);
  return {
    batch,
    payload: {
      ...basePayload,
      preassignedSongs,
      outputShape: { songs: [songOutputShape(generateThumbnailText, titleLocalizedLanguage)] },
      // v5.22 (AXIS 1) — always present (even empty) so the agent's own
      // payload shape never silently varies between a channel's first-ever
      // pack (no history yet) and its 30th.
      alreadyUsedScenes: conceptSceneContext?.recentSituations ?? [],
      alreadyUsedLyricLines: conceptSceneContext?.recentLyricLines ?? [],
      alreadyUsedOpenings: conceptSceneContext?.recentOpenings ?? [],
      ...(outputFilename ? { meta: buildBridgeMeta(opts, outputFilename) } : {})
    }
  };
}

/**
 * v5.22 (AXIS 1 §1-4) — "브릿지 지시문에 장면 생성을 요구하십시오": the real
 * fix for the structural bug data/lyricThemes.ts's own lyricThemesForOptions
 * doc comment names (customConcept never reaches theme selection, so scene
 * candidates are archetype-fixed regardless of concept — measured 17/18
 * scene collisions between two concept-distinct sets). Asks the agent to
 * derive this set's own scenes from the CONCEPT text itself, checked
 * against real cross-pack history, before it starts writing full lyrics —
 * still one JSON response, no separate round-trip: the app has no way to
 * review/approve scenes before lyrics exist for a bridge-generated pack, so
 * this is scene brainstorming as an internal step within the SAME response,
 * not a second request.
 */
function conceptSceneInstructionLines(opts: GenerationOptions, conceptSceneContext: ConceptSceneContext | undefined): string[] {
  if (!conceptSceneContext) return [];
  const concept = opts.customConcept?.trim();
  if (!concept) return [];
  const { recentSituations, recentLyricLines, recentOpenings = [] } = conceptSceneContext;
  return [
    '',
    `[이 세트의 장면 ${opts.songCount}개를 먼저 만드십시오]`,
    '',
    `컨셉: ${concept}`,
    `채널: ${opts.channel.name}`,
    '',
    `이 컨셉에서 떠오르는 구체적인 장면 ${opts.songCount}개를 먼저 머릿속으로 구상한 뒤 각 곡을 쓰십시오. 각 장면은 서로 다른 상황·장소·인물·시간대여야 합니다 — 두 곡이 같은 장면(예: "다이너에서 옛 친구를 만나는 장면")을 공유해서는 안 됩니다.`,
    recentSituations.length
      ? `이미 사용한 장면 (반복 금지, 최근 세트 기준 ${recentSituations.length}개):\n${recentSituations.map(s => `  - ${s}`).join('\n')}`
      : '이미 사용한 장면 이력이 없습니다 (이 채널의 첫 세트이거나 기록이 없습니다).',
    recentLyricLines.length
      ? `\n이미 사용한 가사 문장 (아래와 동일하거나 거의 동일한 문장을 다시 쓰지 마십시오, 최근 세트 기준 ${recentLyricLines.length}개):\n${recentLyricLines.slice(0, 60).map(l => `  - ${l}`).join('\n')}`
      : '',
    // 지시문 10 (TASK B-4-3) — "세트 내부 도입부는 이미 18/18 고유하다. 세트
    // 간 회피만 추가한다." recentSituations/recentLyricLines above already
    // give within-concept scene/sentence variety; this is specifically about
    // two DIFFERENT sets opening on the same first line (a real measured
    // bug: 2 exact opening-6-word matches across two concept-distinct real
    // packs) — narrower window (5 sets) since an opening line is a much
    // shorter, more collision-prone signal than a full scene or sentence.
    recentOpenings.length
      ? `\n이미 사용한 도입부 첫 문장 (최근 5세트 기준, 아래 시작 단어들과 겹치지 않게 여십시오):\n${recentOpenings.map(o => `  - ${o}`).join('\n')}`
      : '',
    '- CRITICAL: 각 곡의 "listenerSituation" 필드에 그 곡의 장면을 한 문장으로 요약해 쓰십시오 — 이 필드는 다음 세트가 참고할 이력으로 저장됩니다.'
  ].filter(Boolean);
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
 *
 * v5.23 (TASK F §7) — the remaining "[adjective] [noun]" image-pair-shape
 * clause below is tagged [스타일 경향] and reworded from "Never default to"
 * to "there's a real tendency... worth watching for" — a genuine 스타일
 * (advisory) item per this task's own 3-tier audit: unlike this comment's
 * own v3.75 hook-matching fix above (a real measured correctness bug),
 * repeating one title shape doesn't break anything structurally, it just
 * reads as more formulaic. See buildFinalAvoidSection's own doc comment
 * for the fuller audit — this and sectionStyleInstructionLineFor below are
 * the two genuine 스타일-tier items that audit actually found once the
 * search widened past the single already-consolidated section.
 */
function titleInstructionLineFor(opts: GenerationOptions): string {
  const titleMode = opts.titleMode ?? 'ai-creative';
  return titleMode === 'local'
    ? '- "preassignedSongs" gives local planning slots. Copy the preassigned title in local title mode, but the final "hookPhrase" you write must exactly match the hook line repeated in that song\'s lyrics; never let the JSON hook and chorus hook diverge.'
    : '- "preassignedSongs" gives local planning slots and fallback placeholders. You may use the slot hook or write a new original hook, but the final "hookPhrase" must exactly match the hook line that opens and closes every chorus in that song\'s lyrics. For the TITLE, use a genuine MIX of shapes across this pack, not one formula repeated on every song: for at least a third of the songs, the title should simply BE the hook line itself (or a near-verbatim variant of it) — this is the single most common title shape in real pop songs of this kind, especially older-pop eras, and titles that never match their own hook read as artificial. For the rest, write independent Billboard Hot 100-style titles: single striking words, unexpected concrete nouns, short metaphors, or evocative images. [스타일 경향] There\'s a real tendency to fall into the same "[adjective] [noun]" image-pair shape for every song regardless of which approach you pick — worth watching for and varying against (a short phrase, a question, a name being addressed, a single word), as much as whether the title matches the hook.';
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
  // 지시문 12 (TASK C-2) — resolvePackagingLanguage(opts) 단독이 아니라
  // resolveTitleLocalizedLanguage(opts)를 쓴다: 시니어/쇼와 계열 아키타입은
  // packagingLanguage 오버라이드가 english여도 channel.market이 한/일본을
  // 가리키면 이중언어 제목 안내문이 사라지지 않는다 (data/archetypeAudienceProfiles.ts의
  // TITLE_LOCALIZED_REQUIRED_ARCHETYPES).
  const packagingLanguage = resolveTitleLocalizedLanguage(opts);
  if (packagingLanguage === 'english') return '';
  const languageName = packagingLanguage === 'korean' ? 'Korean' : 'Japanese';
  const eraHint = opts.channel.archetype && TITLE_ERA_HINT_RETRO_ARCHETYPES.has(opts.channel.archetype)
    ? (packagingLanguage === 'korean'
      ? 'Reference the tone of 1970s-80s Korean 가요 (歌謡) titles — phrases like "그 시절", "~하던 날", "잊지 못할", "다시 만나면".'
      : 'Reference the tone of Showa-era (昭和) Japanese song titles — quiet, image-based, never a loanword transliteration.')
    : isKidsArchetype(opts.channel.archetype)
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
// TASK v5.21 (TASK G-2) — real measured error from a live pack: forced,
// abstract-to-abstract metaphors ("coin of common sense", "laughter lifting
// flame") that a mechanical grammar check can't reliably catch (see
// core/grammarLinter.ts's own doc comment on why that module deliberately
// doesn't attempt this). The task's own conclusion was that this belongs in
// the bridge instruction's guidance text instead of a runtime check —
// concrete guidance with a bad/good pair, not a rule a script enforces.
const LYRIC_IMAGERY_GUIDANCE_LINE =
  '- [가사 표현] Ground metaphors in a concrete object and a real sense (sight/sound/touch/smell), never two abstract nouns linked to each other. Bad: "coin of common sense", "laughter lifting flame" (abstract idea + abstract idea). Good: "like a copper coin in light", "laughter rising all around" (a real object/sensation carrying the feeling).';

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
 *
 * codex 지시문 02 (TASK D) — real collision this task closes: when
 * scenePlanningMode is 'concept-generated', this same instruction ALSO
 * contains conceptSceneInstructionLines telling the agent to invent its OWN
 * concept-derived scene for these same tracks — the wording below used to
 * unconditionally say the fixed-pool lyricThemeText "must" be depicted
 * regardless, a second, contradictory scene authority in the same document.
 * 'fixed-pool' mode (the default — no live customConcept+conceptSceneContext
 * pair) keeps the exact pre-existing hard-mandate wording unchanged.
 */
function lyricThemeInstructionLineFor(preassignedSongs: PreassignedSongSlot[], scenePlanningMode: ScenePlanningMode = 'fixed-pool'): string {
  if (!preassignedSongs.some(slot => slot.lyricTheme || slot.lyricThemeText)) return '';
  if (scenePlanningMode === 'concept-generated') {
    return '- Each "preassignedSongs" entry also includes "lyricThemeText" (and, for some tracks, "lyricThemeArc") - see the "[Lyric scenes]" section below. You already built this set\'s own concept-derived scenes above (per the "먼저 만드십시오" step) — those take priority. Treat lyricThemeText as a FALLBACK scene only: use it if your own concept-derived scene for that track doesn\'t already give you enough to write from, or to check your scene isn\'t drifting into a generic quiet-alone default. Do not force both a concept-derived scene AND this fallback scene into the same song\'s lyrics. Do not quote lyricThemeText verbatim as lyrics.';
  }
  return '- Each "preassignedSongs" entry also includes "lyricThemeText" (and, for some tracks, "lyricThemeArc") - see the "[Lyric scenes]" section below for the full scene per track. This is not just a "listenerSituation" field to fill in: the actual sung verses/chorus of that song must depict this specific scene and its stated motion/energy, not a generic scene of your own choosing. Do not quote lyricThemeText verbatim as lyrics; write it out as a real scene in your own words. If "lyricThemeArc" is present, use it as the lyric emotional turn.';
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
 *
 * codex 지시문 02 (TASK D) — 'concept-generated' mode: the header line
 * changes from a hard "write THIS scene" mandate to an explicit fallback
 * framing (this task's own literal "sceneFallback"/fallback-only intent),
 * since the agent was already asked, earlier in the same instruction, to
 * invent its own concept-derived scene for these same tracks — see
 * lyricThemeInstructionLineFor's own doc comment for the full collision
 * this closes. The per-track scene lines themselves are unchanged in
 * either mode (still real, useful reference material — axis notes/emotional
 * turn — just no longer phrased as a second mandatory scene).
 */
function lyricThemeSceneSection(preassignedSongs: PreassignedSongSlot[], scenePlanningMode: ScenePlanningMode = 'fixed-pool'): string[] {
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
  const header = scenePlanningMode === 'concept-generated'
    ? '[Lyric scenes — FALLBACK reference only] - you already built this set\'s own concept-derived scenes earlier in this instruction; those are what each track\'s lyrics should actually depict. The scenes below are a fallback/reference only (axis notes, emotional turn) for tracks where your own concept-derived scene needs a nudge — do not force this fallback scene into a song that already has its own concept-derived scene, and never quote the description verbatim as a lyric line.'
    : '[Lyric scenes] - write THIS scene into each track\'s actual verses/chorus, in your own words (never quote the description verbatim as a lyric line). Do NOT default to a quiet, solitary "watching something alone" scene for these tracks even if that is this app\'s usual mood elsewhere in the pack - if a scene names motion (dancing, driving, traveling) or more than one person present, the lyrics must show that motion/energy/company, not replace it with stillness or solitude.';
  return [
    '',
    header,
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

// v5.23 (TASK F §7) — the trailing "same first-line shape" clause is
// tagged [스타일 경향] (softened from "Do not let..."), the other genuine
// 스타일-tier item this task's audit found — see titleInstructionLineFor's
// own doc comment for the fuller reasoning. verseStyleText/chorusStyleText
// themselves stay "verbatim as guidance" (app-planned per-song variety,
// not this clause) — only the cross-pack "don't repeat the same shape"
// nudge is the advisory part.
function sectionStyleInstructionLineFor(preassignedSongs: PreassignedSongSlot[]): string {
  return preassignedSongs.some(slot => slot.verseStyleText || slot.chorusStyleText)
    ? '- Each "preassignedSongs" entry also includes "verseStyleText" and "chorusStyleText" - write verse sections and chorus sections with those distinct approaches, verbatim as guidance. [스타일 경향] There\'s a real tendency for every song to start with the same first-line shape or every chorus to lean on the same sentence structure — worth watching for and varying against.'
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
  // TASK D2 §6-3 (user decision) — kids' 'mixed' vocal is a boy-and-girl mixed pair now, not a choir (see vocalPlan.ts's own doc comment).
  if (slot.vocalGender === 'mixed' || slot.vocalType === 'mixed') return 'Mixed Group';
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

export function buildSetPlanHandoffSection(preassignedSongs: PreassignedSongSlot[], genres: GenrePack[], scenePlanningMode: ScenePlanningMode = 'fixed-pool'): string {
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
    ...lyricThemeSceneSection(preassignedSongs, scenePlanningMode),
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
 * v5.23 (TASK A §1-3) — "먼저 읽는 것이 사고를 지배합니다": real, measured
 * problem this fixes — before this task, the FIRST substantive thing a
 * coding agent read (after one framing sentence) was a wall of
 * plan-tables/constraints/rules ending in dozens of "never"/"do not"
 * bullets (§0-2's own audit: 68 prohibition spots, 1 line of creative
 * encouragement, in a 1,531-line instruction). This section is now the
 * FIRST real content — what this set is trying to BE, not what to avoid —
 * so the agent's first read establishes intent before constraint. Never
 * itself a constraint: the last line explicitly says so, so an agent
 * doesn't read "성공 기준" as a new checklist to satisfy on top of
 * everything below it.
 */
function buildSetIntentSection(opts: GenerationOptions, conceptLabel: string | undefined): string {
  const concept = conceptLabel?.trim() || `${opts.channel.name}의 평소 컨셉`;
  const audience = opts.channel.promise || `${opts.channel.name} 청취자`;
  return [
    '[이 세트가 하려는 것]',
    '',
    `  컨셉    ${concept}`,
    `  청취자  ${audience}`,
    `  목표    ${opts.songCount}곡을 이어 들었을 때 이 컨셉이 실제로 느껴지게`,
    '',
    '  이 세트는 다음 중 하나를 이루면 성공입니다',
    '    한 곡이라도 다시 듣고 싶게 만든다',
    `    ${opts.songCount}곡이 하나의 시간대·분위기로 들린다`,
    '    어느 한 곡이 특별히 기억에 남는다',
    '',
    '  아래의 재료와 제약은 그것을 돕기 위한 것입니다.',
    '  제약을 지키는 것 자체가 목표가 아닙니다.'
  ].join('\n');
}

/**
 * v5.23 (TASK A §1-4) — "먼저 읽는 것이 사고를 지배합니다. 금지로 시작하면 금지를
 * 피하는 데 집중합니다": the mirror-image fix of buildSetIntentSection above —
 * consolidates the handful of genuinely UNIVERSAL/safety-critical
 * prohibitions (previously scattered mid-array, interleaved with
 * constructive field instructions) into one clearly-labeled block, moved to
 * the true end of the instruction, right before the mechanical
 * output-format bullets. Deliberately narrow in scope: the ~30 remaining
 * field-specific single-clause caveats (e.g. structureTemplateInstructionLine's
 * own "don't invent a different template") stay attached to their own field
 * instruction rather than being extracted here — each of those is one
 * clause inside an otherwise constructive, field-specific instruction, and
 * severing it from its context would leave that field's own guidance
 * incomplete. This section instead targets the real, measured source of
 * bloat: the genuinely repeated/universal bans (already-used titles/hooks
 * stated 3x across this file's own assembly and promptComposer.ts's rules
 * block; arrangement-vocabulary-in-lyrics stated 2x) — collapsed to ONE
 * canonical statement each, here.
 */
/**
 * v5.23 (TASK F §7) — "안전(절대) / 품질(강함) / 스타일(권고)로 나누고, 스타일
 * 등급은 '피하십시오' 대신 '이런 경향이 있습니다'로 누그러뜨리십시오." This
 * function's own 4 items were audited against that 3-tier test: every one
 * turned out to be either a copyright/safety-absolute rule or a
 * quality-critical rule tied to a real, measured past failure (see each
 * bullet's own history in this function's git blame / the TASK A doc
 * comment above) — not a single one is a soft stylistic preference, so
 * none is softened to "경향" wording here.
 *
 * The 3-tier audit was later widened past this one already-consolidated
 * section to the ~30 field-specific single-clause caveats TASK A's own
 * doc comment left in place (each still attached to its own field
 * instruction, not relocated — severing context would leave that field's
 * guidance incomplete). That wider pass DID find 2 genuine 스타일-tier
 * items — both are cross-pack VARIETY nudges ("don't repeat the same
 * shape on every song"), not correctness bugs: titleInstructionLineFor's
 * "[adjective] [noun]" image-pair-shape clause and
 * sectionStyleInstructionLineFor's "same first-line shape" clause. Both
 * are now tagged [스타일 경향] and reworded from "Never/Do not" to "there's
 * a real tendency... worth watching for" in place (softened, not
 * relocated — same reasoning as TASK A's own scope decision). Every OTHER
 * caveat in that wider pass (introTextureInstructionLineFor's "never let
 * it become the whole-song arrangement", era-authenticity guardrails,
 * structural determinism like tempo/genre/pov/structureTemplate, the
 * lyricThemeSceneSection quiet-alone-default fix, ...) is tied to either
 * app-planned determinism downstream code depends on or a real measured
 * failure, so none of those were softened — a real finding, not a gap.
 * The tiering below (안전/품질 headers) still delivers §7's actual ask for
 * THIS section: an agent reading it now sees which bullets are
 * non-negotiable (copyright/safety) versus which are quality bars it
 * should treat as seriously as safety even though a violation isn't
 * legally risky.
 */
function buildFinalAvoidSection(avoid: { usedTitles?: string[]; usedHooks?: string[] } | undefined): string {
  return [
    '[마지막으로, 이것만은 피하십시오]',
    '',
    '  안전 (절대 완화하지 않음)',
    '    - 실제 아티스트·밴드·프로듀서·곡·멜로디·가사를 모방하거나 이름을 언급하지 마십시오. "in the style of X"류 표현도 금지입니다.',
    '',
    '  품질 (항상 지킴 — 과거 실측 실패에서 나온 규칙입니다)',
    `    - 이미 사용한 제목·훅: "alreadyUsedTitles"의 ${avoid?.usedTitles?.length ?? 0}개, "alreadyUsedHooks"의 ${avoid?.usedHooks?.length ?? 0}개는 전부 금지입니다 — 참고 자료가 아니라 이전 팩에서 이미 쓴 것들입니다. 파일을 쓰기 전에 모든 곡의 title/hookPhrase를 두 목록과 대조하십시오 (트랙 번호를 바꿔 재배치해도 안 됩니다).`,
    '    - 악기·편곡·프로덕션 용어(guitar, strings, drums, piano, horns, reverb, stop-time 등)는 stylePrompt에만 씁니다. 가사 문장의 주어나 행위자로 쓰지 마십시오("the guitar keeps walking" 금지). 사람이 그 악기와 상호작용하는 묘사는 괜찮습니다("I still play my father\'s guitar").',
    '    - negativeStyleText는 Suno의 별도 "Exclude styles" 필드용입니다 — stylePrompt 본문에 섞지 마십시오.'
  ].join('\n');
}

/**
 * v5.23 (TASK B §2-2) — "'다르게 하라' → 추상적이라 무시됩니다. '무엇을
 * 다르게 했는지 적으라' → 적으려면 생각해야 합니다": asks for a concrete,
 * one-line creative decision per song instead of a vague "be creative"
 * directive. Deliberately advisory (see this function's own callers —
 * core/distinctChoiceCheck.ts never blocks an import over this), so the
 * wording here explains WHY (helps the set, not itself the goal) rather
 * than framing it as one more rule to satisfy.
 */
/**
 * v5.24 (TASK E §5) — "distinctChoice 를 워크스페이스마다 다르게 물으십시오":
 * kr-kids/jp-kids get an ADDITIONAL required-in-spirit field (kidsAction,
 * types.ts's own SongIdea.kidsAction) asking what the child physically does,
 * since a novelty-framed question is the wrong question for kids (§0-1).
 * kr-idol-male, kr-idol-female, kr-2030, jp-2030 keep the same "distinctChoice"
 * field but with workspace-tuned wording/examples; senior-oldpop and any
 * other workspace
 * keep the exact pre-v5.24 wording (regression-safe default branch).
 */
function buildDistinctChoiceInstructionLines(songCount: number, workspaceId: WorkspaceId): string[] {
  const otherCount = Math.max(0, songCount - 1);

  if (workspaceId === 'kr-kids' || workspaceId === 'jp-kids') {
    return [
      '',
      '[각 곡에 하나씩]',
      '',
      '  이 곡을 들으며 아이가 하는 행동을 한 가지 적으십시오. 필드명은 "kidsAction"입니다.',
      '',
      '  예시',
      '    손뼉 치기',
      '    발 구르기',
      '    제자리에서 돌기',
      '    손가락으로 세기',
      '    크게 웃기',
      '',
      '  세트 전체에서 행동 종류가 겹치지 않게 다양하게 고르십시오.',
      '',
      `  그리고 이 곡에서 다른 ${otherCount}곡과 다르게 시도한 것을 한 줄로 적으십시오. 필드명은 "distinctChoice"입니다.`
    ];
  }

  if (workspaceId === 'kr-idol-male' || workspaceId === 'kr-idol-female') {
    return [
      '',
      '[각 곡에 하나씩]',
      '',
      '  이 곡의 파트 배분 패턴을 한 줄로 적으십시오. 필드명은 "distinctChoice"입니다.',
      '',
      '  예시',
      '    [Verse 1: A] [Verse 2: B] [Pre: A+B] [Chorus: All] [Bridge: C solo] [Final: All + C ad-lib]',
      '    벌스마다 다른 파트가 시작하고 후렴은 전원',
      '    브리지를 한 명이 통째로 부르고 후렴에서 합류',
      '',
      `  그리고 다른 ${otherCount}곡과 다르게 시도한 것도 함께 적으십시오.`,
      '',
      '  같은 파트 패턴을 두 곡 이상에 쓰지 마십시오.'
    ];
  }

  if (workspaceId === 'kr-2030' || workspaceId === 'jp-2030') {
    return [
      '',
      '[각 곡에 하나씩]',
      '',
      `  이 곡에서 새롭게 시도한 것을 한 줄로 적으십시오. 필드명은 "distinctChoice"입니다. 더 과감해도 됩니다 — 이 워크스페이스는 정전이 없습니다.`,
      '',
      '  예시',
      '    장르 두 개를 섞는다',
      '    후렴이 곡 끝에만 한 번 나온다',
      '    로파이 질감으로 녹음한 듯한 프로덕션',
      '    가사를 일기체로 쓴다',
      '    갑작스러운 전조',
      '',
      '  같은 시도를 두 곡 이상에 쓰지 마십시오.'
    ];
  }

  return [
    '',
    '[각 곡에 하나씩]',
    '',
    `  이 곡에서 다른 ${otherCount}곡과 다르게 시도한 것을 한 줄로 적으십시오. 필드명은 "distinctChoice"입니다.`,
    '',
    '  예시',
    '    후렴을 한 번만 부른다',
    '    마지막에 반주가 사라지고 목소리만 남는다',
    '    질문으로 끝난다',
    '    1절과 2절의 화자가 다르다',
    '    같은 문장이 절마다 조금씩 바뀐다',
    '    후렴 전에 한 박자 쉰다',
    '    2절이 1절보다 짧다',
    '',
    '  같은 시도를 두 곡 이상에 쓰지 마십시오.'
  ];
}

/**
 * v5.24 (TASK C §3-5) — "곡마다 파트 배분을 명시하십시오... 파트 패턴 8종 이상,
 * 같은 패턴 최대 3곡." Kept as its own instruction block (not threaded through
 * PreassignedSongSlot) so it stays fully additive — every workspace other
 * than kr-idol-male/kr-idol-female gets an empty array, identical to
 * pre-v5.24 output.
 */
function buildIdolPartPatternInstructionLines(workspaceId: WorkspaceId, songCount: number, seedSource: string): string[] {
  if (workspaceId !== 'kr-idol-male' && workspaceId !== 'kr-idol-female') return [];
  const patterns = buildIdolPartPatternSet(songCount, hashSeed(seedSource));
  if (!patterns.length) return [];
  return [
    '',
    '[파트 배분]',
    '',
    '  아이돌 곡은 파트가 곧 구조입니다. 아래 트랙별 파트 패턴을 그대로 따르십시오 (A/B/C는 서로 다른 보컬 파트를 뜻하며, 인원수나 "그룹"을 가사·설명에 직접 쓰지 마십시오).',
    '',
    ...patterns.map((pattern, i) => renderIdolPartPatternLine(i + 1, pattern)),
    ''
  ];
}

/**
 * v5.24 (TASK G §7) — four advisory, never-forced devices for whole-set
 * completeness: a loose story thread (§7-1, suggestion only — never
 * required, and explicitly absent for K-pop per spec's own "없어도 됨"),
 * contrast (§7-2: quietest/brightest/shortest/oddest track), lead-track
 * yielding (§7-3: tracks 1/4 stay plain so 2-3 stand out), and the last
 * track's callback role (§7-4). None of this is enforced or checked
 * anywhere — purely instruction text an agent may or may not act on, same
 * "suggest, never auto-apply" posture as explorationLedger.ts's learning
 * suggestions.
 */
function buildSetCompletenessSuggestionLines(workspaceId: WorkspaceId): string[] {
  const storyThreadByWorkspace: Partial<Record<WorkspaceId, string>> = {
    'senior-oldpop': '같은 계절의 하루 (아침 → 밤), 또는 같은 인물의 젊은 날과 지금, 또는 같은 장소의 다른 시간',
    'kr-2030': '하루의 시간대, 또는 한 사람의 감정 변화',
    'jp-2030': '하루의 시간대, 또는 한 사람의 감정 변화',
    'kr-kids': '하루 일과 (일어나기 → 잠자기), 또는 계절 한 바퀴',
    'jp-kids': '하루 일과 (일어나기 → 잠자기), 또는 계절 한 바퀴'
  };
  const storyThread = storyThreadByWorkspace[workspaceId];

  return [
    '',
    '[세트 전체의 완성도 — 제안, 강제 아님]',
    '',
    ...(storyThread
      ? ['  세트 전체를 느슨하게 잇는 이야기 하나를 둘 수 있습니다 (강제 아님, 제안일 뿐입니다).', `    예: ${storyThread}`, '']
      : []),
    '  대비를 만드십시오 — 18곡이 전부 좋으면 무엇이 좋은지 알 수 없습니다.',
    '    가장 조용한 곡 1곡 · 가장 밝은 곡 1곡 · 가장 짧은 곡 1곡 · 가장 특이한 곡 1곡(탐색 슬롯)',
    '',
    '  1번과 4번 트랙은 담백하게 만들어, 2~3번(대표곡)이 상대적으로 돋보이게 하십시오.',
    '',
    '  마지막 트랙은 완전히 끝내지 말고 여운을 남기며, 1번 트랙의 요소를 살짝 반영하십시오 (플레이리스트는 반복 재생됩니다).'
  ];
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
  instructionOptions: ClaudeCodeInstructionOptions = {},
  /** v5.22 (AXIS 1) — see ConceptSceneContext's own doc comment. Optional and additive: every existing caller that doesn't pass it keeps generating the exact same instruction text as before. */
  conceptSceneContext?: ConceptSceneContext,
  /** v5.23 (TASK C) — core/explorationSlots.ts's own pre-resolved plan (senior-oldpop only — see selectExplorationTrackNos' own workspace gate). Optional and additive: omitted (or `enabled: false`) produces zero exploration text, identical to every pre-v5.23 instruction. */
  explorationPlan?: ExplorationSlotPlan,
  /** v5.23 (TASK D) — the same flagshipCombo core/batchPreallocation.ts's preallocateSongSlots already resolved to build `preassignedSongs` (see resolveFlagshipCombo). Optional and additive: omitted produces zero variation text. See comboVariations.ts's resolveFlagshipVariationPlan for how this turns into a single track-scoped instruction. */
  flagshipCombo?: VerifiedCombo,
  /** v5.24 (TASK A/B/C/D) — core/explorationPolicyEngine.ts's own pre-resolved plan for every workspace except senior-oldpop (which keeps using `explorationPlan` above). Optional and additive: omitted (or `enabled: false`) produces zero exploration text. */
  policyExplorationPlan?: PolicyExplorationSlotPlan
): string {
  // TASK (genre-archetype sanitization) — `genres` here is only ever a
  // lookup table for label/description text (per-track assignment is driven
  // by `preassignedSongs[i].genreId`, already sanitized upstream by
  // core/batchPreallocation.ts's preallocateSongSlots — see that function's
  // own doc comment); this defensively keeps a foreign entry that slipped
  // through some other path out of the agent-facing payload/plan-table text
  // too. No user-facing warning here (this function returns a plain string,
  // not a structured report) — the real warning already surfaced wherever
  // opts.genreIds was sanitized upstream.
  const archetype = opts.channel.archetype || 'senior-morning';
  const eligibleGenres = genres.filter(genre => isGenreEligibleForArchetype(genre, archetype));
  const sanitizedGenres = eligibleGenres.length ? eligibleGenres : genres;
  const outputFilename = instructionOptions.outputFilename ?? defaultBridgeOutputPath(opts);
  // v5.24 — resolved per-instruction from the channel's own archetype rather
  // than the UI's currentWorkspaceId() global, so a set built for a
  // different channel than whatever is currently active in the UI still
  // gets the right workspace's exploration policy/distinctChoice wording.
  // Falls back to currentWorkspaceId() only when the archetype isn't mapped
  // to any workspace (shouldn't happen for a real channel).
  const workspaceId = workspaceForArchetype(archetype)?.id ?? currentWorkspaceId();
  const { batch, payload } = buildBridgePayload(opts, sanitizedGenres, moods, season, avoid, preassignedSongs, generateThumbnailText, outputFilename, conceptSceneContext);
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
  // codex 지시문 02 (TASK D) — resolved once here, reused for both
  // lyricThemeInstructionLineFor below and buildSetPlanHandoffSection's own
  // lyricThemeSceneSection call further down, so the two fixed-pool-scene
  // instruction blocks never disagree about which mode is active.
  const scenePlanningMode = resolveScenePlanningMode(opts, conceptSceneContext);
  const lyricThemeInstructionLine = lyricThemeInstructionLineFor(preassignedSongs, scenePlanningMode);
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
    '',
    // v5.23 (TASK A §1-2/§1-3) — the FIRST real content, before any
    // plan/constraint/rule text: what this set is trying to BE. See
    // buildSetIntentSection's own doc comment for the real problem this
    // reordering fixes.
    buildSetIntentSection(opts, instructionOptions.conceptLine ?? opts.customConcept),
    // v5.23 (TASK B) — "창작 방향", right after intent per the task's own
    // new section order (의도 -> 창작 방향 -> 곡별 재료 -> ...).
    ...buildDistinctChoiceInstructionLines(opts.songCount, workspaceId),
    // v5.23 (TASK C) — exploration slots, same "창작 방향" grouping; produces
    // zero lines when explorationPlan is absent/disabled (see
    // buildExplorationInstructionLines' own doc comment). senior-oldpop only.
    ...buildExplorationInstructionLines(explorationPlan ?? { enabled: false, trackNos: [], axis: null }),
    // v5.24 (TASK B/C/D) — the same slot-instruction shape, driven by
    // data/explorationPolicies.ts, for every workspace except senior-oldpop.
    ...buildPolicyExplorationInstructionLines(policyExplorationPlan ?? { enabled: false, workspaceId, trackNos: [], axis: null }),
    // v5.24 (TASK C §3-5) — K-pop-only part-map block; empty for every other workspace.
    ...buildIdolPartPatternInstructionLines(workspaceId, opts.songCount, outputFilename),
    // v5.24 (TASK G) — advisory, never-forced set-completeness suggestions
    // (loose story thread / contrast / lead-track yielding / last-track
    // callback). Workspace-tuned; empty story-thread line for K-pop per spec
    // §7-1 "K-pop 없어도 됨".
    ...buildSetCompletenessSuggestionLines(workspaceId),
    // v5.23 (TASK D) — "이 조합을 반복하라 -> 이 조합을 출발점으로 변주하라"; zero
    // lines when flagshipCombo is absent or no second track carries its
    // genre id (see resolveFlagshipVariationPlan's own doc comment).
    ...buildFlagshipVariationInstructionLines(resolveFlagshipVariationPlan(preassignedSongs, flagshipCombo)),
    instructionOptions.conceptLine ? `\nThis set's flavor: ${instructionOptions.conceptLine} — lean into this lead genre/season for the pack's overall tone, without abandoning the channel's core style.` : '',
    ...conceptSceneInstructionLines(opts, conceptSceneContext),
    '',
    instructionOptions.setPlanningTable ? `Set planning table:\n${instructionOptions.setPlanningTable}` : '',
    '',
    buildSetPlanHandoffSection(preassignedSongs, sanitizedGenres, scenePlanningMode),
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
    perTrackPlanTable(preassignedSongs, sanitizedGenres),
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
    // v5.23 (TASK A §1-4) — the CRITICAL "already-used titles/hooks are
    // FORBIDDEN" bullet that used to live here (see git history for the old
    // v3.30 wording/rationale — unchanged in substance) moved to
    // buildFinalAvoidSection, consolidated with the other universal
    // prohibitions at the true end of the instruction instead of scattered
    // mid-array. This is still a real, positive requirement (not a
    // prohibition), so it stays here: hookPhrase/lyrics must match.
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
    // v5.23 (TASK A §1-4) — ARRANGEMENT_VOCABULARY_LYRIC_PROHIBITION_LINE
    // moved to buildFinalAvoidSection (see that function's own doc comment);
    // LYRIC_IMAGERY_GUIDANCE_LINE stays here — it's genuine craft guidance
    // with a bad/good pair, not a bare prohibition.
    LYRIC_IMAGERY_GUIDANCE_LINE,
    arrangementDensityInstructionLine,
    structureTemplateInstructionLine,
    lyricThemeInstructionLine,
    povInstructionLine,
    sectionStyleInstructionLine,
    vocalInstructionLine,
    conceptInstructionLine,
    '',
    // v5.23 (TASK A §1-2/§1-4) — the true LAST content section (before only
    // the mechanical file-output bullets below), consolidating the
    // universal prohibitions per this task's own "먼저 읽는 것이 사고를
    // 지배합니다" — see buildFinalAvoidSection's own doc comment.
    buildFinalAvoidSection(avoid),
    '',
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
  initialAvoid: { usedTitles?: string[]; usedHooks?: string[]; verifiedCombos?: VerifiedCombo[] } | undefined,
  generateThumbnailText = false,
  /**
   * v5.23 (TASK D/C multi-set gap) — core/explorationLedger.ts's own
   * nextAxisSequence(workspaceId), pre-fetched by the caller (same "core
   * stays sync, caller owns IndexedDB" split every other pre-fetched
   * value in this file already follows). Each set in this run consumes
   * sequence+index, so an N-set run genuinely advances the 7-axis rotation
   * N steps in one go rather than reusing the same axis for every set.
   * Omitted (or the workspace isn't senior-oldpop) produces zero
   * exploration text, identical to every pre-v5.23-multi-set instruction.
   */
  startingAxisSequence?: number
): MultiSetBridgeInstruction[] {
  const results: MultiSetBridgeInstruction[] = [];
  let usedTitles = [...(initialAvoid?.usedTitles ?? [])];
  let usedHooks = [...(initialAvoid?.usedHooks ?? [])];
  const verifiedCombos = initialAvoid?.verifiedCombos ?? [];

  for (let index = 0; index < setCount; index++) {
    const setOpts = buildSetOptions(baseOpts, index, setCount, songsPerSet);
    const avoid = { usedTitles, usedHooks, verifiedCombos };
    const preassignedSongs = preallocateSongSlots(setOpts, genres, avoid);
    const conceptLine = buildSetConceptLine(setOpts.channel, season.label, index, setCount);
    // v5.23 (TASK C/D multi-set gap) — mirrors core/batchPreallocation.ts's
    // own flagshipCombo resolution exactly (same genrePool derivation, same
    // resolveFlagshipCombo call) so this set's own instruction text agrees
    // with whichever combo preallocateSongSlots (called just above, same
    // `avoid`) actually applied to this set's own genrePlan.
    const setGenrePool = Array.from(new Set((setOpts.genreIds ?? genres.map(genre => genre.id)).filter(Boolean)));
    const flagshipCombo = setOpts.songCount >= 3 ? resolveFlagshipCombo(verifiedCombos, setGenrePool) : undefined;
    const setWorkspaceId = workspaceForArchetype(setOpts.channel.archetype)?.id ?? currentWorkspaceId();
    const explorationPlan = startingAxisSequence !== undefined
      ? selectExplorationTrackNos(setOpts.songCount, setWorkspaceId, startingAxisSequence + index)
      : undefined;
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
    const resolvedConstraints = resolveConstraintsFromOptions(setOpts, audienceProfileForChannelArchetype(setOpts.channel.archetype, setOpts.audience), currentWorkspaceId());
    const instruction = buildClaudeCodeInstruction(
      setOpts, genres, moods, season, avoid, preassignedSongs, generateThumbnailText,
      { outputFilename, conceptLine, setPlanningTable, resolvedConstraints },
      undefined, explorationPlan, flagshipCombo
    );

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
  initialAvoid: { usedTitles?: string[]; usedHooks?: string[]; verifiedCombos?: VerifiedCombo[] } | undefined,
  generateThumbnailText = false,
  /** v5.23 (TASK D/C multi-set gap) — forwarded verbatim to buildMultiSetClaudeCodeInstructions' own startingAxisSequence param; see that param's own doc comment. */
  startingAxisSequence?: number
): MultiSetBridgeMasterInstruction {
  const setInstructions = buildMultiSetClaudeCodeInstructions(baseOpts, setCount, songsPerSet, genres, moods, season, initialAvoid, generateThumbnailText, startingAxisSequence);
  const totalSongs = setCount * songsPerSet;
  const masterWorkspaceId = workspaceForArchetype(baseOpts.channel.archetype)?.id ?? currentWorkspaceId();
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
    // v5.23 (TASK A) — same reordering as the single-pack instruction (see
    // buildSetIntentSection's own doc comment); master mode is a separate,
    // hand-assembled array (not delegated to buildClaudeCodeInstruction —
    // see this function's own header comment), so it needs the same fix
    // applied independently rather than inheriting it for free.
    buildSetIntentSection(baseOpts, baseOpts.customConcept),
    // v5.23 (TASK B) — same "창작 방향" placement as the single-pack instruction.
    ...buildDistinctChoiceInstructionLines(totalSongs, masterWorkspaceId),
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
    // v5.23 (TASK A) — ARRANGEMENT_VOCABULARY_LYRIC_PROHIBITION_LINE moved
    // to buildFinalAvoidSection below (same reasoning as the single-pack
    // instruction's identical comment).
    LYRIC_IMAGERY_GUIDANCE_LINE,
    arrangementDensityInstructionLine,
    structureTemplateInstructionLine,
    lyricThemeInstructionLine,
    povInstructionLine,
    sectionStyleInstructionLine,
    vocalInstructionLine,
    conceptInstructionLine,
    '',
    buildFinalAvoidSection(initialAvoid),
    '- Later sets must not reuse earlier-set titles or hooks — add each set\'s actual generated titles/hooks to your own avoid list before composing the next one.',
    '',
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
