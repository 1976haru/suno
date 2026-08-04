import type { ConceptBreadth, GenerationOptions, PreassignedSongSlot } from '../types';
import type { EraConstraint, ResolvedConstraints } from './constraints';
import { eraSharesOf } from './constraints';
import { ERA_LABEL } from '../data/eraExclusions';
import { estimateSongLengthSec, formatEstimatedLength, LENGTH_ESTIMATE_BLOCKING_THRESHOLD_SEC } from './bpmLengthControl';
import { channelSoundFloorForArchetype } from '../data/channelSoundFloor';
import { buildEraCanonPalettePlan, type PaletteAssignment } from './eraCanonPalettePlan';
import { hashSeed, seedForBlueprint } from './lyricEngine';
import { isKidsArchetype } from '../utils/channelArchetype';
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

function vocalQuotaForAutoFix(opts: GenerationOptions): VocalQuota {
  const base = isKidsArchetype(opts.channel.archetype) ? DEFAULT_KIDS_VOCAL_QUOTA : DEFAULT_ADULT_VOCAL_QUOTA;
  const scaledBase = scaleVocalQuota(base, opts.songCount);
  if (isKidsArchetype(opts.channel.archetype)) return scaledBase;
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

  const threshold = BREADTH_THRESHOLDS[constraints.breadth].vocal;
  const counts = countBy(types);
  const distinctTypes = Object.keys(counts).length;
  const autoFix = () => withVocalTypeAllocation(opts, vocalQuotaForAutoFix(opts));

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

// ---------------------------------------------------------------------------
// BPM (bpm-stddev / bpm-range / bpm-within-profile)
// ---------------------------------------------------------------------------
function bpmIssues(slots: PreassignedSongSlot[], constraints: ResolvedConstraints): DesignIssue[] {
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
  if (!soundFloor) return [];
  const ordered = [...slots].sort((a, b) => a.trackNo - b.trackNo);
  const genrePlan = ordered.map(slot => slot.genreId);
  if (!genrePlan.length) return [];
  const seed = hashSeed(seedForBlueprint(opts));
  const assignments = buildEraCanonPalettePlan(genrePlan, seed);
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
  if (maxCount > threshold.maxPerGenre) {
    issues.push(issue({
      id: 'genre-max',
      labelKo: '같은 장르 최대 곡수',
      expected: `≤ ${threshold.maxPerGenre}곡`,
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
// ---------------------------------------------------------------------------
function moneyChordBlockingIssues(slots: PreassignedSongSlot[]): DesignIssue[] {
  const ids = slots.map(slot => slot.moneyChordId).filter((id): id is string => Boolean(id));
  if (!ids.length) return [];
  const counts = countBy(ids);
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

function moneyChordAdvisoryIssues(slots: PreassignedSongSlot[]): DesignIssue[] {
  const ids = slots.map(slot => slot.moneyChordId).filter((id): id is string => Boolean(id));
  if (!ids.length) return [];
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
// 시대 (era-primary-share / era-forbidden / era-unspecified-share)
// ---------------------------------------------------------------------------
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
    if (primaryShare < 0.3 || coPrimaryShare < 0.3) {
      issues.push(issue({
        id: 'era-primary-share',
        labelKo: '복수 시대 비중',
        expected: `${ERA_LABEL[era.primary]}·${ERA_LABEL[era.coPrimary]} 각 30% 이상`,
        actual: `${ERA_LABEL[era.primary]} ${Math.round(primaryShare * 100)}% / ${ERA_LABEL[era.coPrimary]} ${Math.round(coPrimaryShare * 100)}%`,
        fixHintKo: `${ERA_LABEL[era.primary]} 또는 ${ERA_LABEL[era.coPrimary]} 계열 장르를 추가하세요.`
      }));
    }
  } else {
    const primaryShare = shares[era.primary] ?? 0;
    if (primaryShare < 0.4) {
      issues.push(issue({
        id: 'era-primary-share',
        labelKo: `${ERA_LABEL[era.primary]} 장르 비중`,
        expected: '40% 이상',
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
  if (genericShare > 0.25) {
    issues.push(issue({
      id: 'era-unspecified-share',
      labelKo: '시대 미지정 장르 비중',
      expected: '25% 이하',
      actual: `${Math.round(genericShare * 100)}%`,
      fixHintKo: '시대 표기가 없는 범용 장르가 너무 많습니다.'
    }));
  }
  return issues;
}

// ---------------------------------------------------------------------------
// 킬링포인트·아크 (killing-point-count / killing-point-variety / arc-phases)
// ---------------------------------------------------------------------------
function killingPointAndArcIssues(slots: PreassignedSongSlot[], songCount: number): DesignIssue[] {
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
  const expectedVariety = Math.max(1, Math.round(songCount * KILLING_POINT_VARIETY_RATIO));
  if (distinctKillingPoints < expectedVariety) {
    issues.push(issue({
      id: 'killing-point-variety',
      labelKo: '킬링포인트 종류',
      expected: `≥ ${expectedVariety}`,
      actual: `${distinctKillingPoints}`,
      fixHintKo: '킬링포인트 종류가 부족합니다 — 다시 설계하세요.'
    }));
  }
  if (songCount >= 5) {
    const arcPhases = new Set(slots.map(slot => slot.arcPhase).filter(Boolean));
    if (arcPhases.size < 5) {
      issues.push(issue({
        id: 'arc-phases',
        labelKo: '아크 5구간 사용',
        expected: '5종 전부',
        actual: `${arcPhases.size}종`,
        fixHintKo: '아크 5구간(오프닝~클로징)이 전부 쓰이지 않았습니다.'
      }));
    }
  }
  return issues;
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
  const blocking: DesignIssue[] = [
    ...vocalIssues(slots, opts, constraints),
    ...bpmIssues(slots, constraints),
    ...genreIssues(slots, opts, constraints),
    ...eraIssues(slots, constraints.era),
    ...killingPointAndArcIssues(slots, opts.songCount),
    ...paletteCoverageIssues(slots, opts),
    ...moneyChordBlockingIssues(slots)
  ];
  const advisory: DesignIssue[] = [
    ...vocabularyForecastAdvisory(constraints),
    // v4.6 (TASK C, §3-4) — moved from blocking (see songLengthIssues's own
    // updated doc comment for why).
    ...songLengthIssues(slots),
    ...moneyChordAdvisoryIssues(slots)
  ];
  return { passed: blocking.length === 0, blocking, advisory };
}
