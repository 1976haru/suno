/**
 * TASK v5.7 (TASK A) — "사용자 선택이 무시되는 구조" 근본 수정.
 *
 * Root problem this file exists to solve: v3.77 (보컬 프리셋 다양성 꺼짐),
 * v4.13 (보컬 프리셋 선택과 정반대 결과), v4.7 (minPaletteVariety 강제), and
 * v5.7 (머니코드 선택 무시) are the SAME structural bug recurring four times —
 * a system-side allocation/default rule silently wins over something the
 * user explicitly picked in the UI. Individually patching each occurrence
 * (as v3.77/v4.13/v4.7 all did) never stops the next one; this module is the
 * structural guardrail 하루 explicitly asked for: "완전히 수정될 수 있도록
 * 이런 오류가 반복되지 않도록 완벽하게 수정해줘".
 *
 * Priority order this whole app must respect (highest wins):
 *   1. audience safety constraints (audienceProfile.hardExclusions, kids
 *      safety policy) — nothing may ever override these, including the
 *      user (a user typing something unsafe still can't produce it).
 *   2. the user's explicit UI choices — this file's own subject.
 *   3. constraints inferred from the concept text (era, mood, situation).
 *   4. system default allocation (diversity rules, per-family defaults).
 *
 * Today priority 4 routinely wins over priority 2 because nothing in the
 * pipeline distinguishes "the user clicked this" from "this is just
 * whatever the field defaulted to". UserExplicitChoices is that
 * distinction, made explicit and carried through the pipeline instead of
 * being reconstructed (unreliably) at each stage.
 */

import type {
  ChannelArchetype,
  ChannelProfile,
  ChoiceSource,
  ConceptBreadth,
  GenerationChoiceProvenance,
  GenerationOptions,
  GenreBlendMode,
  KidsAgeTierId,
  LyricLanguage,
  LyricPerspective,
  PerspectiveMode,
  PreassignedSongSlot,
  SongIdea,
  WorkspaceId
} from '../types';
import { channelPresets, migrateArchetype } from '../data/presets';
import { getWorkspace, workspaceForArchetype } from '../data/workspaces';
import { audienceProfileForChannelArchetype } from '../data/audienceProfiles';
import { getGenreById } from '../data/genreLibrary';
import { moneyChordPresets } from '../data/moneyChords';
import { computeMoneyChordComparison, type MoneyChordBreakdownEntry } from './moneyChordDisplay';
import { genreSanitizationWarningKo, sanitizeGenreIdsForArchetype } from './genreSelection';
import { parseNegativeStyleTerms } from '../data/negativeStyles';
import { DEFAULT_ADULT_VOCAL_QUOTA, DEFAULT_KIDS_VOCAL_QUOTA, leaningAdultVocalQuota, leaningGenderFor, type VocalType } from './vocalPlan';
import { matchVocalPreset } from '../data/vocalPresets';
import { povDistribution, resolvePerspectiveMode } from './lyricDiversityPlan';
import { isKidsArchetype } from '../utils/channelArchetype';

/** Every field a UI screen can genuinely let the user pick directly (not a default/concept-inferred value). Absent fields simply weren't offered/touched this session. */
export interface UserExplicitChoices {
  moneyChordMode?: GenerationOptions['moneyChordMode'];
  customMoneyChord?: string;
  vocalTone?: string;
  genreIds?: string[];
  breadth?: ConceptBreadth;
  paletteFamilyId?: string;
  lyricLanguage?: LyricLanguage;
  packagingLanguage?: string;
  seasonId?: string;
  perspective?: GenerationOptions['perspective'];
  /** TASK v6.0 (perspectiveMode) — Step2Concept's "적용 방식" picker (fixed/dominant/varied); see GenerationOptions.perspectiveModeIsExplicitChoice for why this needs its own explicit-choice flag (same shape as moneyChordMode). */
  perspectiveMode?: GenerationOptions['perspectiveMode'];
  /** TASK (provenance) — Step2Concept's genre-blend "적용 방식" picker (shared-primary/lead-only); same shape as perspectiveMode just above. */
  genreBlendMode?: GenreBlendMode;
  songCount?: number;
  /** TASK (provenance) — the 13th tracked axis; see GenerationChoiceProvenance's own doc comment (types.ts) for why this has no legacy inference to fall back to — Step1Channel.tsx's picker only ever reaches GenerationOptions via a channel switch/save (App.tsx's applyChannelToOptions), so 'channel' is the only real provenance value this field is ever observed to carry today. */
  kidsAgeTierId?: KidsAgeTierId;
  /** v5.7 follow-up (TASK v5.7 §4-2 verification) — DiversityAllocationPanel's "직접 주제/상황" free-text field; see setDirector.ts's buildBaseOptions own doc comment for the real gap this closes. */
  customLyricThemeScene?: string;
  /** TASK (provenance extension) — Step2Concept.tsx's mood chip grid. */
  moodIds?: string[];
  /** TASK (provenance extension) — Step2Concept.tsx's "곡 길이" ChoiceGrid. */
  durationTarget?: GenerationOptions['durationTarget'];
  /** TASK (provenance extension) — Step2Concept.tsx's "가사 깊이" ChoiceGrid. */
  lyricDepth?: GenerationOptions['lyricDepth'];
  /** TASK (provenance extension) — Step2Concept.tsx's "훅 생성 방식" chip pair. */
  hookMode?: GenerationOptions['hookMode'];
  /** TASK (provenance extension) — Step2Concept.tsx's "Reference mood" textarea. */
  referenceMood?: string;
  /** TASK (provenance extension) — Step2Concept.tsx's "Music Exclude styles" preset chips/textarea. */
  negativeStyle?: string;
  /** TASK (provenance extension) — Step2Concept.tsx's "가사에서 피할 것들" presets/custom terms. */
  avoidWords?: string;

  /**
   * Per-field provenance — only 'user' entries are protected by
   * assertUserChoicesPreserved. Keys not present here are treated as
   * 'default'. TASK (provenance) — widened from the old
   * 'user' | 'default' | 'concept' literal union to the full ChoiceSource
   * type (types.ts) so a value read straight from
   * GenerationOptions.choiceProvenance (which can also carry 'channel' /
   * 'system' / 'migration') never needs a lossy cast here. Purely additive:
   * every value this module itself ever wrote before ('user'/'default'/
   * 'concept') is still a valid ChoiceSource.
   */
  source: Partial<Record<keyof Omit<UserExplicitChoices, 'source'>, ChoiceSource>>;
}

export function emptyUserChoices(): UserExplicitChoices {
  return { source: {} };
}

/**
 * TASK (provenance) — GenerationChoiceProvenance field name -> the actual
 * GenerationOptions key that field's live value lives on. Only needed for
 * the two axes whose provenance-map name doesn't match the opts property
 * name 1:1 (breadth/breadthOverride, paletteFamilyId/paletteFamilyOverride);
 * every other entry is identity. Shared by provenanceForSystemFix below and
 * available to any future caller that needs the same mapping.
 */
