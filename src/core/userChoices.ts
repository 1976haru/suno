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
  ConceptBreadth,
  GenerationOptions,
  LyricLanguage,
  LyricPerspective,
  PerspectiveMode,
  PreassignedSongSlot,
  SongIdea,
  WorkspaceId
} from '../types';
import { migrateArchetype } from '../data/presets';
import { workspaceForArchetype } from '../data/workspaces';
import { audienceProfileForChannelArchetype } from '../data/audienceProfiles';
import { getGenreById } from '../data/genreLibrary';
import { moneyChordPresets } from '../data/moneyChords';
import { computeMoneyChordComparison, type MoneyChordBreakdownEntry } from './moneyChordDisplay';
import { genreSanitizationWarningKo, sanitizeGenreIdsForArchetype } from './genreSelection';
import { DEFAULT_ADULT_VOCAL_QUOTA, DEFAULT_KIDS_VOCAL_QUOTA, leaningAdultVocalQuota, leaningGenderFor } from './vocalPlan';
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
  songCount?: number;
  /** v5.7 follow-up (TASK v5.7 §4-2 verification) — DiversityAllocationPanel's "직접 주제/상황" free-text field; see setDirector.ts's buildBaseOptions own doc comment for the real gap this closes. */
  customLyricThemeScene?: string;

  /** Per-field provenance — only 'user' entries are protected by assertUserChoicesPreserved. Keys not present here are treated as 'default'. */
  source: Partial<Record<keyof Omit<UserExplicitChoices, 'source'>, 'user' | 'default' | 'concept'>>;
}

export function emptyUserChoices(): UserExplicitChoices {
  return { source: {} };
}

/**
 * Builds UserExplicitChoices off a live GenerationOptions the way the real
 * app's App.tsx state actually carries it. Money-chord provenance uses the
 * explicit moneyChordModeIsExplicitChoice flag when the caller set it
 * (Step2Concept's picker does); every other axis falls back to the
 * "differs from the neutral default" heuristic this task's own §2-2 uses
 * operationally ("사용자가 머니코드를 선택했을 때 (source === 'user')" is
 * defined by contrast with "사용자가 선택하지 않았을 때 (기본값)") — a
 * pragmatic stand-in for screens that don't yet track provenance per-field,
 * documented here rather than silently assumed elsewhere.
 */
