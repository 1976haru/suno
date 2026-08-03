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

/**
 * v4.6 (TASK C, §3-3) — real 36-song measurement: slow tracks (<=86 BPM)
 * averaged 4:42 against an 8-92 BPM-band target of 3:15-3:35, and v4.4's own
 * table (below, in git history) put the slow tier's word floor at 215 —
 * ABOVE where v4.1 originally had it (175-205) — specifically to match
 * resolveLyricRange's pack-level 215-230 target and avoid a per-track
 * instruction reading below the pack's own floor. That fix traded a
 * (smaller, textual) contradiction problem for a (larger, real-audio)
 * length problem: the raised floor is exactly why slow tracks kept running
 * long. This table now prioritizes the real symptom the user is actually
 * judging (audible length) over bridge-instruction-text self-consistency —
 * see this task's own explicit "가사 단어수를 175 미만으로 줄이지 말 것. 느린
 * 곡도 하한이 있습니다" floor. The pack-level 215-230 CRITICAL line
 * (data/audienceProfiles.ts's lyricMetricsByLanguage) is intentionally left
 * unchanged — out of this task's own scope — so a real contradiction with
 * the slowest tier's new 175-195 floor can recur in the bridge instruction
 * text; flagged as a known follow-up rather than silently expanded scope.
 * Faster tiers widen upward from the old table (Local generation's real
 * demonstrated bug was slow-track length, not fast-track shortness, so the
 * faster tiers move opposite the slow ones per the user's own worked table).
 */
/**
 * TASK v4.9 (TASK E) — real listening judgment reversed from v4.6's own:
 * "대부분 3:30 이상이라 길다. 짧으면 더 좋을 것 같다" (was previously "2:34 짧다 ·
 * 3:39 좋다 · 4:09 길다"). Real measurement backed it up — average 3:47,
 * 10/18 songs over 3:30, only 5/18 inside the (now former) 3:05-3:25 target.
 * Every tier's own wordRange dropped one notch (this task's own worked
 * table); sectionRange for the 93-104 tier also dropped 7-8 -> 6-7 to match
 * (a 6-7 section song at that tempo lands inside the new target without an
 * 8th section pushing it long). The 165-word floor (this task's own
 * explicit "하한 165 를 지키십시오") is still comfortably above local
 * generation's own real per-tier measurements (v4.8's own 196-220 span),
 * so this is a pure target-lowering, not a change requiring
 * lyricEngine.ts's own composeLyrics section-doubling logic to move at all.
 */
export const BPM_LENGTH_TIERS: readonly BpmLengthTier[] = [
  { minBpm: 62, maxBpm: 78, sectionRange: [5, 6], wordRange: [165, 185], maxInstrumentalSections: 1 },
  { minBpm: 79, maxBpm: 92, sectionRange: [6, 7], wordRange: [185, 205], maxInstrumentalSections: 1 },
  { minBpm: 93, maxBpm: 104, sectionRange: [6, 7], wordRange: [200, 220], maxInstrumentalSections: 2 },
  { minBpm: 105, maxBpm: 112, sectionRange: [7, 8], wordRange: [210, 230], maxInstrumentalSections: 2 }
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
 * v4.6 (TASK C) — section count per structureTemplate, read from the same
 * STRUCTURE_TEMPLATE_SECTION_NOTES lists TEMPLATE_BARS above already
 * documents (T1=8, T2=7, T3=7, T4=6, T5=7) — used by
 * core/structureTemplatePlan.ts to pick a template whose section count
 * actually falls inside a song's own BPM tier's sectionRange, instead of
 * the old BPM-independent rotation (core/lyricEngine.ts's
 * buildStructureTemplatePlan) that let a slow track land on an 8-section
 * template and a fast track on a 6-section one — see this task's own §0-3/
 * §3-2 real measurement of exactly that inversion.
 */
export const TEMPLATE_SECTION_COUNT: Record<StructureTemplateId, number> = {
  T1: 8,
  T2: 7,
  T3: 7,
  T4: 6,
  T5: 7
};

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