const PROVENANCE_FIELD_TO_OPTS_KEY: { [K in keyof GenerationChoiceProvenance]: keyof GenerationOptions } = {
  moneyChordMode: 'moneyChordMode',
  vocalTone: 'vocalTone',
  genreIds: 'genreIds',
  lyricLanguage: 'lyricLanguage',
  packagingLanguage: 'packagingLanguage',
  perspective: 'perspective',
  perspectiveMode: 'perspectiveMode',
  genreBlendMode: 'genreBlendMode',
  seasonId: 'seasonId',
  songCount: 'songCount',
  breadth: 'breadthOverride',
  paletteFamilyId: 'paletteFamilyOverride',
  kidsAgeTierId: 'kidsAgeTierId',
  moodIds: 'moodIds',
  durationTarget: 'durationTarget',
  lyricDepth: 'lyricDepth',
  hookMode: 'hookMode',
  referenceMood: 'referenceMood',
  negativeStyle: 'negativeStyle',
  avoidWords: 'avoidWords'
};

/**
 * TASK (provenance) — generic 'system' recording helper for any code path
 * that force-applies a `Partial<GenerationOptions>` patch outside direct
 * user interaction. Today's one real caller is Step2Plan.tsx's/
 * Step3Generate.tsx's shared applyDesignGateAutoFix (a design-gate issue's
 * own `autoFix()`). Only marks a tracked field 'system' when `fix` actually
 * carries that field's own opts key — every real autoFix today
 * (core/designGate.ts's withVocalTypeAllocation) only ever patches
 * `diversityAllocations`, which isn't one of this task's 13 tracked axes, so
 * this correctly returns `{}` for it; this stays ready for the next autoFix
 * that DOES touch one of the 13 (e.g. a future vocalTone/genreIds autoFix)
 * without needing its call site to know the field-name mapping itself.
 */
export function provenanceForSystemFix(fix: Partial<GenerationOptions>): Partial<GenerationChoiceProvenance> {
  const result: Partial<GenerationChoiceProvenance> = {};
  for (const field of Object.keys(PROVENANCE_FIELD_TO_OPTS_KEY) as (keyof GenerationChoiceProvenance)[]) {
    const optsKey = PROVENANCE_FIELD_TO_OPTS_KEY[field];
    if (Object.prototype.hasOwnProperty.call(fix, optsKey)) result[field] = 'system';
  }
  return result;
}

/**
 * Builds UserExplicitChoices off a live GenerationOptions the way the real
 * app's App.tsx state actually carries it.
 *
 * TASK (provenance) — real, verified gap this closes: every source
 * assignment below used to be RECONSTRUCTED after the fact by inspecting the
 * final GenerationOptions shape (e.g. "genreIds looks user-picked because
 * selectedGenreFamilyIds is also non-empty" — a heuristic that missed a user
 * who only ever clicked genre chips, never the separate family checkboxes),
 * and vocalTone's source was never populated AT ALL despite the field
 * existing on this interface since v5.7 — the exact bug class
 * (v3.77/v4.13's vocal-preset-ignored regressions) this whole module exists
 * to catch could never have been caught for a vocal-tone regression.
 *
 * `opts.choiceProvenance` (types.ts's GenerationChoiceProvenance, recorded at
 * the real moment of each click by Step1Channel.tsx/Step2Concept.tsx/
 * Step2Plan.tsx/Step3Generate.tsx/App.tsx's applyChannelToOptions — see each
 * field's own inline comment below for its exact recording point) is now
 * read FIRST for every one of the 13 tracked axes. The old after-the-fact
 * heuristics (moneyChordModeIsExplicitChoice, perspectiveModeIsExplicitChoice,
 * genreBlendModeIsExplicitChoice, the selectedGenreFamilyIds/paletteFamilyOverride/
 * breadthOverride "presence implies user" checks, "any perspective value
 * reaching here is real") survive ONLY as fallbacks for a GenerationOptions
 * that arrived without live click-time tracking — an old saved/imported pack
 * predating this field, or a hand-built options object in an older test —
 * so every pre-existing caller keeps its previous behavior byte-for-byte.
 * vocalTone/lyricLanguage/packagingLanguage/seasonId/songCount/kidsAgeTierId
 * had no prior heuristic at all (declared on the interface, never wired), so
 * for those six, `choiceProvenance` is the ONLY way source ever gets set.
 */