export function userChoicesFromOptions(opts: Partial<GenerationOptions> & Pick<GenerationOptions, 'moneyChordMode'>): UserExplicitChoices {
  const choices = emptyUserChoices();
  if (opts.moneyChordMode && opts.moneyChordMode !== 'default') {
    choices.moneyChordMode = opts.moneyChordMode;
    choices.source.moneyChordMode = opts.moneyChordModeIsExplicitChoice ? 'user' : 'default';
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
    choices.source.paletteFamilyId = 'user';
  }
  if (opts.breadthOverride) {
    choices.breadth = opts.breadthOverride;
    choices.source.breadth = 'user';
  }
  if (opts.genreIds?.length && opts.selectedGenreFamilyIds?.length) {
    choices.genreIds = opts.genreIds;
    choices.source.genreIds = 'user';
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
  // so — matching how vocalTone/genreIds are treated here when present —
  // any value reaching this function is treated as the user's real choice.
  if (opts.perspective) {
    choices.perspective = opts.perspective;
    choices.source.perspective = 'user';
  }
  // TASK v6.0 (perspectiveMode) — unlike `perspective` just above,
  // perspectiveMode is genuinely optional/undefined on a fresh
  // GenerationOptions (createInitialOptions never sets it — see that
  // function's own doc comment on why 'dominant' the type default is a
  // resolved-elsewhere fallback, not a stored initial value) AND 'dominant'
  // is itself a legitimately clickable choice in Step2Concept's picker (not
  // just a sentinel), so this mirrors moneyChordMode's explicit-choice-flag
  // treatment instead of `perspective`'s "any value reaching here is real"
  // heuristic.
  if (opts.perspectiveMode) {
    choices.perspectiveMode = opts.perspectiveMode;
    choices.source.perspectiveMode = opts.perspectiveModeIsExplicitChoice ? 'user' : 'default';
  }
  if (opts.customLyricThemeScene?.trim()) {
    choices.customLyricThemeScene = opts.customLyricThemeScene.trim();
    choices.source.customLyricThemeScene = 'user';
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
}

/**
 * TASK (contract screen) — one field of a "user picked X, the pack actually
 * has Y" mismatch, Korean-facing and ready to render. `field` matches this
 * module's own ResolvedGenerationContract.mismatches shape below.
 */
interface StructuredViolation {
  field: 'moneyChordMode' | 'vocalTone' | 'genreIds';
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
export interface ResolvedGenerationContract {
  workspaceId: WorkspaceId;
  archetype: { selected: ChannelArchetype; effective: ChannelArchetype };
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

/** Both PreassignedSongSlot and SongIdea carry these 4 fields with identical optional types — the real per-song assignment this function tallies against, regardless of which stage (preview-time preallocation vs. a finished blueprint) the caller has on hand. */
type ResolvedSlotLike = Pick<PreassignedSongSlot, 'moneyChordId' | 'genreId' | 'vocalType' | 'pov'>;

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
 *  - genreIds.effective/removed: core/genreSelection.ts's
 *    sanitizeGenreIdsForArchetype, called directly (its own real output,
 *    not re-derived).
 *  - vocal.effectiveQuota: the REAL per-song vocalType tally off `slots`
 *    when slots are non-empty (tallyVocalQuota) — the actual applied
 *    distribution, not merely the theoretical quota target. Falls back to
 *    the v5.9 baseVocalQuota/leaningAdultVocalQuota resolution chain
 *    (core/vocalPlan.ts) only when `slots` is empty (a caller that hasn't
 *    preallocated yet). vocal.presetApplied reuses leaningGenderFor's own
 *    recognition signal — the exact "was this vocalTone recognized" check
 *    v5.9 fixed batchPreallocation.ts's explicitUnrecognizedVocalTone
 *    guard with.
 *  - perspective.effective/mode: core/lyricDiversityPlan.ts's
 *    resolvePerspectiveMode/povDistribution (v5.10 TASK C) — real per-song
 *    pov tally off `slots` when available, else that module's own
 *    theoretical distribution.
 *  - mismatches: for the 3 axes assertUserChoicesPreserved already checks
 *    (money-chord-zeroed, vocal-tone-not-applied, genre-completely-dropped),
 *    this reuses computeStructuredViolations directly — the exact same
 *    function assertUserChoicesPreserved itself now calls — so the contract
 *    screen and the dev-throw/prod-warning guardrail can never disagree
 *    about whether a given case is a violation. On top of that shared set,
 *    two checks computeStructuredViolations structurally cannot express are
 *    added directly here: (a) a money-chord chosenCount-zero case detected
 *    generically via computeMoneyChordComparison even when `choices` wasn't
 *    built from real UI provenance (mirrors that module's own "no live
 *    repro today, kept generic for a future regression" stance), and (b) a
 *    PARTIAL genre removal (sanitizeGenreIdsForArchetype stripped some but
 *    not all ids) — computeStructuredViolations' own genreIds check is
 *    all-or-nothing by design (mirrors assertUserChoicesPreserved's
 *    pre-existing contract) and was never meant to catch a partial strip.
 */
export function buildResolvedGenerationContract(
  opts: GenerationOptions,
  choices: UserExplicitChoices,
  slots: PreassignedSongSlot[] | SongIdea[],
  extraWarnings: string[] = []
): ResolvedGenerationContract {
  const effectiveArchetype = resolveEffectiveArchetype(opts.channel);
  const selectedArchetype = opts.channel.archetype ?? effectiveArchetype;
  const workspace = workspaceForArchetype(effectiveArchetype);
  const audienceProfile = audienceProfileForChannelArchetype(effectiveArchetype, opts.audience);

  // --- genre ---
  const selectedGenreIds = opts.genreIds ?? [];
  const genreSanitization = sanitizeGenreIdsForArchetype(selectedGenreIds, effectiveArchetype);
  const genreCounts = tallyById(slots, 'genreId');
  const genreWarningKo = genreSanitizationWarningKo(genreSanitization.removed, effectiveArchetype);

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
      vocalToneApplied: choices.source.vocalTone === 'user' ? Boolean(detectedVocalTone) : undefined,
      genreIdsUsed: genreSanitization.valid
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
      reasonKo: workspace?.labelKo ? `${workspace.labelKo} 채널에서 쓸 수 없습니다.` : '이 채널에서 쓸 수 없습니다.'
    });
  }

  const warnings = Array.from(new Set([
    ...extraWarnings,
    ...(genreWarningKo ? [genreWarningKo] : []),
    ...(moneyChordComparison.mismatchWarningKo ? [moneyChordComparison.mismatchWarningKo] : [])
  ]));

  return {
    workspaceId: (workspace?.id ?? 'senior-oldpop') as WorkspaceId,
    archetype: { selected: selectedArchetype, effective: effectiveArchetype },
    genreIds: { selected: selectedGenreIds, effective: genreSanitization.valid, removed: genreSanitization.removed },
    genreCounts,
    moneyChord: { selectedId: moneyChordSelectedId, effectiveIds: moneyChordEffectiveIds, source: moneyChordSource },
    moneyChordCounts,
    vocal: { selectedPresetId: selectedPreset?.id, effectiveQuota, presetApplied: Boolean(detectedVocalTone) },
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
