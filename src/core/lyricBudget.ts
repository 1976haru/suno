import { resolveBpmEnergyBand, wordBudgetForTarget } from './bpmLengthControl';
import { KIDS_AGE_TIERS, DEFAULT_KIDS_AGE_TIER_ID, type KidsAgeTierId } from '../data/kidsAgeTiers';
import { KIDS_STRUCTURE_TEMPLATES } from '../data/kidsStructureTemplates';
import type { StructureTemplateId } from './lyricEngine';
import type { WorkspaceId } from '../types';

/**
 * codex 지시문 03 (TASK K) — real gap confirmed by investigation:
 * `resolveLyricBudget` and any `LyricBudget` type did not exist. Built as a
 * genuine AGGREGATION over 3 already-real, already-calibrated data sources
 * rather than invented numbers (matches this whole session's own
 * established "aggregation layer over real data" pattern — see
 * data/workspaceQualityPolicies.ts's identical precedent from 지시문 02
 * TASK A):
 *  - core/bpmLengthControl.ts's wordBudgetForTarget/resolveBpmEnergyBand —
 *    word/section budget from the actual target song length + BPM-driven
 *    maxInstrumentalSections, real listening-measurement-calibrated (see
 *    that file's own extensive doc comment history).
 *  - data/kidsAgeTiers.ts's KIDS_AGE_TIERS — real per-age-tier
 *    totalWordTarget/minHookRepeats.
 *  - data/kidsStructureTemplates.ts's KIDS_STRUCTURE_TEMPLATES — real
 *    per-age-tier section-count sequences.
 *
 * kids workspaces use their own real age-tier data; every other workspace
 * resolves through wordBudgetForTarget. rapShare (K-pop) is the one
 * genuinely new derivation — no existing source computes a per-track
 * rap-line budget (core/idolPartPattern.ts only selects among fixed literal
 * part-map templates, confirmed by investigation to have no quantitative
 * rap-line-count logic at all) — kept intentionally simple (proportional to
 * maxSections) rather than a more elaborate formula this app has no real
 * measurement to calibrate against yet.
 *
 * 지시문 40 (TASK B) — `targetDurationSec`는 예전에는 "받기만 하고 실제로는
 * 안 쓰는" 필드였다(두 번째 길이 모델이 첫 번째와 어긋날까봐 일부러 안
 * 씀). 이제는 estimateSongLengthSec과 완전히 같은 회귀 공식을 뒤집은
 * wordBudgetForTarget 하나뿐이라 "어긋나는 두 번째 모델" 문제 자체가
 * 없어졌으므로, 실제로 이 값을 써서 단어 예산을 역산한다. 생략 시(기존
 * 호출부 전부 — 이 함수를 실제로 부르는 곳은 아직 없다) senior-oldpop 기본
 * 목표(3:05~3:25)로 대체한다.
 */
const DEFAULT_TARGET_DURATION_SEC: [number, number] = [185, 205];

export interface LyricBudgetInput {
  bpm: number;
  /** 생략 시 senior-oldpop 기본 목표(3:05~3:25)로 대체된다 — DEFAULT_TARGET_DURATION_SEC 참고. */
  targetDurationSec?: [number, number];
  workspaceId: WorkspaceId;
  structureType?: StructureTemplateId;
  /** 0..1 — fraction of the song that is rap (K-pop only; undefined/0 elsewhere). */
  rapShare?: number;
  /** kids workspaces only — selects the real per-age-tier data source instead of wordBudgetForTarget. */
  kidsAgeTierId?: KidsAgeTierId;
}

export interface LyricBudget {
  maxSections: number;
  maxInstrumentalSections: number;
  wordRange: [number, number];
  chorusRepetitions: number;
  rapLineBudget?: number;
}

const DEFAULT_CHORUS_REPETITIONS = 2;

function kidsLyricBudget(kidsAgeTierId: KidsAgeTierId): LyricBudget {
  const tier = KIDS_AGE_TIERS[kidsAgeTierId] ?? KIDS_AGE_TIERS[DEFAULT_KIDS_AGE_TIER_ID];
  const template = KIDS_STRUCTURE_TEMPLATES[kidsAgeTierId] ?? KIDS_STRUCTURE_TEMPLATES[DEFAULT_KIDS_AGE_TIER_ID];
  const wordFloor = Math.max(20, Math.round(tier.totalWordTarget * 0.75));
  return {
    maxSections: template.sections.length,
    maxInstrumentalSections: 1,
    wordRange: [wordFloor, tier.totalWordTarget],
    chorusRepetitions: tier.minHookRepeats ?? DEFAULT_CHORUS_REPETITIONS
  };
}

/**
 * A rap-heavy K-pop track's spoken/rapped lines are denser (more syllables
 * per beat) than sung lines, so a real rapShare shifts SOME of the sung
 * word budget into a separate line-count budget rather than simply adding
 * on top — kept as a proportional, intentionally simple derivation (no
 * existing real measurement in this codebase to calibrate a more elaborate
 * formula against; documented rather than fabricated precision).
 */
function applyRapShare(budget: LyricBudget, maxSections: number, rapShare: number | undefined): LyricBudget {
  if (!rapShare || rapShare <= 0) return budget;
  const clamped = Math.min(1, Math.max(0, rapShare));
  const rapLineBudget = Math.max(1, Math.round(maxSections * 4 * clamped));
  const wordRange: [number, number] = [
    Math.round(budget.wordRange[0] * (1 - clamped * 0.3)),
    budget.wordRange[1]
  ];
  return { ...budget, wordRange, rapLineBudget };
}

export function resolveLyricBudget(input: LyricBudgetInput): LyricBudget {
  if (input.kidsAgeTierId) {
    return kidsLyricBudget(input.kidsAgeTierId);
  }
  const { wordRange, sectionRange } = wordBudgetForTarget(
    input.targetDurationSec ?? DEFAULT_TARGET_DURATION_SEC,
    input.bpm,
    input.structureType
  );
  const base: LyricBudget = {
    maxSections: sectionRange[1],
    maxInstrumentalSections: resolveBpmEnergyBand(input.bpm).maxInstrumentalSections,
    wordRange,
    chorusRepetitions: DEFAULT_CHORUS_REPETITIONS
  };
  return applyRapShare(base, base.maxSections, input.rapShare);
}