export function userChoicesFromOptions(opts: Partial<GenerationOptions> & Pick<GenerationOptions, 'moneyChordMode'>): UserExplicitChoices {
  const choices = emptyUserChoices();
  const provenance = opts.choiceProvenance ?? {};

  if (opts.moneyChordMode && opts.moneyChordMode !== 'default') {
    choices.moneyChordMode = opts.moneyChordMode;
    // Recorded at click time by Step2Concept.tsx's money-chord ChoiceGrid and its custom-progression input.
    choices.source.moneyChordMode = provenance.moneyChordMode ?? (opts.moneyChordModeIsExplicitChoice ? 'user' : 'default');
  }
  if (opts.moneyChordMode === 'custom' && opts.customMoneyChord?.trim()) {
    choices.customMoneyChord = opts.customMoneyChord.trim();
    choices.source.customMoneyChord = 'user';
  }
  if (opts.selectedGenreFamilyIds?.length) {
    choices.paletteFamilyId = opts.paletteFamilyOverride;
  }
  if (opts.paletteFamilyOverride) {
    choices.paletteFamilyId = opts.paletteFamilyOverride;
    // Recorded at click time by Step2Plan.tsx's "이 세트의 계열" radio picker and ConceptRecommendationPanel's own family chips (both funnel into the same paletteFamilyOverride setOpts call).
    choices.source.paletteFamilyId = provenance.paletteFamilyId ?? 'user';
  }
  if (opts.breadthOverride) {
    choices.breadth = opts.breadthOverride;
    // Recorded at click time by Step2Plan.tsx's "이 세트의 성격" radio picker.
    choices.source.breadth = provenance.breadth ?? 'user';
  }
  // TASK (provenance) — real, verified gap: the old heuristic required BOTH
  // opts.genreIds.length AND opts.selectedGenreFamilyIds.length, so a user
  // who only ever clicked genre chips (Step2Concept.tsx's selectPrimaryGenre/
  // toggleSecondaryGenre/chooseGenreFromSearch — the ordinary, most common
  // genre-picking path, never touching the separate GenreFamily checkbox
  // control) got choices.source.genreIds left undefined: completely
  // unprotected by assertUserChoicesPreserved. provenance.genreIds (set by
  // every one of those handlers, and by handleApplyConceptRecommendation as
  // 'concept', and by App.tsx's applyChannelToOptions as 'channel') is
  // checked first now; the old family-ids heuristic survives only as the
  // fallback described in this function's own doc comment above.
  if (opts.genreIds?.length) {
    choices.genreIds = opts.genreIds;
    const genreIdsSource = provenance.genreIds ?? (opts.selectedGenreFamilyIds?.length ? 'user' : undefined);
    if (genreIdsSource) choices.source.genreIds = genreIdsSource;
  }
  // TASK (provenance) — real, verified gap: vocalTone had a declared field on
  // this interface (since v5.7) but userChoicesFromOptions never set
  // choices.source.vocalTone anywhere — grep-confirmed. A real vocal-preset
  // regression (the exact v3.77/v4.13 bug class) could never have been
  // caught by assertUserChoicesPreserved's own vocalTone check, because
  // nothing ever fed it a 'user' source to protect. Recorded at click time by
  // Step2Concept.tsx's vocal ChoiceGrid (including the explicit "고르게 배정"
  // balanced card — see that handler's own comment) and its manual text
  // input; 'concept' by handleApplyConceptRecommendation when a recommended
  // vocal preset is actually applied; 'channel' by App.tsx's
  // applyChannelToOptions on channel switch. No legacy heuristic existed for
  // this field, so there is none to fall back to.
  if (opts.vocalTone?.trim()) {
    choices.vocalTone = opts.vocalTone;
    if (provenance.vocalTone) choices.source.vocalTone = provenance.vocalTone;
  }
  // v5.7 follow-up (TASK v5.7 §4-2 verification) — real measurement found
  // this field existed on the UserExplicitChoices interface (declared from
  // this module's original v5.7 session) but was never actually populated
  // here, so setDirector.ts's buildBaseOptions own `choices.source.perspective
  // === 'user'` check (already written, referencing this exact field) could
  // never be true via the real Step2Plan.tsx call path — the "관점(POV)"
  // picker (Step2Concept.tsx's opts.perspective) was silently discarded the
  // moment a real user reached Step2Plan (see setDirector.ts's povCounts own
  // updated doc comment for the full trace). perspective is a required,
  // always-set GenerationOptions field (unlike moneyChordMode's sentinel
  // 'default') with no separate "was this really explicit" flag of its own,
  // so the pre-existing "any value reaching this function is the user's real
  // choice" heuristic survives as the fallback when live provenance (recorded
  // at click time by Step2Concept.tsx's perspective ChoiceGrid) is absent.
  if (opts.perspective) {
    choices.perspective = opts.perspective;
    choices.source.perspective = provenance.perspective ?? 'user';
  }
  // TASK v6.0 (perspectiveMode) — unlike `perspective` just above,
  // perspectiveMode is genuinely optional/undefined on a fresh
  // GenerationOptions (createInitialOptions never sets it — see that
  // function's own doc comment on why 'dominant' the type default is a
  // resolved-elsewhere fallback, not a stored initial value) AND 'dominant'
  // is itself a legitimately clickable choice in Step2Concept's picker (not
  // just a sentinel), so this mirrors moneyChordMode's explicit-choice-flag
  // treatment instead of `perspective`'s "any value reaching here is real"
  // heuristic. Recorded at click time by Step2Concept.tsx's "적용 방식" (POV)
  // ChoiceGrid.
  if (opts.perspectiveMode) {
    choices.perspectiveMode = opts.perspectiveMode;
    choices.source.perspectiveMode = provenance.perspectiveMode ?? (opts.perspectiveModeIsExplicitChoice ? 'user' : 'default');
  }
  // TASK (provenance) — same sentinel-vs-explicit-choice shape as
  // perspectiveMode just above; 'shared-primary' is both the neutral default
  // AND a legitimately clickable choice in Step2Concept's genre "적용 방식"
  // ChoiceGrid, so genreBlendModeIsExplicitChoice survives as the fallback.
  if (opts.genreBlendMode) {
    choices.genreBlendMode = opts.genreBlendMode;
    choices.source.genreBlendMode = provenance.genreBlendMode ?? (opts.genreBlendModeIsExplicitChoice ? 'user' : 'default');
  }
  // TASK (provenance) — declared on this interface but, like vocalTone above,
  // never previously populated by this function. No legacy heuristic existed;
  // only ever comes from live click-time provenance (Step2Concept.tsx's
  // language chips / season chips, App.tsx's applyChannelToOptions for a
  // channel switch, handleApplyConceptRecommendation for seasonId).
  if (opts.lyricLanguage && provenance.lyricLanguage) {
    choices.lyricLanguage = opts.lyricLanguage;
    choices.source.lyricLanguage = provenance.lyricLanguage;
  }
  if (opts.packagingLanguage && provenance.packagingLanguage) {
    choices.packagingLanguage = opts.packagingLanguage;
    choices.source.packagingLanguage = provenance.packagingLanguage;
  }
  if (opts.seasonId && provenance.seasonId) {
    choices.seasonId = opts.seasonId;
    choices.source.seasonId = provenance.seasonId;
  }
  if (opts.songCount && provenance.songCount) {
    choices.songCount = opts.songCount;
    choices.source.songCount = provenance.songCount;
  }
  if (opts.kidsAgeTierId && provenance.kidsAgeTierId) {
    choices.kidsAgeTierId = opts.kidsAgeTierId;
    choices.source.kidsAgeTierId = provenance.kidsAgeTierId;
  }
  if (opts.customLyricThemeScene?.trim()) {
    choices.customLyricThemeScene = opts.customLyricThemeScene.trim();
    choices.source.customLyricThemeScene = 'user';
  }
  // TASK (provenance extension) — moodIds/durationTarget/lyricDepth/hookMode/
  // referenceMood/negativeStyle/avoidWords all follow the exact
  // lyricLanguage/packagingLanguage/seasonId/songCount/kidsAgeTierId pattern
  // just above: no legacy heuristic ever existed for any of them (grep-
  // confirmed — none was ever read by this function before this task), so
  // live choiceProvenance is the ONLY way source is ever set here. See each
  // field's own recording point in Step2Concept.tsx/App.tsx's
  // applyChannelToOptions/handleApplyConceptRecommendation.
  if (opts.moodIds?.length && provenance.moodIds) {
    choices.moodIds = opts.moodIds;
    choices.source.moodIds = provenance.moodIds;
  }
  if (opts.durationTarget && provenance.durationTarget) {
    choices.durationTarget = opts.durationTarget;
    choices.source.durationTarget = provenance.durationTarget;
  }
  if (opts.lyricDepth && provenance.lyricDepth) {
    choices.lyricDepth = opts.lyricDepth;
    choices.source.lyricDepth = provenance.lyricDepth;
  }
  if (opts.hookMode && provenance.hookMode) {
    choices.hookMode = opts.hookMode;
    choices.source.hookMode = provenance.hookMode;
  }
  if (opts.referenceMood?.trim() && provenance.referenceMood) {
    choices.referenceMood = opts.referenceMood.trim();
    choices.source.referenceMood = provenance.referenceMood;
  }
  if (opts.negativeStyle !== undefined && provenance.negativeStyle) {
    choices.negativeStyle = opts.negativeStyle;
    choices.source.negativeStyle = provenance.negativeStyle;
  }
  if (opts.avoidWords?.trim() && provenance.avoidWords) {
    choices.avoidWords = opts.avoidWords;
    choices.source.avoidWords = provenance.avoidWords;
  }
  return choices;
}

