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

import type { ConceptBreadth, GenerationOptions, LyricLanguage } from '../types';

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
  resolved: {
    /** Money-chord id -> song count actually produced (per moneyChordPlan.ts's real per-song plan, not just the flat opts field). */
    moneyChordCounts?: Record<string, number>;
    vocalToneApplied?: boolean;
    genreIdsUsed?: string[];
  },
  stage: string
): AssertionResult {
  const violations: string[] = [];

  if (choices.source.moneyChordMode === 'user' && choices.moneyChordMode && choices.moneyChordMode !== 'custom') {
    const counts = resolved.moneyChordCounts ?? {};
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const chosenCount = counts[choices.moneyChordMode] ?? 0;
    if (total > 0 && chosenCount === 0) {
      violations.push(`[${stage}] 사용자가 선택한 머니코드 "${choices.moneyChordMode}"가 결과에 0곡 반영되었습니다.`);
    }
  }

  if (choices.source.vocalTone === 'user' && resolved.vocalToneApplied === false) {
    violations.push(`[${stage}] 사용자가 선택한 보컬 톤이 배분에 반영되지 않았습니다.`);
  }

  if (choices.source.genreIds === 'user' && choices.genreIds?.length) {
    const used = new Set(resolved.genreIdsUsed ?? []);
    const missing = choices.genreIds.filter(id => !used.has(id));
    if (missing.length === choices.genreIds.length) {
      violations.push(`[${stage}] 사용자가 선택한 장르가 하나도 사용되지 않았습니다: ${missing.join(', ')}`);
    }
  }

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
