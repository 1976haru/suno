import type { ConceptBreadth, GenerationOptions, KidsAgeTierId, PreassignedSongSlot } from '../types';
import type { EraConstraint, ResolvedConstraints } from './constraints';
import { eraSharesOf } from './constraints';
import { ERA_LABEL } from '../data/eraExclusions';
import { ERA_POLICY } from '../data/eraPolicy';
import { estimateSongLengthSec, formatEstimatedLength, LENGTH_ESTIMATE_BLOCKING_THRESHOLD_SEC } from './bpmLengthControl';
import { channelSoundFloorForArchetype } from '../data/channelSoundFloor';
import { buildEraCanonPalettePlan, type PaletteAssignment } from './eraCanonPalettePlan';
import { hashSeed, seedForBlueprint } from './lyricEngine';
import { isKidsArchetype } from '../utils/channelArchetype';
import { expectedArcPhaseCount, kidsArcBundlePlanFor, KIDS_ARC_PHASE_VALUES } from './arcModels';
import { kidsKillingPointsForTier } from '../data/killingPointsKids';
import { REPRESENTATIVE_TRACK_COUNT, usesUserChosenProgressionPlan } from './moneyChordPlan';
import {
  DEFAULT_ADULT_VOCAL_QUOTA,
  DEFAULT_KIDS_VOCAL_QUOTA,
  leaningAdultVocalQuota,
  leaningGenderFor,
  scaleVocalQuota,
  type VocalQuota
} from './vocalPlan';

/**
 * v3.78 (TASK A) — "관문 1": everything a slot plan (PreassignedSongSlot[])
 * already determines before a single lyric/style-prompt is written. This is
 * deliberately NOT a re-implementation of compositionScorer.ts's post-
 * generation blocking checks — it operates on a different shape
 * (PreassignedSongSlot[], the pre-generation plan) and answers a different
 * question ("will this DESIGN produce a compliant pack if generation goes
 * exactly as planned?") than compositionScorer.ts's "did the ACTUAL songs
 * come out compliant?". Both must independently hold — see this task's own
 * §9 question 4: a design-gate pass followed by a mass generation-gate
 * failure means this file is missing a check, not that compositionScorer.ts
 * is redundant with it.
 *
 * Per this task's own 원칙 1 ("품질 기능은 조건부로 켜지지 않는다") every check
 * below always runs — there is no opt-out flag. Per 원칙 4 ("워크스페이스에
 * 독립적") every threshold that has a natural per-workspace source (BPM
 * range, song length, vocal-type identity) reads it from
 * ResolvedConstraints/GenerationOptions.audience, never a literal
 * 'senior'/'oldpop' string — see the vocal and bpm-within-profile checks below.
 */

export interface DesignIssue {
  id: string;
  labelKo: string;
  expected: string;
  actual: string;
  /** How the user can fix this by hand (shown even when autoFix is also offered). */
  fixHintKo: string;
  /** Present only for issues this function knows how to mechanically resolve by recomputing slots (원칙 2's counterpart: fixing the SETTING that produces the bad output, never patching the output itself). */
  autoFix?: () => Partial<GenerationOptions>;
}

export interface DesignGateResult {
  passed: boolean;
  blocking: DesignIssue[];
  advisory: DesignIssue[];
}