export interface AssertionResult {
  ok: boolean;
  violations: string[];
}

export interface ResolvedChoiceCheck {
  /** Money-chord id -> song count actually produced (per moneyChordPlan.ts's real per-song plan, not just the flat opts field). */
  moneyChordCounts?: Record<string, number>;
  vocalToneApplied?: boolean;
  genreIdsUsed?: string[];
  /**
   * TASK (provenance extension) — whether every parsed term of an explicit
   * 'user'-sourced negativeStyle actually shows up in the real per-song
   * exclude text (PreassignedSongSlot.negativeStyleText / SongIdea.excludePrompt).
   * Undefined when there's nothing to check (no explicit negativeStyle
   * choice) — same "undefined means not applicable" convention
   * vocalToneApplied already uses.
   */
  negativeStyleApplied?: boolean;
}

/**
 * TASK (contract screen) — one field of a "user picked X, the pack actually
 * has Y" mismatch, Korean-facing and ready to render. `field` matches this
 * module's own ResolvedGenerationContract.mismatches shape below.
 */
interface StructuredViolation {
  field: 'moneyChordMode' | 'vocalTone' | 'genreIds' | 'negativeStyle';
  messageKo: string;
  selectedKo: string;
  effectiveKo: string;
  reasonKo: string;
}

/**
 * TASK (contract screen) — single source of truth for "did a user's
 * 'user'-sourced choice actually survive resolution", used by BOTH
 * assertUserChoicesPreserved (string violations, the pre-existing dev-mode
 * throw / prod-mode SetPlan.warnings guardrail — see this function's own
 * pre-TASK doc comment above) and buildResolvedGenerationContract's own
 * `mismatches` (the new pre-generation confirmation screen) below, so the
 * two "is this a mismatch" checks can never disagree with each other. Same
 * three checks assertUserChoicesPreserved always ran (byte-identical
 * conditions and message text — this is a pure refactor of that function's
 * old inline body, not a behavior change), just also carrying the
 * structured selected/effective/reason fields the contract screen needs
 * and the plain violations: string[] callers don't.
 */
function computeStructuredViolations(
  choices: UserExplicitChoices,
  resolved: ResolvedChoiceCheck,
  stage: string
): StructuredViolation[] {
  const violations: StructuredViolation[] = [];

  if (choices.source.moneyChordMode === 'user' && choices.moneyChordMode && choices.moneyChordMode !== 'custom') {
    const counts = resolved.moneyChordCounts ?? {};
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const chosenCount = counts[choices.moneyChordMode] ?? 0;
    if (total > 0 && chosenCount === 0) {
      violations.push({
        field: 'moneyChordMode',
        messageKo: `[${stage}] 사용자가 선택한 머니코드 "${choices.moneyChordMode}"가 결과에 0곡 반영되었습니다.`,
        selectedKo: moneyChordPresets[choices.moneyChordMode]?.labelKo ?? choices.moneyChordMode,
        effectiveKo: '기본 진행',
        reasonKo: '선택한 진행이 결과에 반영되지 않았습니다.'
      });
    }
  }

  if (choices.source.vocalTone === 'user' && resolved.vocalToneApplied === false) {
    violations.push({
      field: 'vocalTone',
      messageKo: `[${stage}] 사용자가 선택한 보컬 톤이 배분에 반영되지 않았습니다.`,
      selectedKo: choices.vocalTone ?? '',
      effectiveKo: '기본 보컬',
      reasonKo: '선택한 보컬 톤이 배분에 반영되지 않았습니다.'
    });
  }

  if (choices.source.genreIds === 'user' && choices.genreIds?.length) {
    const used = new Set(resolved.genreIdsUsed ?? []);
    const missing = choices.genreIds.filter(id => !used.has(id));
    if (missing.length === choices.genreIds.length) {
      violations.push({
        field: 'genreIds',
        messageKo: `[${stage}] 사용자가 선택한 장르가 하나도 사용되지 않았습니다: ${missing.join(', ')}`,
        selectedKo: missing.map(id => getGenreById(id)?.label ?? id).join(' · '),
        effectiveKo: '(전부 제외됨)',
        reasonKo: '선택한 장르가 결과에 전혀 사용되지 않았습니다.'
      });
    }
  }

  // TASK (provenance extension) — real gap this closes: negativeStyle now
  // has a live click-time 'user' provenance path (Step2Concept.tsx's Music
  // Exclude styles chips/textarea), but nothing ever checked whether the
  // text actually survived into the real per-song exclude prompt — the same
  // "silent drop" bug class moneyChordMode/vocalTone/genreIds were fixed
  // for. Only fires for a genuinely explicit choice (source === 'user')
  // whose resolver actually reported a real applied/not-applied signal
  // (resolved.negativeStyleApplied !== undefined — buildResolvedGenerationContract
  // only sets this when there's real slot data and a real explicit choice
  // to check, mirroring vocalToneApplied's own convention).
  if (choices.source.negativeStyle === 'user' && choices.negativeStyle?.trim() && resolved.negativeStyleApplied === false) {
    violations.push({
      field: 'negativeStyle',
      messageKo: `[${stage}] 사용자가 입력한 네거티브 스타일이 결과에 반영되지 않았습니다.`,
      selectedKo: choices.negativeStyle,
      effectiveKo: '(반영되지 않음)',
      reasonKo: '입력한 네거티브 스타일 문구가 결과에 반영되지 않았습니다.'
    });
  }

  return violations;
}

/**
 * Checks that every 'user'-sourced field in `choices` actually shows up in
 * `resolved` — the thing that's supposed to catch the NEXT version of this
 * bug automatically instead of waiting for 하루 to notice the output is
 * wrong. Deliberately narrow/mechanical (string-contains / key-presence
 * checks, not music-theory understanding) — its job is "did this get
 * silently dropped", not "is this musically correct".
 */
export function assertUserChoicesPreserved(
  choices: UserExplicitChoices,
  resolved: ResolvedChoiceCheck,
  stage: string
): AssertionResult {
  const violations = computeStructuredViolations(choices, resolved, stage).map(v => v.messageKo);
  return { ok: violations.length === 0, violations };
}

