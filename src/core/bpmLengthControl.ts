import type { StructureTemplateId } from './lyricEngine';

/**
 * v3.82 (TASK B) — real cause of T7's 4:16 (target 3:15-3:35): word count
 * was nearly identical to T1/T4 (215 vs 216/218), but T7 had 9 sections +
 * 2 instrumental-type sections against T1/T4's 8+1, AND all three tracks
 * share the same 81 BPM — a slow tempo makes every section audibly LONGER
 * in real time even when the section COUNT and word budget stay flat, since
 * neither ever varied with BPM before this task. This module is the single
 * source of truth for "how many sections / words / instrumental-type
 * sections does a song at BPM X get" — consulted at design time
 * (core/designGate.ts's new song-length-estimate check) and threaded into
 * the actual per-track slot (core/batchPreallocation.ts / core/localGenerator.ts)
 * so both local generation and the Claude Code bridge instruction
 * (core/promptComposer.ts / core/bridgeInstruction.ts) tell the composer
 * the same BPM-appropriate target instead of one flat number for every tempo.
 */

export interface BpmLengthTier {
  minBpm: number;
  maxBpm: number;
  sectionRange: [number, number];
  wordRange: [number, number];
  /** Total instrumental-only sections allowed, INCLUDING the intro if it's instrumental (see this task's own §2-1 real numbers: T1/T4/T10 all read "악기 구간 1개" for just their intro; T7's extra mid-song "Instrumental Break" made it 2). */
  maxInstrumentalSections: number;
}

/** Spec's own §2-3 table, verbatim. Ordered low-to-high BPM; resolveBpmLengthTier clamps anything outside 62-112 to the nearest edge tier rather than returning nothing — every real track has SOME tier to target. */
export const BPM_LENGTH_TIERS: readonly BpmLengthTier[] = [
  { minBpm: 62, maxBpm: 78, sectionRange: [6, 7], wordRange: [180, 200], maxInstrumentalSections: 1 },
  { minBpm: 79, maxBpm: 92, sectionRange: [7, 8], wordRange: [200, 220], maxInstrumentalSections: 1 },
  { minBpm: 93, maxBpm: 104, sectionRange: [7, 8], wordRange: [215, 235], maxInstrumentalSections: 2 },
  { minBpm: 105, maxBpm: 112, sectionRange: [8, 9], wordRange: [225, 245], maxInstrumentalSections: 2 }
];

/** Clamps out-of-table BPM (e.g. a channel with a wider tempoFloor/tempoCeiling than 62-112) to the nearest edge tier rather than throwing or returning undefined — a design-time estimate always needs SOME target. */
export function resolveBpmLengthTier(bpm: number): BpmLengthTier {
  if (bpm <= BPM_LENGTH_TIERS[0].maxBpm) return BPM_LENGTH_TIERS[0];
  const last = BPM_LENGTH_TIERS[BPM_LENGTH_TIERS.length - 1];
  if (bpm >= last.minBpm) return last;
  return BPM_LENGTH_TIERS.find(tier => bpm >= tier.minBpm && bpm <= tier.maxBpm) ?? last;
}

/**
 * Nominal bar count per structureTemplate, derived from
 * lyricEngine.ts's own STRUCTURE_TEMPLATE_SECTION_NOTES section lists (read
 *-only reference — this file never imports/touches lyricEngine.ts's actual
 * generation logic, per this task's own "lyricEngine.ts의 문장 생성 로직을
 * 건드리지 말 것"). Standard 8-bar phrase per full section (verse/chorus/
 * bridge/breakdown/key-lift-final-chorus), 4-bar for a short intro/pre-chorus/
 * hook-only section — the same bar convention this task's own §2-4 worked
 * example uses (verified against real measurement below).
 */
const TEMPLATE_BARS: Record<StructureTemplateId, number> = {
  // intro4 + verse8 + pre-chorus4 + chorus8 + verse8 + chorus8 + bridge8 + final-chorus8
  T1: 56,
  // cold-hook-intro4 + verse8 + chorus8 + verse8 + chorus8 + breakdown8 + final-chorus8
  T2: 52,
  // intro4 + verse8 + pre-chorus4 + chorus8 + verse8 + chorus8 + key-lift-final-chorus8
  T3: 48,
  // instrumental-hook-intro4 + verse8 + chorus8 + verse8 + chorus8 + final-chorus8 (no bridge/pre-chorus)
  T4: 44,
  // a-cappella-hook-intro4 + verse8 + chorus8 + verse8 + bridge8 + chorus8 + final-chorus8
  T5: 52
};
const DEFAULT_TEMPLATE_BARS = TEMPLATE_BARS.T1;

/**
 * TASK B (2-4) — real measurement calibration: T7 (81 BPM, template-
 * equivalent 8 sections + 1 extra instrumental break = 64 bars) computed to
 * a 190s (3:10) nominal bar-time against an actual rendered 256s (4:16) —
 * a real 1.35x gap between "bars at tempo" and "what Suno actually renders"
 * (production pauses, breath room, count-in, mix tail). Applied uniformly
 * since this task's own three real data points (T1 1.27x, T4 1.44x, T7
 * 1.35x at the same 81 BPM/similar shape) cluster near 1.3-1.4x, matching
 * this task's own "아마 1.3배 전후" guess — T10's own real 108-BPM point
 * lands further off (≈2.0x), which is disclosed rather than chased into a
 * more complex multi-variable fit: this estimate's whole job is catching
 * EXTREME cases before generation (see LENGTH_ESTIMATE_BLOCKING_THRESHOLD_SEC
 * below), not predicting exact rendered length.
 */
export const LENGTH_ESTIMATE_COEFFICIENT = 1.35;

/** 3:45, this task's own explicit blocking bar (§2-4: "추정이 3:45를 넘으면 관문 1에서 blocking하십시오"). */
export const LENGTH_ESTIMATE_BLOCKING_THRESHOLD_SEC = 225;

/**
 * Pure — bars(structureTemplate) * 4 beats/bar * 60s/min / bpm * calibration
 * coefficient. Falls back to T1's own bar count for an unassigned/unknown
 * template (never throws — a slot without a structureTemplate yet still
 * needs an estimate at design time).
 */
export function estimateSongLengthSec(bpm: number, structureTemplate?: StructureTemplateId): number {
  const bars = structureTemplate ? (TEMPLATE_BARS[structureTemplate] ?? DEFAULT_TEMPLATE_BARS) : DEFAULT_TEMPLATE_BARS;
  const safeBpm = bpm > 0 ? bpm : 90;
  const nominalSec = (bars * 4 * 60) / safeBpm;
  return nominalSec * LENGTH_ESTIMATE_COEFFICIENT;
}

export function formatEstimatedLength(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const seconds = Math.round(sec % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