function stddevOf(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function longestRun<T>(items: readonly T[]): number {
  if (!items.length) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < items.length; i++) {
    current = items[i] === items[i - 1] ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

function countBy<T extends string>(items: readonly T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[item] = (counts[item] ?? 0) + 1;
  return counts;
}

/** "6곡 구간마다 같은 타입 ≤ 3" (§2-3) — fixed-size, non-overlapping windows of 6 tracks in trackNo order (not 3 equal-sized zones like compositionScorer.ts's advisory vocalZoneDistributionWarnings — a deliberately different, coarser design-time signal per this task's own "different shapes" allowance). Skipped entirely under 6 songs — there's no window to form. */
function segmentBalanceViolations(ordered: readonly string[], windowSize = 6, maxSameType = 3): { windowLabel: string; type: string; count: number }[] {
  if (ordered.length < windowSize) return [];
  const violations: { windowLabel: string; type: string; count: number }[] = [];
  for (let start = 0; start < ordered.length; start += windowSize) {
    const window = ordered.slice(start, start + windowSize);
    if (!window.length) continue;
    const counts = countBy(window);
    for (const [type, count] of Object.entries(counts)) {
      if (count > maxSameType) {
        violations.push({ windowLabel: `트랙 ${start + 1}~${start + window.length}`, type, count });
      }
    }
  }
  return violations;
}

/**
 * v5.9 (quota/tone separation) — mirrors batchPreallocation.ts's/
 * localGenerator.ts's own baseVocalQuota/vocalLeaning resolution exactly, so
 * this gate's autoFix suggestion reflects the SAME real resolved quota actual
 * generation would use, not a generic DEFAULT_ADULT_VOCAL_QUOTA that ignores
 * a channel's own fixed vocalQuotaOverride (e.g. a K-pop boy/girl-group
 * channel's real 15/0/3 split) and unconditionally disabled the lean for
 * kids. Before this fix: (1) a vocalQuotaOverride channel's autoFix silently
 * discarded the channel's own fixed quota in favor of the generic 6/6/6
 * default, which could suggest a "fix" that actually breaks the channel's
 * deliberate imbalance; (2) a kids channel could never lean toward a picked
 * gendered kids preset even when suggesting a fix.
 */
function vocalQuotaForAutoFix(opts: GenerationOptions): VocalQuota {
  const base = opts.vocalQuota ?? opts.channel.vocalQuotaOverride
    ?? (isKidsArchetype(opts.channel.archetype) ? DEFAULT_KIDS_VOCAL_QUOTA : DEFAULT_ADULT_VOCAL_QUOTA);
  const scaledBase = scaleVocalQuota(base, opts.songCount);
  if (opts.vocalQuota || opts.channel.vocalQuotaOverride) return scaledBase;
  const leaning = leaningGenderFor(opts);
  if (!leaning) return scaledBase;
  return leaningAdultVocalQuota(scaledBase, opts.songCount, leaning);
}

/** Merges a rebalanced vocalType axis into whatever diversityAllocations already exist, replacing only that one axis — every other axis (genre, introTexture, ...) is left untouched. */
function withVocalTypeAllocation(opts: GenerationOptions, quota: VocalQuota): Partial<GenerationOptions> {
  const others = (opts.diversityAllocations ?? []).filter(allocation => allocation.axis !== 'vocalType');
  const counts: Record<string, number> = { male: quota.male, female: quota.female, mixed: quota.mixed };
  return {
    diversityAllocations: [...others, { axis: 'vocalType' as const, mode: 'manual' as const, counts }]
  };
}

const KILLING_POINT_ASSIGNED_RATIO = 12 / 18;
const KILLING_POINT_VARIETY_RATIO = 6 / 18;

/**
 * v4.1 (TASK A) — per this task's own §1-3 table. `balanced` keeps every
 * number this file already enforced before this task (this is the "no
 * regression" anchor — see docs/v410-report.md's own diff check) — only
 * `focused`/`variety` are new. `genre.max` widened from `balanced`'s
 * original hardcoded 9 stays 9 for both balanced/variety (the spec's own
 * "6~9종" text for variety), never narrower than what already worked.
 * `vocal.minPerTypeRatio: null` means "제한 없음" (§1-3's own focused row) —
 * the per-type minimum check is skipped entirely, not set to 0 (0 would
 * still technically require "at least 0", same as skipping, but null makes
 * the "there is no floor here" intent explicit at the call site).
 */
export const BREADTH_THRESHOLDS: Record<ConceptBreadth, {
  genre: { min: number; max: number; maxPerGenre: number };
  bpm: { stddevFloor: number; rangeFloor: number };
  vocal: { minDistinctTypes: number; minPerTypeRatio: number | null };
}> = {
  focused: {
    genre: { min: 1, max: 3, maxPerGenre: 12 },
    bpm: { stddevFloor: 4, rangeFloor: 10 },
    vocal: { minDistinctTypes: 1, minPerTypeRatio: null }
  },
  balanced: {
    genre: { min: 4, max: 9, maxPerGenre: 5 },
    bpm: { stddevFloor: 8, rangeFloor: 25 },
    vocal: { minDistinctTypes: 3, minPerTypeRatio: 3 / 18 }
  },
  variety: {
    genre: { min: 6, max: 9, maxPerGenre: 4 },
    bpm: { stddevFloor: 10, rangeFloor: 30 },
    vocal: { minDistinctTypes: 3, minPerTypeRatio: 4 / 18 }
  }
};

function issue(partial: DesignIssue): DesignIssue {
  return partial;
}

// ---------------------------------------------------------------------------
// 보컬 (vocal-type-variety / vocal-type-min / vocal-consecutive / vocal-segment-balance)
// ---------------------------------------------------------------------------
function vocalIssues(slots: PreassignedSongSlot[], opts: GenerationOptions, constraints: ResolvedConstraints): DesignIssue[] {
  const ordered = [...slots].sort((a, b) => a.trackNo - b.trackNo);
  const types = ordered.map(slot => slot.vocalType).filter((type): type is 'male' | 'female' | 'mixed' => Boolean(type));
  const issues: DesignIssue[] = [];
  if (!types.length) return issues; // no vocalType at all is a data-shape problem, not this gate's concern (usesVocalQuota is unconditionally true as of v3.77 — see vocalPlan.ts)

  const counts = countBy(types);
  const autoFix = () => withVocalTypeAllocation(opts, vocalQuotaForAutoFix(opts));

  // v(design-gate audience decoupling) — a channel with a fixed
  // vocalQuotaOverride (e.g. a K-pop boy-group's real {male:15,female:0,
  // mixed:3}) is mathematically incompatible with the generic diversity
  // checks below: 15/18 male tracks guarantee long same-type runs no matter
  // how the remaining 3 are spread, and female:0 is the channel's own
  // deliberate choice, not a variety failure. Quota-fidelity replaces every
  // one of those checks (distinct-type count / per-type minimum / consecutive
  // run / segment balance) with "did the plan land within the override's own
  // (songCount-scaled) counts" instead. A channel with no override is
  // completely unaffected — falls through to the unchanged checks below.
  if (opts.channel.vocalQuotaOverride) {
    return quotaFidelityIssues(counts, opts.channel.vocalQuotaOverride, opts.songCount, autoFix);
  }

  const threshold = BREADTH_THRESHOLDS[constraints.breadth].vocal;
  const distinctTypes = Object.keys(counts).length;

  if (distinctTypes < threshold.minDistinctTypes) {
    issues.push(issue({
      id: 'vocal-type-variety',
      labelKo: '보컬 타입 종류',
      expected: `${threshold.minDistinctTypes}종 이상`,
      actual: `${distinctTypes}종`,
      fixHintKo: `${Object.keys(counts).join(', ') || '한 성별'}만 배정됐습니다 — 여성·듀엣을 추가하세요.`,
      autoFix
    }));
  }
  if (threshold.minPerTypeRatio !== null) {
    const minPerType = Math.max(1, Math.round(opts.songCount * threshold.minPerTypeRatio));
    const under = (['male', 'female', 'mixed'] as const).filter(type => (counts[type] ?? 0) < minPerType);
    if (under.length) {
      issues.push(issue({
        id: 'vocal-type-min',
        labelKo: '보컬 타입 최소 곡수',
        expected: `각 ${minPerType}곡 이상`,
        actual: (['male', 'female', 'mixed'] as const).map(type => `${type} ${counts[type] ?? 0}`).join(' / '),
        fixHintKo: `${under.join(', ')} 타입이 최소 기준에 미달합니다.`,
        autoFix
      }));
    }
  }
  const runLength = longestRun(types);
  if (runLength > 2) {
    issues.push(issue({
      id: 'vocal-consecutive',
      labelKo: '같은 보컬 타입 연속',
      expected: '≤ 2곡',
      actual: `${runLength}곡 연속`,
      fixHintKo: '같은 성별이 연속으로 몰려 있습니다 — 배분을 다시 섞으세요.',
      autoFix
    }));
  }
  const segmentViolations = segmentBalanceViolations(types);
  if (segmentViolations.length) {
    issues.push(issue({
      id: 'vocal-segment-balance',
      labelKo: '6곡 구간별 같은 보컬 타입',
      expected: '구간당 ≤ 3곡',
      actual: segmentViolations.map(v => `${v.windowLabel} ${v.type} ${v.count}곡`).join(', '),
      fixHintKo: '특정 구간(6곡 단위)에 한 성별이 몰려 있어 그 구간만 들으면 다양하지 않게 느껴질 수 있습니다.',
      autoFix
    }));
  }
  return issues;
}

/**
 * v(design-gate audience decoupling) — see vocalIssues' own doc comment for
 * why a vocalQuotaOverride channel needs a different check entirely rather
 * than a relaxed version of the same one. `scaleVocalQuota` is the exact
 * same function core/batchPreallocation.ts/localGenerator.ts use to turn the
 * channel's own raw override into this pack's real per-song target, so
 * "expected" here is always the actual songCount-scaled target real
 * generation aims for, not the raw override numbers verbatim. ±1 tolerance
 * absorbs ordinary largest-remainder rounding; a type whose scaled target is
 * exactly 0 must land at exactly 0 (no tolerance) since that's the channel's
 * own explicit "never this type" choice, not a number that rounding could
 * legitimately nudge.
 */
function quotaFidelityIssues(
  counts: Record<string, number>,
  override: VocalQuota,
  songCount: number,
  autoFix: () => Partial<GenerationOptions>
): DesignIssue[] {
  const scaled = scaleVocalQuota(override, songCount);
  const issues: DesignIssue[] = [];
  (['male', 'female', 'mixed'] as const).forEach(type => {
    const actual = counts[type] ?? 0;
    const expected = scaled[type];
    const withinTolerance = expected === 0 ? actual === 0 : Math.abs(actual - expected) <= 1;
    if (!withinTolerance) {
      issues.push(issue({
        id: 'vocal-quota-fidelity',
        labelKo: '고정 보컬 쿼터 준수',
        expected: expected === 0 ? `${type} 0곡 (고정)` : `${type} ${expected}곡 (±1)`,
        actual: `${type} ${actual}곡`,
        fixHintKo: `이 채널은 고정 보컬 비율(남 ${scaled.male}/여 ${scaled.female}/혼성 ${scaled.mixed})을 사용합니다 — 실제 배정이 벗어났습니다.`,
        autoFix
      }));
    }
  });
  return issues;
}

// ---------------------------------------------------------------------------
// BPM (bpm-stddev / bpm-range / bpm-within-profile)
// ---------------------------------------------------------------------------
/**
 * P1 fix (정합성 점검 §1) — kr-kids/jp-kids (ResolvedConstraints.genreBoundedTempo)
 * anchor each track's BPM to ITS OWN genre's real tempoRange instead of a
 * genre-blind workspace-wide draw (see tempoPlan.ts's resolveTempoWithBand
 * doc comment) — a calm genre (e.g. krkids-sleep-calm, 62-84) stays calm, an
 * energetic one (krkids-action, 112-128) stays energetic. All three checks
 * below were written before that change and assume one workspace has one
 * roughly-coherent tempo character: bpm-stddev/bpm-range measure pack-wide
 * VARIETY (now legitimately determined by which genres a channel selected,
 * not track-level jitter — real measurement found channels whose selected
 * genres cluster in one part of the workspace's range mathematically cannot
 * clear the >=8 stddev / >=25 width balanced-breadth floor even with a
 * perfectly even draw), and bpm-within-profile checks the audience-wide
 * floor/ceiling (a calm genre's own legitimately-low BPM then reads as "out
 * of range" against a ceiling meant for the whole workspace). Each track's
 * own genre fidelity is already guaranteed by construction
 * (resolveTempoWithBand clamps to [genreLow, genreHigh]) — this gate has
 * nothing left to re-verify for a genre-bounded audience. Every non-kids
 * audience profile is unaffected (genreBoundedTempo undefined there).
 */
function bpmIssues(slots: PreassignedSongSlot[], constraints: ResolvedConstraints): DesignIssue[] {
  if (constraints.genreBoundedTempo) return [];
  const bpms = slots.map(slot => slot.tempo).filter((bpm): bpm is number => typeof bpm === 'number');
  const issues: DesignIssue[] = [];
  if (bpms.length < 2) return issues;

  const threshold = BREADTH_THRESHOLDS[constraints.breadth].bpm;
  const spread = stddevOf(bpms);
  if (spread < threshold.stddevFloor) {
    issues.push(issue({
      id: 'bpm-stddev',
      labelKo: 'BPM 표준편차',
      expected: `≥ ${threshold.stddevFloor}`,
      actual: spread.toFixed(1),
      fixHintKo: `템포가 ${Math.min(...bpms)}~${Math.max(...bpms)}에 몰려 있습니다 — 다시 설계로 새 시드를 받으세요.`
      // No mechanical autoFix: tempo bands come from data/audienceProfiles.ts's
      // tempoBandsForProfile + core/tempoPlan.ts, driven by the resolved
      // audience profile — there is no GenerationOptions field that lets this
      // gate directly re-seed the tempo draw (see docs/v378-report.md §미구현
      // for the honest accounting of this gap).
    }));
  }
  const width = Math.max(...bpms) - Math.min(...bpms);
  if (width < threshold.rangeFloor) {
    issues.push(issue({
      id: 'bpm-range',
      labelKo: 'BPM 범위 폭',
      expected: `≥ ${threshold.rangeFloor}`,
      actual: `${Math.min(...bpms)}~${Math.max(...bpms)} (폭 ${width})`,
      fixHintKo: '템포 범위가 좁습니다 — 다시 설계로 새 시드를 받으세요.'
    }));
  }
  const [floor, ceiling] = constraints.tempoRange;
  const outOfRange = bpms.filter(bpm => bpm < floor || bpm > ceiling);
  if (outOfRange.length) {
    issues.push(issue({
      id: 'bpm-within-profile',
      labelKo: '오디언스 BPM 범위 준수',
      expected: `${floor}~${ceiling} (${constraints.audienceProfileId})`,
      actual: `범위 밖 ${outOfRange.length}곡 (${outOfRange.join(', ')})`,
      fixHintKo: '오디언스 프로파일의 템포 범위를 벗어난 곡이 있습니다.'
    }));
  }
  return issues;
}

// ---------------------------------------------------------------------------
// 예상 길이 (song-length-estimate) — v3.82 (TASK B)
// ---------------------------------------------------------------------------
/**
 * v3.82 (TASK B, 2-4) — "생성 전에 길이를 추정해 관문 1에서 잡으십시오." Real
 * cause: T7 (81 BPM) ran 4:16 against a 3:15-3:35 target even though its
 * word count matched T1/T4 almost exactly — the missing variable was BPM
 * itself (see core/bpmLengthControl.ts's own doc comment for the full
 * calibration). This estimates from slot.tempo + slot.structureTemplate
 * alone (both already decided at design time — no lyrics exist yet, per
 * this app's own 원칙 3), so a slow-BPM track assigned a long template gets
 * flagged before a single word is written, instead of only being
 * discoverable after Suno renders it.
 *
 * v4.6 (TASK C, §3-4) — downgraded from blocking to advisory. A real 36-song
 * measurement found this same nominal-bars estimate landing 154-479s
 * (2.6-8.0min) for songs sharing near-identical BPM/section/word inputs — a
 * ~3x spread this task's own doc comment calls out as "정확한 예측은
 * 불가능합니다." Blocking generation on an estimate with that much real-world
 * variance produces false positives (a genuinely fine song rejected) at
 * least as often as it catches a real problem, per this task's own explicit
 * "예상 3:45 초과 시 경고만 하십시오" — this now surfaces via evaluateDesignGate's
 * own advisory list instead of its blocking list.
 */
function songLengthIssues(slots: PreassignedSongSlot[]): DesignIssue[] {
  // Only slots that already have a structureTemplate assigned — real
  // production slots always do (buildStructureTemplatePlan runs
  // unconditionally in both batchPreallocation.ts and localGenerator.ts), so
  // this never skips a genuine case; it only avoids guessing a worst-case
  // template for a slot (e.g. a narrow synthetic test fixture) that simply
  // never set one.
  const overLength = slots
    .filter(slot => slot.structureTemplate)
    .map(slot => ({ slot, estimateSec: estimateSongLengthSec(slot.tempo, slot.structureTemplate) }))
    .filter(({ estimateSec }) => estimateSec > LENGTH_ESTIMATE_BLOCKING_THRESHOLD_SEC);
  if (!overLength.length) return [];
  return [issue({
    id: 'song-length-estimate',
    labelKo: '예상 길이',
    expected: `≤ ${formatEstimatedLength(LENGTH_ESTIMATE_BLOCKING_THRESHOLD_SEC)}`,
    actual: overLength.map(({ slot, estimateSec }) => `T${slot.trackNo} ${slot.tempo}BPM ${slot.structureTemplate ?? '?'} 약 ${formatEstimatedLength(estimateSec)}`).join(', '),
    fixHintKo: '느린 BPM에 섹션이 많은 템플릿이 배정되면 실제 길이가 목표를 넘기기 쉽습니다 — 해당 트랙에 더 짧은 구조 템플릿을 배정하거나 BPM을 높이세요.'
  })];
}

// ---------------------------------------------------------------------------
// 팔레트 커버리지 (channel sound floor) — v4.7 (TASK B)
// ---------------------------------------------------------------------------
/**
 * TASK v4.7 (TASK B) — "팔레트가 적용된 곡 >= 14곡, 팔레트 미적용 곡 <= 4곡,
 * 사용된 팔레트 종류 >= 3종... 4곡을 넘으면 관문 1에서 blocking." Only runs for
 * archetypes a ChannelSoundFloor actually covers (원칙 4 — data-driven via
 * channelSoundFloorForArchetype, never a literal workspace string); every
 * other archetype has no coverage requirement at all, matching v4.6's own
 * scoping of the palette family to oldpop genres. Uses the exact same seed
 * (hashSeed(seedForBlueprint(opts))) core/localGenerator.ts's real
 * generation will use, so this design-time preview and the actual output
 * agree on which songs land covered/uncovered — never a false pass/fail.
 */
function paletteCoverageIssues(slots: PreassignedSongSlot[], opts: GenerationOptions): DesignIssue[] {
  const soundFloor = channelSoundFloorForArchetype(opts.channel.archetype);
  // v5.7 (TASK C) — was `if (!soundFloor) return []`, i.e. any floor's mere
  // presence opted a workspace into this whole palette-coverage check. Now
  // gated on `usesPaletteFamily` (see channelSoundFloor.ts's own doc
  // comment): kr-2030/jp-2030/kr-idol-* now have real floors but zero
  // data/eraCanonPalettes.ts coverage for their genres, so every track would
  // always land "uncovered" and trip maxUncoveredGenreTracks — a real
  // design-gate false-positive block the old presence-only check would have
  // introduced for all 4 workspaces.
  if (!soundFloor?.usesPaletteFamily) return [];
  const ordered = [...slots].sort((a, b) => a.trackNo - b.trackNo);
  const genrePlan = ordered.map(slot => slot.genreId);
  if (!genrePlan.length) return [];
  const seed = hashSeed(seedForBlueprint(opts));
  // 정합성 점검 §1 결함1/palette-variety-max fix — this floor's own
  // minPaletteVariety (the real, current policy number) instead of
  // buildEraCanonPalettePlan's stale module-default.
  const assignments = buildEraCanonPalettePlan(genrePlan, seed, soundFloor.minPaletteVariety);
  const covered = assignments.filter((a): a is PaletteAssignment => !!a);
  const uncoveredCount = assignments.length - covered.length;
  // TASK v4.7 (팔레트 커버리지 확장) — partial assignments now count toward
  // variety too: they still inject a real, distinguishing productionTraits
  // atom (rotatingEraPaletteAtoms), not silence, so a set drawing from 3
  // different partial-covered genres genuinely sounds more varied than one
  // stuck on a single palette — the original "full only" rule under-counted
  // real coverage width, which is what made even reasonably diverse concepts
  // (S2-S5 in this task's own verification) fail the variety check despite
  // the underlying uncovered-track count already being fine.
  const distinctPaletteIds = new Set(covered.map(a => a.palette.id));

  const issues: DesignIssue[] = [];
  if (uncoveredCount > soundFloor.maxUncoveredGenreTracks) {
    issues.push(issue({
      id: 'palette-coverage',
      labelKo: '팔레트 미적용',
      expected: `≤ ${soundFloor.maxUncoveredGenreTracks}곡`,
      actual: `${uncoveredCount}곡`,
      fixHintKo: '이 컨셉은 채널 시대 사운드와 거리가 있습니다 — 팔레트가 있는 장르 비중을 늘리거나 컨셉을 조정하세요.'
    }));
  }
  // Variety only makes sense to demand once there's enough covered material
  // to spread across palettes at all — mirrors buildEraCanonPalettePlan's
  // own "only enforce the floor when reachable" reasoning.
  if (covered.length && distinctPaletteIds.size < soundFloor.minPaletteVariety) {
    issues.push(issue({
      id: 'palette-variety',
      labelKo: '사용 팔레트 종류',
      expected: `≥ ${soundFloor.minPaletteVariety}종`,
      actual: `${distinctPaletteIds.size}종`,
      fixHintKo: '팔레트 종류가 한쪽으로 몰려 있습니다 — 장르 배분을 다양하게 조정하세요.'
    }));
  }
  // TASK v4.9 (TASK A, §1-4) — the new ceiling half of minPaletteVariety's
  // redefinition: real listening feedback ("일식·중식·한식이 같이 나온 느낌")
  // traced to unlimited palette variety letting genres from unrelated
  // data/paletteFamilies.ts families pile into one set. core/setDirector.ts's
  // own family-constrained genre pool is the primary fix (this never fires
  // for a properly family-constrained pack); kept here as a design-time
  // backstop for any path that bypasses that pool (e.g. hand-built
  // diversityAllocations).
  if (distinctPaletteIds.size > soundFloor.maxPaletteVariety) {
    issues.push(issue({
      id: 'palette-variety-max',
      labelKo: '팔레트 종류 상한',
      expected: `≤ ${soundFloor.maxPaletteVariety}종`,
      actual: `${distinctPaletteIds.size}종`,
      fixHintKo: '팔레트 계열이 섞여 있습니다 — 세트를 한 계열(paletteFamilies.ts) 안에서만 구성하세요.'
    }));
  }
  return issues;
}

// ---------------------------------------------------------------------------
// 장르 (genre-variety / genre-max / genre-singleton / genre-consecutive)
// ---------------------------------------------------------------------------
function genreIssues(slots: PreassignedSongSlot[], opts: GenerationOptions, constraints: ResolvedConstraints): DesignIssue[] {
  const ordered = [...slots].sort((a, b) => a.trackNo - b.trackNo);
  const ids = ordered.map(slot => slot.genreId).filter((id): id is string => Boolean(id));
  const issues: DesignIssue[] = [];
  if (!ids.length) return issues;

  const threshold = BREADTH_THRESHOLDS[constraints.breadth].genre;
  const counts = countBy(ids);
  const distinctCount = Object.keys(counts).length;
  // 3-E (스트레스 테스트) — a channel whose real candidate pool is smaller than
  // this breadth's own floor can never satisfy it no matter how the slots
  // are shuffled; the floor scales down to the real candidate count instead
  // of blocking every such channel forever. opts.genreIds is this pack's
  // own resolved candidate pool (not a literal senior/oldpop list — 원칙
  // 4), so this adapts per channel/workspace with no code change.
  const candidatePoolSize = new Set(opts.genreIds ?? []).size || distinctCount;
  const varietyFloor = Math.min(threshold.min, candidatePoolSize || threshold.min);
  if (distinctCount < varietyFloor || distinctCount > threshold.max) {
    issues.push(issue({
      id: 'genre-variety',
      labelKo: '장르 종류',
      expected: candidatePoolSize < threshold.min
        ? `${varietyFloor}~${threshold.max}종 (후보 ${candidatePoolSize}종뿐이라 하한 조정)`
        : `${threshold.min}~${threshold.max}종`,
      actual: `${distinctCount}종`,
      fixHintKo: '장르 배분을 다시 확인하세요.'
    }));
  }
  const maxCount = Math.max(0, ...Object.values(counts));
  // v(design-gate audience decoupling) — `threshold.maxPerGenre` is a fixed
  // ceiling (5 for 'balanced') that's mathematically unreachable for the
  // common case of an 18-song pack spread over only 3-4 selected/candidate
  // genres (18÷3 = 6 > 5, 18÷4 = 4.5 -> 6 > 5 depending on rounding), which
  // blocked every such pack regardless of how evenly the songs were actually
  // spread — the real, verified trigger is most non-senior channel presets
  // (kr-idol-*/kr-kids/jp-kids/kr-2030/jp-2030, and every senior-oldpop
  // sub-archetype OTHER than senior-morning) declaring only 3
  // `preferredGenres` (see data/presets.ts). `effectiveMaxPerGenre` only
  // ever WIDENS the ceiling (never narrows it — `Math.max` with the
  // original threshold), so a pack that already satisfied the static
  // threshold keeps satisfying it identically; this only rescues packs
  // whose real candidate genre pool is too small to ever satisfy the static
  // number no matter how the songs are shuffled, same "adapt to the real
  // candidate pool" reasoning genre-variety's own `varietyFloor` just above
  // already uses (§3-E).
  //
  // TASK F (senior-oldpop workspace-wide exception is too broad) — this
  // used to be excluded for the entire `workspaceId === 'senior-oldpop'`
  // workspace, verified via a real, non-synthetic regression run
  // (scripts/v378-stress-test.ts, real 'good-morning-memory-radio' channel +
  // real free-text concepts like "6070년대 향수가 느껴지는 올드팝"):
  // core/setDirector.ts's own real directSetLocal genre-selection algorithm
  // ROUTINELY narrows opts.genreIds down to as few as 4 candidate genres for
  // ordinary senior concepts — but that is specifically 'senior-morning's
  // own pre-existing, already-tuned, already-accepted behavior (its channel
  // preset was deliberately expanded to a 15-genre catalog back in v3.61
  // specifically to avoid exactly this ceiling problem). The senior-oldpop
  // WORKSPACE also contains OTHER archetypes (showa-cafe/modern-chill/
  // city-night/oldpop-lounge) with far fewer candidate genres (as few as 3,
  // same data/presets.ts shape as every other non-senior channel preset) —
  // for those, the blanket workspace-wide exclusion made the same fixed cap
  // mathematically impossible to satisfy (e.g. 18 songs / 3 genres = 6 avg,
  // cap 5), exactly the problem this whole widening exists to rescue non-
  // senior channels from. Narrowed to `archetype === 'senior-morning'` (the
  // one archetype whose fixed cap is real, listening-validated, and
  // required to stay unchanged) so every other senior-oldpop sub-archetype
  // now gets the same auto-adjustment every other workspace already gets.
  // `opts.channel.archetype` (not a workspace-wide id) is the exact same
  // per-channel signal isKidsArchetype/vocalQuotaForAutoFix above already
  // read from this same `opts` object — never re-derived, never a new field.
  const effectiveMaxPerGenre = opts.channel.archetype === 'senior-morning'
    ? threshold.maxPerGenre
    : Math.max(threshold.maxPerGenre, Math.ceil(opts.songCount / (candidatePoolSize || 1)));
  if (maxCount > effectiveMaxPerGenre) {
    issues.push(issue({
      id: 'genre-max',
      labelKo: '같은 장르 최대 곡수',
      expected: effectiveMaxPerGenre > threshold.maxPerGenre
        ? `≤ ${effectiveMaxPerGenre}곡 (후보 ${candidatePoolSize}종 기준 자동 조정, 기본 ${threshold.maxPerGenre}곡)`
        : `≤ ${effectiveMaxPerGenre}곡`,
      actual: `${maxCount}곡`,
      fixHintKo: '한 장르에 곡이 몰려 있습니다 — 장르 배분을 조정하세요.'
    }));
  }
  const singletons = Object.entries(counts).filter(([, count]) => count === 1);
  if (singletons.length) {
    issues.push(issue({
      id: 'genre-singleton',
      labelKo: '1곡짜리 장르',
      expected: '0개',
      actual: `${singletons.length}개 (${singletons.map(([id]) => id).join(', ')})`,
      fixHintKo: '1곡뿐인 장르는 곡을 추가하거나 다른 장르로 합치세요.'
    }));
  }
  const run = longestRun(ids);
  if (run > 2) {
    issues.push(issue({
      id: 'genre-consecutive',
      labelKo: '같은 장르 연속',
      expected: '≤ 2곡',
      actual: `${run}곡 연속`,
      fixHintKo: '같은 장르가 연속으로 몰려 있습니다 — 장르 배분을 다시 섞으세요.'
    }));
  }
  return issues;
}

// ---------------------------------------------------------------------------
// 머니코드 (TASK v4.14 TASK B, §2-4) — same shape as genreIssues' own
// variety/max-count pair above, but for moneyChordId. Not every slot always
// carries one (e.g. a kids-archetype fallback or an explicit user-picked
// non-'default' moneyChordMode, where usesMoneyChordQuota is false and no
// per-track quota plan runs at all) — those packs correctly skip this check
// entirely rather than reporting a false "0종" issue.
//
// v(design-gate audience decoupling) — v5.7's usesUserChosenProgressionPlan
// (core/moneyChordPlan.ts) deliberately puts 50-65% of the pack on a user's
// EXPLICITLY chosen progression (buildUserChosenProgressionPlan) — the old
// flat "max 5 songs on any one progression" rule was written for the
// *default*/auto-rotation case and had no exemption for this real, intended
// concentration, so every explicit-choice pack (9-11/18 songs on the chosen
// id) failed this check by design. When `usesUserChosenProgressionPlan(opts)`
// is true, this swaps to explicit-choice-aware checks instead; the original
// max-5/4-6-species rules stay completely untouched (byte-identical) for
// every other pack — including every senior-workspace pack, which never sets
// moneyChordModeIsExplicitChoice.
// ---------------------------------------------------------------------------
function moneyChordBlockingIssues(slots: PreassignedSongSlot[], opts: GenerationOptions): DesignIssue[] {
  const ids = slots.map(slot => slot.moneyChordId).filter((id): id is string => Boolean(id));
  if (!ids.length) return [];
  const counts = countBy(ids);

  if (usesUserChosenProgressionPlan(opts)) {
    const chosenId = opts.moneyChordMode;
    const chosenCount = counts[chosenId] ?? 0;
    const issues: DesignIssue[] = [];
    if (chosenCount === 0) {
      issues.push(issue({
        id: 'moneychord-explicit-choice-zero',
        labelKo: '선택한 머니코드 사용',
        expected: '1곡 이상',
        actual: '0곡',
        fixHintKo: '사용자가 선택한 머니코드 진행이 한 곡에도 배정되지 않았습니다 — 다시 설계하세요.'
      }));
    }
    const ordered = [...slots].sort((a, b) => a.trackNo - b.trackNo);
    const representative = ordered.slice(0, Math.min(REPRESENTATIVE_TRACK_COUNT, ordered.length));
    const representativeHasChosen = representative.some(slot => slot.moneyChordId === chosenId);
    if (representative.length && !representativeHasChosen) {
      issues.push(issue({
        id: 'moneychord-explicit-choice-flagship',
        labelKo: `대표곡(1~${REPRESENTATIVE_TRACK_COUNT}번) 선택 진행 반영`,
        expected: '1곡 이상',
        actual: '0곡',
        fixHintKo: `대표곡(트랙 1~${REPRESENTATIVE_TRACK_COUNT}) 중 선택한 머니코드 진행을 쓰는 곡이 없습니다.`
      }));
    }
    return issues;
  }

  const maxCount = Math.max(0, ...Object.values(counts));
  if (maxCount <= 5) return [];
  return [issue({
    id: 'moneychord-max',
    labelKo: '같은 머니코드 최대 곡수',
    expected: '≤ 5곡',
    actual: `${maxCount}곡`,
    fixHintKo: '한 진행에 곡이 몰려 있습니다 — 머니코드 배분을 조정하세요.'
  })];
}

function moneyChordAdvisoryIssues(slots: PreassignedSongSlot[], opts: GenerationOptions): DesignIssue[] {
  const ids = slots.map(slot => slot.moneyChordId).filter((id): id is string => Boolean(id));
  if (!ids.length) return [];

  if (usesUserChosenProgressionPlan(opts)) {
    const counts = countBy(ids);
    const chosenId = opts.moneyChordMode;
    const chosenCount = counts[chosenId] ?? 0;
    const share = chosenCount / ids.length;
    if (share < 0.45 || share > 0.65) {
      return [issue({
        id: 'moneychord-explicit-choice-share',
        labelKo: '선택한 머니코드 비중',
        expected: '45~65%',
        actual: `${Math.round(share * 100)}% (${chosenCount}/${ids.length}곡)`,
        fixHintKo: '사용자가 선택한 머니코드 진행의 비중이 권장 범위(45~65%)를 벗어났습니다.'
      })];
    }
    return [];
  }
  const distinctCount = new Set(ids).size;
  if (distinctCount >= 4) return [];
  return [issue({
    id: 'moneychord-variety',
    labelKo: '머니코드 종류',
    expected: '4~6종',
    actual: `${distinctCount}종`,
    fixHintKo: '머니코드 진행이 몇 종류에만 몰려 있습니다 — 계열별 배분을 다시 확인하세요.'
  })];
}

// ---------------------------------------------------------------------------
// 편곡 밀도 (arrangementDensity) — v4.16 (TASK B)
// ---------------------------------------------------------------------------
/**
 * v4.16 (TASK B, §2-5) — real listening on a senior set found 12/18 tracks
 * reading as 'full' density (v4.9's own 6:6:6 split, as actually rendered
 * by Suno and heard by ear) — too dense to feel calm regardless of tempo/
 * percussion fixes. Blocking, not advisory — §2-3's own explicit "full 을
 * 4곡 이하로 제한하는 것이 핵심".
 *
 * v(design-gate audience decoupling) — that "4곡" ceiling was hard-coded
 * globally, with no basis at all for a K-pop performance-track workspace or
 * a kids action-song workspace, both of which legitimately WANT most tracks
 * at 'full' density. `fullMax` now comes from the resolved AudienceProfile
 * (see types.ts's AudienceProfile.arrangementDensityLimits doc comment) via
 * ResolvedConstraints.arrangementDensityLimits — senior's own resolved value
 * is still exactly 4 (unchanged), so this is byte-identical for senior/
 * general/generic-kids and only actually loosens the ceiling for the
 * workspaces whose profile now sets a wider one.
 */
function arrangementDensityBlockingIssues(slots: PreassignedSongSlot[], fullMax: number): DesignIssue[] {
  const densities = slots.map(slot => slot.arrangementDensity).filter((d): d is 'sparse' | 'medium' | 'full' => Boolean(d));
  if (!densities.length) return [];
  const fullCount = densities.filter(d => d === 'full').length;
  if (fullCount <= fullMax) return [];
  return [issue({
    id: 'arrangement-density-full-max',
    labelKo: '편곡 밀도 full 최대 곡수',
    expected: `≤ ${fullMax}곡`,
    actual: `${fullCount}곡`,
    fixHintKo: 'full 밀도가 너무 많습니다 — sparse/medium 비중을 늘리세요.'
  })];
}

/**
 * v4.16 (TASK B, §2-5) — advisory only (a short/small pack legitimately
 * can't hit 6 medium tracks): medium < 6곡, and 3곡 이상 같은 밀도 연속
 * (batchPreallocation.ts/localGenerator.ts already cap runs at 2 via
 * breakLongRuns, so this only ever fires for a manual allocation edge case
 * that bypasses that pass — see tests/v347step3.test.ts's own doc comment).
 */
function arrangementDensityAdvisoryIssues(slots: PreassignedSongSlot[]): DesignIssue[] {
  const densities = slots.map(slot => slot.arrangementDensity).filter((d): d is 'sparse' | 'medium' | 'full' => Boolean(d));
  if (!densities.length) return [];
  const issues: DesignIssue[] = [];
  const mediumCount = densities.filter(d => d === 'medium').length;
  if (mediumCount < 6) {
    issues.push(issue({
      id: 'arrangement-density-medium-min',
      labelKo: '편곡 밀도 medium 최소 곡수',
      expected: '≥ 6곡',
      actual: `${mediumCount}곡`,
      fixHintKo: 'medium 밀도가 적습니다 — 편곡 밀도 배분을 다시 확인하세요.'
    }));
  }
  const runLength = longestRun(densities);
  if (runLength >= 3) {
    issues.push(issue({
      id: 'arrangement-density-consecutive',
      labelKo: '같은 편곡 밀도 연속',
      expected: '≤ 2곡 연속',
      actual: `${runLength}곡 연속`,
      fixHintKo: '같은 밀도가 3곡 이상 연달아 배치됐습니다.'
    }));
  }
  return issues;
}

// ---------------------------------------------------------------------------
// 시대 (era-primary-share / era-forbidden / era-unspecified-share)
// ---------------------------------------------------------------------------
/**
 * TASK E (design-gate and post-generation era-share checks disagree) — the
 * single-primary/co-primary thresholds below now read from
 * data/eraPolicy.ts's shared ERA_POLICY instead of hardcoding their own
 * numbers (was 40%/30% here, disagreeing with compositionScorer.ts's own
 * post-generation 50%/no-co-primary-check-at-all) — see ERA_POLICY's own
 * doc comment for the real investigation (core/constraints.ts's
 * applyEraQuota, the function that actually shapes a real pack's genre
 * distribution at generation time) that picked 50%/40% as the correct,
 * validated numbers over this file's own previously-looser 40%/30%.
 */
function eraIssues(slots: PreassignedSongSlot[], era: EraConstraint): DesignIssue[] {
  // 컨셉에 시대 언급이 없으면 건너뜁니다 (원칙 3/§2-3의 명시적 지시 — 억지로 시대를 정하지 말 것).
  if (era.unspecified) return [];
  const genreCounts: Record<string, number> = {};
  for (const slot of slots) {
    if (slot.genreId) genreCounts[slot.genreId] = (genreCounts[slot.genreId] ?? 0) + 1;
  }
  const shares = eraSharesOf(genreCounts);
  const issues: DesignIssue[] = [];

  if (era.coPrimary) {
    const primaryShare = shares[era.primary] ?? 0;
    const coPrimaryShare = shares[era.coPrimary] ?? 0;
    const minEach = ERA_POLICY.coPrimaryMinEach;
    if (primaryShare < minEach || coPrimaryShare < minEach) {
      issues.push(issue({
        id: 'era-primary-share',
        labelKo: '복수 시대 비중',
        expected: `${ERA_LABEL[era.primary]}·${ERA_LABEL[era.coPrimary]} 각 ${Math.round(minEach * 100)}% 이상`,
        actual: `${ERA_LABEL[era.primary]} ${Math.round(primaryShare * 100)}% / ${ERA_LABEL[era.coPrimary]} ${Math.round(coPrimaryShare * 100)}%`,
        fixHintKo: `${ERA_LABEL[era.primary]} 또는 ${ERA_LABEL[era.coPrimary]} 계열 장르를 추가하세요.`
      }));
    }
  } else {
    const primaryShare = shares[era.primary] ?? 0;
    const min = ERA_POLICY.singlePrimaryMin;
    if (primaryShare < min) {
      issues.push(issue({
        id: 'era-primary-share',
        labelKo: `${ERA_LABEL[era.primary]} 장르 비중`,
        expected: `${Math.round(min * 100)}% 이상`,
        actual: `${Math.round(primaryShare * 100)}%`,
        fixHintKo: `${ERA_LABEL[era.primary]} 계열 장르를 추가하세요.`
      }));
    }
  }

  const forbiddenWithShare = era.forbidden.filter(bucket => (shares[bucket] ?? 0) > 0);
  if (forbiddenWithShare.length) {
    issues.push(issue({
      id: 'era-forbidden',
      labelKo: '금지 시대 장르',
      expected: '0곡',
      actual: forbiddenWithShare.map(bucket => `${ERA_LABEL[bucket]} ${Math.round((shares[bucket] ?? 0) * 100)}%`).join(', '),
      fixHintKo: '이 컨셉이 금지한 시대의 장르가 포함되어 있습니다 — 제외하세요.'
    }));
  }

  const genericShare = shares.generic ?? 0;
  if (ERA_POLICY.genericBlockingMax !== undefined && genericShare > ERA_POLICY.genericBlockingMax) {
    issues.push(issue({
      id: 'era-unspecified-share',
      labelKo: '시대 미지정 장르 비중',
      expected: `${Math.round(ERA_POLICY.genericBlockingMax * 100)}% 이하`,
      actual: `${Math.round(genericShare * 100)}%`,
      fixHintKo: '시대 표기가 없는 범용 장르가 너무 많습니다.'
    }));
  }
  return issues;
}

// ---------------------------------------------------------------------------
// 킬링포인트·아크 (killing-point-count / killing-point-variety / arc-phases)
// ---------------------------------------------------------------------------
function killingPointAndArcIssues(
  slots: PreassignedSongSlot[],
  songCount: number,
  arcModelId: 'five-phase' | 'repetition-cycle' = 'five-phase',
  // v5.13 (TASK: kidsAgeTierId wiring) — real gap this closes: expectedArcPhaseCount
  // used to always assume the ageTier-omitted default (4 bundles) even
  // though real generation now actually resolves and uses a specific tier
  // (kids-t1 -> 3 bundles, kids-t3 -> 5) — a real kr-kids/jp-kids pack
  // whose channel preset carries an explicit non-default tier would
  // otherwise fail this check for being "too correct" (more/fewer distinct
  // bundles than the wrong flat assumption). Optional/additive: omitting it
  // reproduces the exact prior (always-4) expectation.
  kidsAgeTierId?: KidsAgeTierId
): DesignIssue[] {
  const issues: DesignIssue[] = [];
  const withKillingPoint = slots.filter(slot => slot.killingPointId);
  const expectedAssigned = Math.round(songCount * KILLING_POINT_ASSIGNED_RATIO);
  if (withKillingPoint.length < expectedAssigned) {
    issues.push(issue({
      id: 'killing-point-count',
      labelKo: '킬링포인트 배정',
      expected: `≥ ${expectedAssigned}곡`,
      actual: `${withKillingPoint.length}곡`,
      fixHintKo: '킬링포인트가 배정된 곡이 부족합니다 — 다시 설계하세요.'
    }));
  }
  const distinctKillingPoints = new Set(withKillingPoint.map(slot => slot.killingPointId)).size;
  // P1 fix (정합성 점검 §1) — expectedArcPhaseCount just above already got
  // this exact tier-awareness fix once (v5.13); killing-point-variety was
  // missed. Real measurement: kids-t1 (data/killingPointsKids.ts's own
  // eligibleKidsTiers) only clears 4 of the 11 KIDS_KILLING_POINTS entries
  // (KKP-06/08/11/SOUND — every other entry requires kids-t2/t3), so a flat
  // 6-of-18 floor is mathematically unclearable for any kids-t1 channel
  // regardless of how the pack is designed. Capping expectedVariety at the
  // real eligible-pool size for the resolved tier fixes that without
  // loosening the bar for kids-t2/t3 (10-11 eligible, still >= 6) or any
  // non-kids workspace (kidsAgeTierId undefined there, same flat ratio as
  // before).
  const varietyCeiling = kidsAgeTierId ? kidsKillingPointsForTier(kidsAgeTierId).length : Infinity;
  const expectedVariety = Math.min(Math.max(1, Math.round(songCount * KILLING_POINT_VARIETY_RATIO)), varietyCeiling);
  if (distinctKillingPoints < expectedVariety) {
    issues.push(issue({
      id: 'killing-point-variety',
      labelKo: '킬링포인트 종류',
      expected: `≥ ${expectedVariety}`,
      actual: `${distinctKillingPoints}`,
      fixHintKo: '킬링포인트 종류가 부족합니다 — 다시 설계하세요.'
    }));
  }
  // v5.12 — arc-model-aware: 'five-phase' (every non-kids workspace) still
  // requires exactly 5 distinct values, byte-identical to the pre-v5.12
  // hard-coded check. 'repetition-cycle' (kids workspaces, see
  // arcModels.ts) is checked against its own real bundle count instead of
  // the wrong constant 5 — see arcModels.ts's expectedArcPhaseCount.
  const expectedPhaseCount = expectedArcPhaseCount(arcModelId, songCount, kidsAgeTierId);
  if (songCount >= expectedPhaseCount) {
    const arcPhases = new Set(slots.map(slot => slot.arcPhase).filter(Boolean));
    // For 'repetition-cycle', only count values that are actually real kids
    // bundle phases — catches a dispatch bug feeding adult five-phase (or
    // any other) strings into a kids pack, not just a raw count shortfall.
    // 'five-phase' keeps the original unfiltered Set (byte-identical).
    const countedArcPhases = arcModelId === 'repetition-cycle'
      ? new Set([...arcPhases].filter((phase): phase is string => typeof phase === 'string' && KIDS_ARC_PHASE_VALUES.has(phase)))
      : arcPhases;
    if (countedArcPhases.size < expectedPhaseCount) {
      issues.push(issue({
        id: 'arc-phases',
        labelKo: arcModelId === 'repetition-cycle' ? '아크 번들 전체 사용' : '아크 5구간 사용',
        expected: `${expectedPhaseCount}종 전부`,
        actual: `${countedArcPhases.size}종`,
        fixHintKo: arcModelId === 'repetition-cycle'
          ? '아크 번들(반복 주기)이 전부 쓰이지 않았습니다.'
          : '아크 5구간(오프닝~클로징)이 전부 쓰이지 않았습니다.'
      }));
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// 아크 번들 구조 (kids repetition-cycle) — design-gate audience decoupling
// follow-up to v5.11/v5.12's arc-model-aware COUNT check above.
// ---------------------------------------------------------------------------
/** Longest run of consecutive items equal to `value` (unlike `longestRun`, which tracks the longest run of ANY repeated value). */
function longestRunOf<T>(items: readonly T[], value: T): number {
  let longest = 0;
  let current = 0;
  for (const item of items) {
    current = item === value ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

/**
 * TASK D (kids arc bundle check ignores the user's actual selected age
 * tier) — real bug this closes: the prior version received no age-tier
 * signal at all and REVERSE-INFERRED which tier the observed phases best
 * matched (tried kids-t1/default/kids-t3 candidates in turn, took whichever
 * one's expected SET happened to equal the observed set). That means a user
 * who explicitly selected 'kids-t1' (0-2세, 3-bundle structure) but whose
 * real generated slots ended up showing 'kids-t2'/default's 4-bundle
 * structure (a real dispatch bug elsewhere, or a stale cached value) would
 * have this check see "4 phases present, matches kids-t2" and WRONGLY PASS
 * — instead of catching that the actual selection wasn't honored.
 *
 * Fixed by taking the real SELECTED tier (`kidsAgeTierId`, threaded from
 * ResolvedConstraints.kidsAgeTierId at the real call site — see that
 * field's own v5.13 doc comment) and checking the observed plan against
 * ONLY that tier's own real definition (arcModels.ts's kidsArcBundlePlanFor,
 * same function buildRepetitionCyclePlan itself is built from) — never
 * accepting whichever tier happens to fit. `kidsAgeTierId` omitted (every
 * real call site with no per-generation tier signal) defaults the same way
 * every other real consumer does — to KIDS_BUNDLES_DEFAULT ('kids-t2') —
 * so this stays byte-identical for a pack that never set one.
 *
 * Only ever runs for arcModelId === 'repetition-cycle' (kids workspaces) —
 * a no-op for every 'five-phase' (adult/senior) pack, so senior-workspace
 * gate output is completely unaffected.
 */
function kidsArcBundleStructureIssues(
  slots: PreassignedSongSlot[],
  arcModelId: 'five-phase' | 'repetition-cycle',
  songCount: number,
  kidsAgeTierId?: KidsAgeTierId
): { blocking: DesignIssue[]; advisory: DesignIssue[] } {
  const blocking: DesignIssue[] = [];
  const advisory: DesignIssue[] = [];
  if (arcModelId !== 'repetition-cycle') return { blocking, advisory };

  const ordered = [...slots].sort((a, b) => a.trackNo - b.trackNo);
  const rawPhases = ordered.map(slot => slot.arcPhase).filter((p): p is string => typeof p === 'string' && p.length > 0);
  if (!rawPhases.length) return { blocking, advisory };

  // (i) block if ANY adult (non-kids-*) phase appears at all — a real
  // dispatch bug feeding adult five-phase strings (or any other stray
  // value) into a kids pack. Checked up front, independent of whether the
  // tier-match below also fails, so this always surfaces on its own.
  const nonKidsPhases = rawPhases.filter(p => !KIDS_ARC_PHASE_VALUES.has(p));
  if (nonKidsPhases.length) {
    blocking.push(issue({
      id: 'kids-arc-adult-phase-leak',
      labelKo: '아크 번들에 비-kids 구간 값 혼입',
      expected: '전부 kids-* 번들 값',
      actual: `${nonKidsPhases.length}곡에 kids-* 아닌 값 (${[...new Set(nonKidsPhases)].join(', ')})`,
      fixHintKo: '아크 배분 로직이 성인용(five-phase) 값이나 정의되지 않은 값을 kids 패키지에 잘못 흘려보냈을 가능성이 큽니다.'
    }));
  }

  const phases = rawPhases.filter(p => KIDS_ARC_PHASE_VALUES.has(p));
  if (!phases.length) return { blocking, advisory };

  // (ii) observed phases must exactly match the SELECTED tier's real
  // expected phase set — no reverse inference (see this function's own top
  // doc comment for the real bug this closes).
  const selectedPlan = kidsArcBundlePlanFor(songCount, kidsAgeTierId).filter(entry => entry.count > 0);
  const expectedSet = new Set(selectedPlan.map(entry => entry.phase));
  const observedSet = new Set(phases);
  const tierLabel = kidsAgeTierId ?? 'kids-t2(기본)';

  const setMatches = expectedSet.size === observedSet.size && [...expectedSet].every(phase => observedSet.has(phase));
  if (!setMatches) {
    blocking.push(issue({
      id: 'kids-arc-bundle-set-mismatch',
      labelKo: '선택한 연령대의 아크 번들 구성',
      expected: `${tierLabel} 번들 세트 (${[...expectedSet].join(', ')})`,
      actual: `${[...observedSet].join(', ')}`,
      fixHintKo: `실제 사용된 아크 번들이 선택한 연령대(${tierLabel})의 정의(arcModels.ts)와 일치하지 않습니다 — 다른 연령대 구조가 잘못 배정됐거나 선택이 반영되지 않았을 수 있습니다.`
    }));
    // The set itself doesn't correspond to the selected tier at all — the
    // per-phase-count/last-phase checks below assume a matched tier to
    // compare against, so there's nothing more to meaningfully check here.
    return { blocking, advisory: [...advisory, ...movingRunAdvisory(phases)] };
  }

  // (iii) each phase's real expected song-count share for the selected tier
  // — ±1 tolerance absorbs ordinary largest-remainder rounding (same
  // convention as quotaFidelityIssues' own ±1 elsewhere in this file).
  const observedCountByPhase = countBy(phases);
  const countMismatches = selectedPlan.filter(entry => Math.abs((observedCountByPhase[entry.phase] ?? 0) - entry.count) > 1);
  if (countMismatches.length) {
    blocking.push(issue({
      id: 'kids-arc-bundle-count-mismatch',
      labelKo: '번들별 곡수 배분',
      expected: selectedPlan.map(entry => `${entry.phase} ${entry.count}곡`).join(', '),
      actual: selectedPlan.map(entry => `${entry.phase} ${observedCountByPhase[entry.phase] ?? 0}곡`).join(', '),
      fixHintKo: `선택한 연령대(${tierLabel})의 번들별 곡수 배분과 실제 배정이 ±1곡을 넘게 어긋납니다.`
    }));
  }

  // (iv) the LAST track (by trackNo) must be the tier's own real defined
  // closing/calm bundle — bundlesForAgeTier's declaration order always
  // places its calmest bundle last (arcModels.ts's own doc comment), so
  // selectedPlan's own last surviving (count > 0) entry IS that bundle.
  const lastPhase = phases[phases.length - 1];
  const definedClosingPhase = selectedPlan[selectedPlan.length - 1].phase;
  if (lastPhase !== definedClosingPhase) {
    blocking.push(issue({
      id: 'kids-arc-last-phase-identity',
      labelKo: '마지막 트랙의 아크 번들',
      expected: `${definedClosingPhase} (${tierLabel}의 마무리 번들)`,
      actual: lastPhase,
      fixHintKo: `마지막 트랙은 선택한 연령대(${tierLabel})가 정의한 마무리 번들(${definedClosingPhase})이어야 합니다.`
    }));
  }

  // Separately-found arithmetic bug in the last-bundle INTENSITY comparison
  // (distinct from (iv)'s phase-identity check just above — a real plan
  // could theoretically end on the "right" phase id while still measuring
  // as not-quietest, or vice versa on a hand-edited plan): the OLD
  // comparison only required the last bundle to be quieter than the
  // LOUDEST other bundle used (lastIntensity < max(others)) — see
  // lastBundleIntensityViolation's own doc comment for the real example
  // (familiar:2/learning:3/moving:5/calm:1, last=learning) this wrongly
  // passed. Fixed to require the last bundle to be quieter than the MINIMUM
  // intensity among every other bundle actually used.
  const intensityByPhase = new Map(selectedPlan.map(entry => [entry.phase, entry.intensity]));
  const violation = lastBundleIntensityViolation(lastPhase, intensityByPhase);
  if (violation) {
    blocking.push(issue({
      id: 'kids-arc-last-bundle-intensity',
      labelKo: '마지막 아크 번들 강도',
      expected: `마지막 번들(${lastPhase}) 강도 < 다른 번들 전체의 최소 강도(${violation.minOtherIntensity})`,
      actual: `${lastPhase} 강도 ${violation.lastIntensity}`,
      fixHintKo: '마지막 번들은 이 세트에서 실제로 쓰인 다른 모든 번들보다 확실히 낮은 강도(차분한 마무리)여야 합니다.'
    }));
  }

  // (v) arrangement/energy-pacing concern, not structural — advisory only.
  advisory.push(...movingRunAdvisory(phases));

  return { blocking, advisory };
}

/** (v) no 3+ consecutive 'kids-moving' (high-intensity/movement) bundle-tagged songs in a row — extracted so the early set-mismatch return above can still surface it. */
function movingRunAdvisory(phases: readonly string[]): DesignIssue[] {
  const movingRun = longestRunOf(phases, 'kids-moving');
  if (movingRun < 3) return [];
  return [issue({
    id: 'kids-arc-moving-consecutive',
    labelKo: '연속된 활동적(moving) 번들',
    expected: '연속 ≤ 2곡',
    actual: `${movingRun}곡 연속`,
    fixHintKo: '활동적인(moving) 번들 곡이 3곡 이상 연달아 배치됐습니다 — 다른 번들과 섞으세요.'
  })];
}

/**
 * TASK D — isolated, directly-testable version of the last-bundle-intensity
 * check's real comparison, extracted so a unit test can exercise the exact
 * fixed example from this task's own doc (familiar:2/learning:3/moving:5/
 * calm:1, real last bundle = learning) without needing a real arcModels.ts
 * tier whose own intensities happen to match those illustrative numbers.
 * Returns undefined when the last bundle IS strictly quieter than every
 * other used bundle (no violation); otherwise the failing intensities for
 * the caller's own message.
 */
export function lastBundleIntensityViolation(
  lastPhase: string,
  intensityByPhase: ReadonlyMap<string, number>
): { lastIntensity: number; minOtherIntensity: number } | undefined {
  const lastIntensity = intensityByPhase.get(lastPhase);
  const otherIntensities = [...intensityByPhase.entries()].filter(([phase]) => phase !== lastPhase).map(([, intensity]) => intensity);
  if (lastIntensity === undefined || !otherIntensities.length) return undefined;
  const minOtherIntensity = Math.min(...otherIntensities);
  if (lastIntensity >= minOtherIntensity) return { lastIntensity, minOtherIntensity };
  return undefined;
}

/**
 * 어휘 다양성 예측 (advisory only, UI 미리보기용) — this is a rough forecast,
 * not a measurement: the actual lyric text doesn't exist yet at design time
 * (원칙 3 — "생성 후에만 알 수 있는 것은 생성 후에 검사"). Based only on how many
 * distinct vocabulary banks this concept's era/workspace resolved
 * (data/vocabularyBanks.ts via ResolvedConstraints.vocabulary), never on
 * generated lyrics. compositionScorer.ts's post-generation vocab-repeat
 * checks (관문 2) are the actual measurement.
 */
function vocabularyForecastAdvisory(constraints: ResolvedConstraints): DesignIssue[] {
  const bankCount = constraints.vocabulary.preferredBanks.length;
  const label = bankCount >= 3 ? '좋음' : bankCount === 2 ? '보통' : '부족';
  if (bankCount >= 3) return [];
  return [issue({
    id: 'vocab-diversity-forecast',
    labelKo: '어휘 다양성 예측',
    expected: '어휘 뱅크 3개 이상',
    actual: `${label} (뱅크 ${bankCount}개)`,
    fixHintKo: '실제 어휘 반복 여부는 생성 후 관문 2가 측정합니다 — 이 항목은 사전 추정치일 뿐입니다.'
  })];
}

export function evaluateDesignGate(
  slots: PreassignedSongSlot[],
  constraints: ResolvedConstraints,
  opts: GenerationOptions
): DesignGateResult {
  // TASK D — threads the SELECTED tier (constraints.kidsAgeTierId, the real
  // resolved value — see ResolvedConstraints.kidsAgeTierId's own v5.13 doc
  // comment) in, so this check compares the observed plan against what the
  // user actually chose instead of reverse-inferring a tier from whatever
  // the slots happen to show.
  const kidsArcStructure = kidsArcBundleStructureIssues(slots, constraints.arcModelId, opts.songCount, constraints.kidsAgeTierId);
  const blocking: DesignIssue[] = [
    ...vocalIssues(slots, opts, constraints),
    ...bpmIssues(slots, constraints),
    ...genreIssues(slots, opts, constraints),
    ...eraIssues(slots, constraints.era),
    // v5.13 (TASK: kidsAgeTierId wiring) — constraints.kidsAgeTierId is the
    // real resolved tier (see ResolvedConstraints.kidsAgeTierId's own doc
    // comment); passing it keeps this check's own "expected" bundle count in
    // sync with what real generation actually produced for this pack.
    ...killingPointAndArcIssues(slots, opts.songCount, constraints.arcModelId, constraints.kidsAgeTierId),
    ...paletteCoverageIssues(slots, opts),
    ...moneyChordBlockingIssues(slots, opts),
    ...arrangementDensityBlockingIssues(slots, constraints.arrangementDensityLimits.fullMax),
    ...kidsArcStructure.blocking
  ];
  const advisory: DesignIssue[] = [
    ...vocabularyForecastAdvisory(constraints),
    // v4.6 (TASK C, §3-4) — moved from blocking (see songLengthIssues's own
    // updated doc comment for why).
    ...songLengthIssues(slots),
    ...moneyChordAdvisoryIssues(slots, opts),
    ...arrangementDensityAdvisoryIssues(slots),
    ...kidsArcStructure.advisory
  ];
  return { passed: blocking.length === 0, blocking, advisory };
}