/**
 * Dev-mode variant: throws on the first violation instead of returning a
 * result the caller might forget to check. §1-3's own "개발 모드에서는
 * throw, 운영에서는 blocking" — "운영"(production) is handled by callers
 * reading assertUserChoicesPreserved's own AssertionResult.violations and
 * surfacing it as a UI warning (SetPlan.warnings) rather than crashing a
 * real user's generation.
 */
export function assertUserChoicesPreservedOrThrow(
  choices: UserExplicitChoices,
  resolved: Parameters<typeof assertUserChoicesPreserved>[1],
  stage: string
): void {
  const result = assertUserChoicesPreserved(choices, resolved, stage);
  if (!result.ok) throw new Error(result.violations.join(' / '));
}

/**
 * TASK v5.10 (contract screen) — "did what I picked survive resolution",
 * every axis this app has ever shipped a silent-override bug for (vocal
 * presets v3.77/v4.13, money chord v5.7, genre-archetype contamination
 * v5.9), collected into ONE Korean-facing snapshot a UI screen can render
 * BEFORE generation runs, instead of only after-the-fact via plan.warnings.
 * `field`/`selected`/`effective`/`reasonKo` on a mismatch entry are what
 * Step3Generate.tsx's contract block actually renders — see
 * buildResolvedGenerationContract's own doc comment for how each section is
 * computed and, critically, which existing v5.7-v5.10 machinery it reuses
 * instead of recomputing.
 */
/**
 * TASK (gap 2 — workspace-derivation fix) — non-silent recovery data for a
 * channel whose archetype doesn't belong to the REAL active workspace (the
 * exact case core/generationPreflight.ts's channelArchetypeHardBlock already
 * hard-blocks — this is display/recovery data for that same condition, never
 * a second source of truth for WHETHER it's blocked). The task doc names 4
 * concrete recovery actions a UI can offer; this exposes the data the first
 * two need (the other two — "채널 편집", "채널 삭제" — need no extra data,
 * they just navigate to the existing channel editor/manager, already wired
 * elsewhere in this app).
 */
export interface WorkspaceRecoveryOptions {
  /** True only when `channel.archetype` genuinely doesn't belong to the active workspace's own archetypeIds. Every other field is undefined when there's nothing to recover from. */
  mismatched: boolean;
  /** The workspace this channel's archetype ACTUALLY belongs to (data/workspaces.ts's workspaceForArchetype) — "채널의 워크스페이스로 이동" target. Undefined for an archetype that belongs to no shipped workspace at all (nothing real to navigate to). */
  correctWorkspaceId?: WorkspaceId;
  /** A representative built-in channel preset for the CURRENTLY ACTIVE workspace (the first registered preset whose own archetype belongs to it) — "현재 워크스페이스 기본 채널로 전환" target. Undefined only if the active workspace ships with zero built-in presets (not true for any real workspace today). */
  suggestedDefaultChannel?: ChannelProfile;
}

/**
 * TASK (gap 2) — pure, directly testable. Kept separate from
 * buildResolvedGenerationContract's own body (not just inlined) so a UI
 * layer or another caller can compute recovery options off a bare
 * archetype/workspaceId pair without needing a full opts/choices/slots
 * contract build.
 */
export function computeWorkspaceRecoveryOptions(archetype: ChannelArchetype, activeWorkspaceId: WorkspaceId): WorkspaceRecoveryOptions {
  const activeWorkspace = getWorkspace(activeWorkspaceId);
  if (activeWorkspace.archetypeIds.includes(archetype)) return { mismatched: false };
  const correctWorkspace = workspaceForArchetype(archetype);
  const suggestedDefaultChannel = channelPresets.find(preset => preset.archetype && activeWorkspace.archetypeIds.includes(preset.archetype));
  return {
    mismatched: true,
    correctWorkspaceId: correctWorkspace?.id,
    suggestedDefaultChannel
  };
}

export interface ResolvedGenerationContract {
  /** TASK (gap 2) — the REAL currently-active workspace (whatever the caller's own `activeWorkspaceId` argument to buildResolvedGenerationContract said), never reverse-derived from the channel's own archetype — see that function's own doc comment for the real bug this replaced. */
  workspaceId: WorkspaceId;
  archetype: { selected: ChannelArchetype; effective: ChannelArchetype };
  /** TASK (gap 2) — non-silent recovery data when `channel.archetype` doesn't belong to `workspaceId` above; `mismatched: false` (every other field undefined) otherwise. */
  workspaceRecovery: WorkspaceRecoveryOptions;
  genreIds: { selected: string[]; effective: string[]; removed: string[] };
  /** Real per-song tally off `slots` (id -> song count, sorted by count desc) — what the UI actually renders as "밝은 키즈팝 6 · 어쿠스틱 동요 6". Not in the task doc's own interface sketch verbatim, but genreIds.effective alone (an id pool, no counts) can't render that line without the UI re-deriving the same tally a second time. */
  genreCounts: { id: string; count: number }[];
  moneyChord: { selectedId: string; effectiveIds: string[]; source: 'user' | 'auto' | 'default' };
  /** Same rationale/shape as genreCounts above — core/moneyChordDisplay.ts's own MoneyChordBreakdownEntry[], reused verbatim (not a parallel type). */
  moneyChordCounts: MoneyChordBreakdownEntry[];
  vocal: { selectedPresetId?: string; effectiveQuota: { male: number; female: number; mixed: number }; presetApplied: boolean };
  perspective: { selected: LyricPerspective; effective: LyricPerspective[]; mode: PerspectiveMode; counts: Partial<Record<LyricPerspective, number>> };
  lyricLanguage: LyricLanguage;
  audienceProfileId: string;
  warnings: string[];
  mismatches: { field: string; selected: string; effective: string; reasonKo: string }[];
}

/**
 * Both PreassignedSongSlot and SongIdea carry these 4 fields with identical
 * optional types — the real per-song assignment this function tallies
 * against, regardless of which stage (preview-time preallocation vs. a
 * finished blueprint) the caller has on hand. `negativeStyleText`/
 * `excludePrompt` are each type's own real exclude-text field name
 * (PreassignedSongSlot.negativeStyleText vs. SongIdea.excludePrompt — see
 * types.ts's own doc comments on each); both optional here so either real
 * array structurally satisfies this type without a cast.
 */
type ResolvedSlotLike = Pick<PreassignedSongSlot, 'moneyChordId' | 'genreId' | 'vocalType' | 'pov'> & {
  negativeStyleText?: string;
  excludePrompt?: string;
};

/**
 * TASK (provenance extension) — real per-song check for whether an explicit
 * negativeStyle choice's terms actually show up in the resolved exclude
 * text. Returns true (nothing to flag) whenever there's no explicit choice,
 * no parsed terms, or no slots yet to compare against — mirrors
 * vocalToneApplied/genreIdsUsed's own "only check when there's real signal"
 * convention elsewhere in this file.
 */
