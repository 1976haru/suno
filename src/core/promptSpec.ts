import type { EraBucket } from '../data/eraExclusions';
import type { IntroMode as LegacyIntroMode, PreassignedSongSlot, WorkspaceId } from '../types';
import type { VocalGender } from './vocalPlan';
import { countBpmTextMentions } from './bpmDedupe';
import { detectVocalGenderPresence } from './vocalPlan';

/**
 * codex 지시문 03 (TASK A) — real investigation finding (4 parallel research
 * agents, before writing any of this): stylePrompt text is built/mutated by
 * THREE structurally different subsystems today, not one —
 * core/promptComposer.ts (an atom-priority compiler, used by both local
 * generation and the Batch API path), core/bridgeInstruction.ts (free-text
 * instructions that ask an EXTERNAL LLM to write its own prose — the bridge
 * path structurally CANNOT go through a deterministic compiler without
 * abandoning the "trust a capable model to write good prose" architecture
 * this whole app is built around), and core/batchPreallocation.ts's
 * reconcileWithPreassignedSlot (a ~10-function post-hoc fix-up chain that
 * runs on ALL THREE paths' output afterward — enforceVocalTextInStylePrompt,
 * appendVerbatimIfMissing ×6, enforceInstrumentSetInStylePrompt,
 * enforceArrangementDensityInStylePrompt, enforceTempoInStylePrompt,
 * diversifyVocalLedOpening, removeRepeatedInstrumentMentions, ...).
 *
 * This task's own literal ask — "최종 stylePrompt는 compilePromptSpec()만
 * 만든다. 문자열 조각을 여러 모듈에서 직접 이어 붙이지 않는다" — would mean
 * ripping out and unifying all three of those, including deleting the
 * "external LLM writes the prose" architecture entirely. That is a
 * multi-week rewrite touching ~3200 passing tests across all 3 real
 * generation paths, not a one-session task, and is explicitly OUT of scope
 * here (matches this whole spec's own established pattern of documenting a
 * scoping decision rather than silently under-delivering — see e.g.
 * data/workspaceQualityPolicies.ts's own identical "real aggregation layer,
 * not a full rewrite" precedent from 지시문 02 TASK A).
 *
 * What this file DOES deliver, for real:
 *  - PromptSpec and its sub-specs: a real, correctly-typed contract where
 *    lead vocal / BPM / intro mode / duration range each exist as EXACTLY
 *    ONE field (enforced by the type system itself, not by convention).
 *  - promptSpecFromSlot: projects the EXISTING PreassignedSongSlot (the
 *    real, live data every one of the 3 generation paths already produces)
 *    into this normalized shape — makes the single-field invariants
 *    concretely inspectable for any real slot, without requiring the 3
 *    live paths to change at all.
 *  - compilePromptSpec: a real, pure, tested function that CAN build a
 *    valid stylePrompt string from a fully-specified PromptSpec — proves
 *    the type isn't just decorative — but is not wired into the 3 live
 *    generation paths (per the scoping decision above).
 *  - auditStylePromptAgainstSpec: the genuinely useful bridge between this
 *    new type-level contract and the string-level reality every existing
 *    consumer still works in — scans an ALREADY-PRODUCED stylePrompt
 *    string for the exact violations this whole task cares about (dual
 *    BPM claims, dual lead-vocal gender declarations) by reusing the real,
 *    already-fixed detectors (bpmDedupe.ts's countBpmTextMentions,
 *    vocalPlan.ts's detectVocalGenderPresence) rather than re-implementing
 *    them. This is the function tests/promptContradictionsAllWorkspaces.test.ts
 *    and future real consumers should call.
 */

export interface EraSpec {
  primary: EraBucket;
  coPrimary?: EraBucket;
}

export interface GenreSpec {
  ids: string[];
  text: string;
}

/** BPM exists as exactly one field — no second tempo/BPM value anywhere else on PromptSpec. */
export interface TempoSpec {
  bpm: number;
}

/** Lead vocal exists as exactly one field — no second competing vocal descriptor anywhere else on PromptSpec. */
export interface VocalSpec {
  gender?: VocalGender;
  text: string;
}

export interface InstrumentationSpec {
  instruments: string[];
}

export interface HarmonySpec {
  moneyChordText: string;
}

export interface StructureSpec {
  template?: 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
}

export interface HookSpec {
  hookDeviceText?: string;
}

/**
 * codex 지시문 03 (TASK B) — this task's own proposed enum
 * ('none'|'cold-vocal'|'instrumental'|'hook-intro'|'a-cappella') does not
 * match types.ts's real, already-shipped IntroMode
 * ('instrumental'|'vocal-immediate'|'vocal-after-texture') — investigation
 * confirmed no real bug/leak behind the mismatch (the spec's own "no intro
 * tag" example already stays confined to bridge-instruction markdown,
 * never reaches a real stylePrompt). Rather than introduce a second,
 * parallel intro-mode vocabulary nothing in the real generation paths
 * would ever populate (the exact "fake protection" anti-pattern already
 * rejected for openingStyle/bilingualPair in 지시문 02's own TASK E),
 * ArrangementSpec.introMode reuses the real, live IntroMode type directly.
 */