function negativeStyleReallyApplied(choices: UserExplicitChoices, slots: readonly ResolvedSlotLike[]): boolean {
  if (choices.source.negativeStyle !== 'user' || !choices.negativeStyle?.trim()) return true;
  const terms = parseNegativeStyleTerms(choices.negativeStyle);
  if (!terms.length || !slots.length) return true;
  const combinedText = slots.map(slot => slot.negativeStyleText ?? slot.excludePrompt ?? '').join(' — ').toLowerCase();
  return terms.every(term => combinedText.includes(term.toLowerCase()));
}

function resolveEffectiveArchetype(channel: GenerationOptions['channel']): ChannelArchetype {
  return migrateArchetype(channel).archetype ?? 'senior-morning';
}

function tallyById(slots: readonly ResolvedSlotLike[], key: 'moneyChordId' | 'genreId'): { id: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const slot of slots) {
    const id = slot[key];
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ id, count }));
}

function tallyVocalQuota(slots: readonly ResolvedSlotLike[]): { male: number; female: number; mixed: number; total: number } {
  const quota = { male: 0, female: 0, mixed: 0, total: 0 };
  for (const slot of slots) {
    if (slot.vocalType) {
      quota[slot.vocalType] += 1;
      quota.total += 1;
    }
  }
  return quota;
}

function tallyPovCounts(slots: readonly ResolvedSlotLike[]): Partial<Record<LyricPerspective, number>> {
  const counts: Partial<Record<LyricPerspective, number>> = {};
  for (const slot of slots) {
    if (slot.pov) counts[slot.pov] = (counts[slot.pov] ?? 0) + 1;
  }
  return counts;
}

/**
 * TASK v5.10 (contract screen) — builds ResolvedGenerationContract from REAL
 * resolved state, reusing existing v5.7-v5.10 machinery rather than
 * recomputing it:
 *  - moneyChord.effectiveIds/source/mismatch text: core/moneyChordDisplay.ts's
 *    computeMoneyChordComparison, fed the SAME per-song tally shape
 *    (MoneyChordBreakdownEntry[]) Step2Plan.tsx's own moneyChordBreakdown
 *    useMemo already derives off real slots — this function derives an
 *    identical tally (tallyById) rather than requiring the caller to hand
 *    one in.
 *  - genreIds.effective/removed: `removed` is still
 *    core/genreSelection.ts's sanitizeGenreIdsForArchetype's own real output
 *    (archetype-eligibility only). `effective` (TASK gap 1 fix) is no
 *    longer that function's `.valid` verbatim — `.valid` is an
 *    OPTION-LEVEL allow-list ("which selected ids are archetype-eligible"),
 *    not a report of what actually got used; `effective` is now `.valid`
 *    filtered down to the ids that actually appear in `slots` (falling back
 *    to the theoretical `.valid` only when `slots` is empty). A genre that's
 *    eligible but still got 0 real songs is surfaced as its own mismatch
 *    (see below), not silently reported as "applied".
 *  - vocal.effectiveQuota: the REAL per-song vocalType tally off `slots`
 *    when slots are non-empty (tallyVocalQuota) — the actual applied
 *    distribution, not merely the theoretical quota target. Falls back to
 *    the v5.9 baseVocalQuota/leaningAdultVocalQuota resolution chain
 *    (core/vocalPlan.ts) only when `slots` is empty (a caller that hasn't
 *    preallocated yet). vocal.presetApplied (TASK gap 1 fix) now checks the
 *    REAL tally too — whether the leaning gender's own vocalType bucket
 *    actually got >=1 real song — not just leaningGenderFor's "was this
 *    vocalTone text even recognized" signal; falls back to the old
 *    recognition-only check (the exact one v5.9's own
 *    batchPreallocation.ts's explicitUnrecognizedVocalTone guard uses) only
 *    when `slots` is empty.
 *  - perspective.effective/mode: core/lyricDiversityPlan.ts's
 *    resolvePerspectiveMode/povDistribution (v5.10 TASK C) — real per-song
 *    pov tally off `slots` when available, else that module's own
 *    theoretical distribution. Already fully slot-derived; unchanged by the
 *    gap-1 fix.
 *  - workspaceId/workspaceRecovery (TASK gap 2 fix): `workspaceId` is now
 *    the caller's own `activeWorkspaceId` argument verbatim — never
 *    reverse-derived via workspaceForArchetype(effectiveArchetype) the way
 *    it used to be. Reverse-derivation meant a genuinely mismatched
 *    channel/workspace pairing computed its own "expected" workspace from
 *    the SAME broken channel data the check was supposed to be validating
 *    against, silently defeating the whole point of a mismatch check.
 *    `workspaceRecovery` (computeWorkspaceRecoveryOptions) surfaces
 *    non-silent recovery data for the UI when the two disagree — purely
 *    informational, never an acknowledgeable `mismatches` entry, since
 *    core/generationPreflight.ts's channelArchetypeHardBlock is the real,
 *    sole (no "proceed anyway") enforcement of this condition.
 *  - mismatches: for the 3 axes assertUserChoicesPreserved already checks
 *    (money-chord-zeroed, vocal-tone-not-applied, genre-completely-dropped),
 *    this reuses computeStructuredViolations directly — the exact same
 *    function assertUserChoicesPreserved itself now calls — so the contract
 *    screen and the dev-throw/prod-warning guardrail can never disagree
 *    about whether a given case is a violation. `genreIdsUsed` fed into it
 *    is now real-slot-derived too (TASK gap 1 fix), not the options-level
 *    allow-list. On top of that shared set, three checks
 *    computeStructuredViolations structurally cannot express are added
 *    directly here: (a) a money-chord chosenCount-zero case detected
 *    generically via computeMoneyChordComparison even when `choices` wasn't
 *    built from real UI provenance (mirrors that module's own "no live
 *    repro today, kept generic for a future regression" stance), (b) a
 *    PARTIAL genre removal (sanitizeGenreIdsForArchetype stripped some but
 *    not all ids) — computeStructuredViolations' own genreIds check is
 *    all-or-nothing by design (mirrors assertUserChoicesPreserved's
 *    pre-existing contract) and was never meant to catch a partial strip,
 *    and (c) TASK gap 1's own new case — a genre that IS archetype-eligible
 *    but still got 0 real songs (an explicit multi-select only, see that
 *    check's own doc comment for why it's gated on choices.source.genreIds
 *    === 'user').
 */
export function buildResolvedGenerationContract(
  opts: GenerationOptions,
  choices: UserExplicitChoices,
  slots: PreassignedSongSlot[] | SongIdea[],
  activeWorkspaceId: WorkspaceId,
  extraWarnings: string[] = []
): ResolvedGenerationContract {
  const effectiveArchetype = resolveEffectiveArchetype(opts.channel);
  const selectedArchetype = opts.channel.archetype ?? effectiveArchetype;
  // TASK (gap 2) — the channel's own NATURAL home workspace (purely a
  // function of its archetype) — still needed for the genre-removal
  // reasonKo below ("이 채널에서 쓸 수 없습니다" names the workspace the
  // channel itself belongs to, not necessarily the one the user is
  // currently active in). Deliberately kept separate from
  // `activeWorkspaceId` (the real currently-active workspace, now a
  // required parameter — see this function's own doc comment for the real
  // bug that reverse-derivation used to cause when the two disagree).
  const channelHomeWorkspace = workspaceForArchetype(effectiveArchetype);
  const audienceProfile = audienceProfileForChannelArchetype(effectiveArchetype, opts.audience);
  const workspaceRecovery = computeWorkspaceRecoveryOptions(effectiveArchetype, activeWorkspaceId);

  // --- genre ---
  const selectedGenreIds = opts.genreIds ?? [];
  const genreSanitization = sanitizeGenreIdsForArchetype(selectedGenreIds, effectiveArchetype);
  const genreCounts = tallyById(slots, 'genreId');
  const genreWarningKo = genreSanitizationWarningKo(genreSanitization.removed, effectiveArchetype);
  // TASK (gap 1) — sanitizeGenreIdsForArchetype's own `.valid` only reports
  // which selected ids are ARCHETYPE-ELIGIBLE (an options-level allow-list),
  // never "which ids actually landed on a real song" — a genre can be
  // perfectly eligible and still get 0 real songs from whatever the real
  // rotation/allocation logic actually decided (a real allocation quirk, a
  // bug, an edge case). `realUsedGenreIds` is the ground truth `genreIds.effective`
  // (below) and the genre-under-allocation mismatch check further down are
  // both built from, instead of the options-level allow-list alone.
  const realUsedGenreIds = new Set(genreCounts.map(entry => entry.id));
  // Falls back to the theoretical genreSanitization.valid only when `slots`
  // is empty (nothing to tally against yet — a caller previewing before any
  // allocation has run).
  const genreEffective = slots.length
    ? genreSanitization.valid.filter(id => realUsedGenreIds.has(id))
    : genreSanitization.valid;

  // --- money chord ---
  const moneyChordCounts = tallyById(slots, 'moneyChordId');
  const moneyChordComparison = computeMoneyChordComparison(opts, moneyChordCounts, opts.songCount);
  const moneyChordSource: ResolvedGenerationContract['moneyChord']['source'] =
    opts.moneyChordModeIsExplicitChoice && opts.moneyChordMode !== 'default'
      ? 'user'
      : moneyChordCounts.length > 0
        ? 'auto'
        : 'default';
  const moneyChordSelectedId = opts.moneyChordMode === 'custom'
    ? (opts.customMoneyChord?.trim() || 'custom')
    : opts.moneyChordMode;
  const moneyChordEffectiveIds = moneyChordCounts.length ? moneyChordCounts.map(entry => entry.id) : [opts.moneyChordMode];

  // --- vocal ---
  const selectedPreset = matchVocalPreset(opts.vocalTone?.trim() ?? '');
  const detectedVocalTone = leaningGenderFor(opts);
  const baseVocalQuota = opts.vocalQuota ?? opts.channel.vocalQuotaOverride
    ?? (isKidsArchetype(effectiveArchetype) ? DEFAULT_KIDS_VOCAL_QUOTA : DEFAULT_ADULT_VOCAL_QUOTA);
  const vocalLeaning = opts.vocalQuota || opts.channel.vocalQuotaOverride ? undefined : detectedVocalTone;
  const theoreticalVocalQuota = vocalLeaning ? leaningAdultVocalQuota(baseVocalQuota, opts.songCount, vocalLeaning) : baseVocalQuota;
  const talliedVocal = tallyVocalQuota(slots);
  const effectiveQuota = talliedVocal.total > 0
    ? { male: talliedVocal.male, female: talliedVocal.female, mixed: talliedVocal.mixed }
    : theoreticalVocalQuota;
  // TASK (gap 1) — presetApplied/vocalToneApplied used to be purely
  // options-level (Boolean(detectedVocalTone) — "was vocalTone's text even
  // RECOGNIZED as a preset/leaning"), never checking whether the recognized
  // lean actually shows up in the REAL per-song vocalType distribution —
  // the exact v3.77/v4.13 bug class (a picked preset recognized fine but
  // never actually reflected in the real per-song plan). Now checked
  // against the real tally when slots exist: the leaning gender's own
  // vocalType bucket (duet AND the group-harmony 'mixed' preset both fold
  // into vocalType 'mixed', matching leaningAdultVocalQuota's own remap)
  // must have gotten at least one real song. Falls back to the old
  // recognition-only check when there's no real tally yet to compare
  // against — and, matching the pre-existing behavior exactly, stays false
  // whenever nothing was leaned toward at all (detectedVocalTone undefined).
  const leanVocalTypeKey: VocalType | undefined = !detectedVocalTone
    ? undefined
    : detectedVocalTone === 'duet' || detectedVocalTone === 'mixed'
      ? 'mixed'
      : detectedVocalTone;
  const vocalToneReallyApplied = !detectedVocalTone
    ? false
    : talliedVocal.total > 0
      ? talliedVocal[leanVocalTypeKey!] > 0
      : true;

  // --- perspective ---
  const mode = resolvePerspectiveMode(opts);
  const talliedPov = tallyPovCounts(slots);
  const talliedPovTotal = Object.values(talliedPov).reduce((sum: number, n) => sum + (n ?? 0), 0);
  const povCounts = talliedPovTotal > 0 ? talliedPov : povDistribution(opts.songCount, opts.perspective, mode);
  const perspectiveEffective = (Object.entries(povCounts) as [LyricPerspective, number][])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  // --- mismatches (shared computeStructuredViolations first, see doc comment above) ---
  const moneyChordCountsRecord = Object.fromEntries(moneyChordCounts.map(entry => [entry.id, entry.count]));
  const structured = computeStructuredViolations(
    choices,
    {
      moneyChordCounts: moneyChordCountsRecord,
      vocalToneApplied: choices.source.vocalTone === 'user' ? vocalToneReallyApplied : undefined,
      // TASK (gap 1) — real per-song usage (falls back to the theoretical
      // allow-list only when there's no real slot data yet), not the
      // options-level allow-list alone — see genreEffective's own doc
      // comment just above for why that distinction matters.
      genreIdsUsed: slots.length ? [...realUsedGenreIds] : genreSanitization.valid,
      // TASK (provenance extension) — only a real signal when there's both
      // an explicit choice AND real slot data to check it against (mirrors
      // vocalToneApplied's own conditional just above).
      negativeStyleApplied: choices.source.negativeStyle === 'user' && slots.length
        ? negativeStyleReallyApplied(choices, slots)
        : undefined
    },
    'contract'
  );
  const mismatches: ResolvedGenerationContract['mismatches'] = structured.map(violation => ({
    field: violation.field,
    selected: violation.selectedKo,
    effective: violation.effectiveKo,
    reasonKo: violation.reasonKo
  }));

  // Generic money-chord zero-count detection (independent of `choices`
  // provenance — see this function's own doc comment §a) — skipped when
  // computeStructuredViolations already reported the same field so a single
  // real mismatch never renders as two entries; either way, the reasonKo
  // shown always names earworm mode when it's actually on (the one concrete,
  // real cause this app has ever had for this class of mismatch), regardless
  // of which of the two checks produced the entry.
  const moneyChordReasonKo = opts.earwormMode
    ? '귀에 잘 붙는 모드가 켜져 있습니다.'
    : '선택한 진행이 이번 생성 결과에 반영되지 않았습니다.';
  const existingMoneyChordMismatch = mismatches.find(entry => entry.field === 'moneyChordMode');
  if (existingMoneyChordMismatch) {
    existingMoneyChordMismatch.reasonKo = moneyChordReasonKo;
  } else if (moneyChordComparison.mismatchWarningKo) {
    const topAppliedId = moneyChordCounts[0]?.id;
    mismatches.push({
      field: 'moneyChordMode',
      selected: moneyChordComparison.chosenLabelKo,
      effective: topAppliedId ? (moneyChordPresets[topAppliedId]?.labelKo ?? topAppliedId) : '기본 진행',
      reasonKo: moneyChordReasonKo
    });
  }

  // Partial genre removal (see this function's own doc comment §b).
  if (genreSanitization.removed.length) {
    mismatches.push({
      field: 'genreIds',
      selected: genreSanitization.removed.map(id => getGenreById(id)?.label ?? id).join(' · '),
      effective: '(제외됨)',
      reasonKo: channelHomeWorkspace?.labelKo ? `${channelHomeWorkspace.labelKo} 채널에서 쓸 수 없습니다.` : '이 채널에서 쓸 수 없습니다.'
    });
  }

  // TASK (gap 1) — a genre that IS archetype-eligible (never touched by the
  // "removed" check just above) but still got 0 real songs — the exact
  // "option-level validity != actual usage" gap this task exists to close
  // (e.g. a user picks 3 valid genres A/B/C and the real rotation logic only
  // ever assigns A). computeStructuredViolations' own genreIds check is
  // deliberately all-or-nothing (fires only when EVERY explicitly-chosen id
  // is missing — see that function's own doc comment); this covers the
  // PARTIAL case it structurally can't (`< explicitStillEligible.length`
  // guards against double-reporting the exact same "everything's gone" case
  // that check already reports with its own message). Scoped to a genuine
  // explicit multi-select (choices.source.genreIds === 'user') — a
  // channel's own preferredGenres CANDIDATE POOL (the ordinary default
  // genreIds source when the user never opened the genre-family picker) is
  // deliberately larger than any one pack's real rotation diversity (see
  // data/presets.ts's own preferredGenres doc comments), so checking it here
  // unconditionally would false-positive on nearly every normal generation.
  if (choices.source.genreIds === 'user' && choices.genreIds?.length) {
    const explicitStillEligible = choices.genreIds.filter(id => genreSanitization.valid.includes(id));
    const explicitUnused = explicitStillEligible.filter(id => !realUsedGenreIds.has(id));
    if (explicitUnused.length && explicitUnused.length < explicitStillEligible.length) {
      const unusedLabelsKo = explicitUnused.map(id => getGenreById(id)?.label ?? id).join(' · ');
      mismatches.push({
        field: 'genreIds',
        selected: unusedLabelsKo,
        effective: genreCounts.length ? genreCounts.map(entry => getGenreById(entry.id)?.label ?? entry.id).join(' · ') : '(반영된 장르 없음)',
        reasonKo: `장르 ${unusedLabelsKo}가 결과에 반영되지 않았습니다.`
      });
    }
  }

  // TASK (gap 2) — informational only, never an acknowledgeable mismatch:
  // core/generationPreflight.ts's channelArchetypeHardBlock is the real,
  // sole enforcement (a hard block with no "proceed anyway" path) — this
  // warning and workspaceRecovery just make the SAME real condition visible
  // on the contract screen instead of silently relying on a separately
  // reverse-derived (and, before this fix, WRONG) workspaceId.
  const workspaceMismatchWarningKo = workspaceRecovery.mismatched
    ? `⚠ 채널 "${opts.channel.name}"의 유형(${effectiveArchetype})은 현재 워크스페이스(${getWorkspace(activeWorkspaceId).labelKo})에서 사용할 수 없습니다.`
    : undefined;

  const warnings = Array.from(new Set([
    ...extraWarnings,
    ...(genreWarningKo ? [genreWarningKo] : []),
    ...(moneyChordComparison.mismatchWarningKo ? [moneyChordComparison.mismatchWarningKo] : []),
    ...(workspaceMismatchWarningKo ? [workspaceMismatchWarningKo] : [])
  ]));

  return {
    workspaceId: activeWorkspaceId,
    archetype: { selected: selectedArchetype, effective: effectiveArchetype },
    workspaceRecovery,
    genreIds: { selected: selectedGenreIds, effective: genreEffective, removed: genreSanitization.removed },
    genreCounts,
    moneyChord: { selectedId: moneyChordSelectedId, effectiveIds: moneyChordEffectiveIds, source: moneyChordSource },
    moneyChordCounts,
    vocal: { selectedPresetId: selectedPreset?.id, effectiveQuota, presetApplied: vocalToneReallyApplied },
    perspective: { selected: opts.perspective, effective: perspectiveEffective, mode, counts: povCounts },
    lyricLanguage: opts.lyricLanguage,
    audienceProfileId: audienceProfile.id,
    warnings,
    mismatches
  };
}

/**
 * TASK v5.10 (contract screen) — pure "should this generation be allowed to
 * proceed" predicate, kept separate from any React state so it's directly
 * unit-testable: blocked whenever a real mismatch exists for a field the
 * caller hasn't explicitly acknowledged this attempt (see this task's own
 * spec: "생성 액션이 발동하지 않아야" until an explicit per-mismatch "이대로
 * 진행" click — never a persisted global toggle, so `acknowledgedFields` is
 * always caller-owned, per-attempt state, never read from storage here).
 */
export function generationBlockedByContract(
  contract: Pick<ResolvedGenerationContract, 'mismatches'>,
  acknowledgedFields: ReadonlySet<string> = new Set()
): boolean {
  return contract.mismatches.some(mismatch => !acknowledgedFields.has(mismatch.field));
}