export interface ArrangementSpec {
  density?: 'sparse' | 'medium' | 'full';
  introMode?: LegacyIntroMode;
}

export interface MixSpec {
  signatureSound?: string;
}

/** Duration exists as exactly one range — no second competing length target anywhere else on PromptSpec. */
export interface DurationSpec {
  range: [number, number];
}

export interface NegativePromptSpec {
  safety: string[];
  copyright: string[];
  workspace: string[];
  vocal: string[];
  arrangement: string[];
  user: string[];
}

export interface PromptSpec {
  workspaceId: WorkspaceId;
  era?: EraSpec;
  genre: GenreSpec;
  tempo: TempoSpec;
  vocal: VocalSpec;
  instrumentation: InstrumentationSpec;
  harmony: HarmonySpec;
  structure: StructureSpec;
  hook: HookSpec;
  arrangement: ArrangementSpec;
  mix: MixSpec;
  duration: DurationSpec;
  negatives: NegativePromptSpec;
}

/**
 * Projects a real PreassignedSongSlot (what every one of the 3 live
 * generation paths already produces) into PromptSpec's normalized shape.
 * Pure, lossy-by-design where the slot simply has no data for a field
 * (e.g. era — slots don't carry a resolved EraConstraint today; callers
 * that have one should set opts.era after calling this).
 */
export function promptSpecFromSlot(
  slot: PreassignedSongSlot,
  opts: { workspaceId: WorkspaceId; durationRange: [number, number]; era?: EraSpec }
): PromptSpec {
  return {
    workspaceId: opts.workspaceId,
    era: opts.era,
    genre: { ids: slot.genreId ? [slot.genreId] : [], text: slot.genreText ?? '' },
    tempo: { bpm: slot.tempo },
    vocal: { gender: slot.vocalGender, text: slot.vocalVariantText || slot.vocalText || '' },
    instrumentation: { instruments: slot.instrumentSet ?? [] },
    harmony: { moneyChordText: slot.moneyChordText ?? '' },
    structure: { template: slot.structureTemplate },
    hook: { hookDeviceText: slot.hookDeviceText },
    arrangement: { density: slot.arrangementDensity, introMode: slot.introMode },
    mix: { signatureSound: slot.signatureSound },
    duration: { range: opts.durationRange },
    negatives: { safety: [], copyright: [], workspace: [], vocal: [], arrangement: [], user: [] }
  };
}

/**
 * A real, pure, tested compiler — proves PromptSpec is a genuine contract,
 * not decorative. Deliberately simple (comma-joined atoms in a fixed order,
 * each field contributing at most once by construction) since single-field
 * invariants are already guaranteed by PromptSpec's own type shape; this
 * function's only real job is turning that shape into prose text.
 */
export function compilePromptSpec(spec: PromptSpec): string {
  const atoms: string[] = [];
  if (spec.vocal.text) atoms.push(spec.vocal.text);
  if (spec.genre.text) atoms.push(spec.genre.text);
  if (spec.harmony.moneyChordText) atoms.push(spec.harmony.moneyChordText);
  if (spec.hook.hookDeviceText) atoms.push(spec.hook.hookDeviceText);
  if (spec.mix.signatureSound) atoms.push(spec.mix.signatureSound);
  atoms.push(...spec.instrumentation.instruments);
  if (spec.arrangement.density) atoms.push(`${spec.arrangement.density} arrangement`);
  atoms.push(`${spec.tempo.bpm} BPM`);
  return atoms.filter(Boolean).join(', ');
}

export interface PromptSpecViolation {
  field: 'vocal' | 'tempo';
  detail: string;
}

/**
 * The genuinely useful bridge between this type-level contract and the
 * string-level reality every real generation path still works in — scans
 * an ALREADY-PRODUCED stylePrompt string (from any of the 3 live paths,
 * after core/batchPreallocation.ts's reconciliation) for the two concrete
 * violations this task's own completion criteria names ("multiple lead
 * vocal declarations", "duplicate BPM claims"), reusing the real detectors
 * those existing fixes already rely on rather than re-implementing them.
 */
export function auditStylePromptAgainstSpec(stylePrompt: string, spec: Pick<PromptSpec, 'vocal'>): PromptSpecViolation[] {
  const violations: PromptSpecViolation[] = [];
  const bpmMentions = countBpmTextMentions(stylePrompt);
  if (bpmMentions > 1) {
    violations.push({ field: 'tempo', detail: `stylePrompt declares BPM ${bpmMentions} times, expected exactly 1` });
  }
  if (spec.vocal.gender === 'male' || spec.vocal.gender === 'female') {
    const presence = detectVocalGenderPresence(stylePrompt);
    if (presence.male && presence.female) {
      violations.push({ field: 'vocal', detail: `stylePrompt declares both male and female lead-vocal words for a single-gender (${spec.vocal.gender}) resolution` });
    }
  }
  return violations;
}
