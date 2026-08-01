import type { GenerationOptions, PreassignedSongSlot } from '../types';
import type { EraConstraint, ResolvedConstraints } from './constraints';
import { eraSharesOf } from './constraints';
import { ERA_LABEL } from '../data/eraExclusions';
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
  const base = opts.channel.archetype === 'kids' ? DEFAULT_KIDS_VOCAL_QUOTA : DEFAULT_ADULT_VOCAL_QUOTA;
  const scaledBase = scaleVocalQuota(base, opts.songCount);
  if (opts.channel.archetype === 'kids') return scaledBase;
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

const VOCAL_TYPE_MIN_RATIO = 3 / 18;
const KILLING_POINT_ASSIGNED_RATIO = 12 / 18;
const KILLING_POINT_VARIETY_RATIO = 6 / 18;

function issue(partial: DesignIssue): DesignIssue {
  return partial;
}

// ---------------------------------------------------------------------------
// 보컬 (vocal-type-variety / vocal-type-min / vocal-consecutive / vocal-segment-balance)
// ---------------------------------------------------------------------------
function vocalIssues(slots: PreassignedSongSlot[], opts: GenerationOptions): DesignIssue[] {
  const ordered = [...slots].sort((a, b) => a.trackNo - b.trackNo);
  const types = ordered.map(slot => slot.vocalType).filter((type): type is 'male' | 'female' | 'mixed' => Boolean(type));
  const issues: DesignIssue[] = [];
  if (!types.length) return issues; // no vocalType at all is a data-shape problem, not this gate's concern (usesVocalQuota is unconditionally true as of v3.77 — see vocalPlan.ts)

  const counts = countBy(types);
  const distinctTypes = Object.keys(counts).length;
  const minPerType = Math.max(1, Math.round(opts.songCount * VOCAL_TYPE_MIN_RATIO));
  const autoFix = () => withVocalTypeAllocation(opts, vocalQuotaForAutoFix(opts));

  if (distinctTypes < 3) {
    issues.push(issue({
      id: 'vocal-type-variety',
      labelKo: '보컬 타입 종류',
      expected: '3종 이상',
      actual: `${distinctTypes}종`,
      fixHintKo: `${Object.keys(counts).join(', ') || '한 성별'}만 배정됐습니다 — 여성·듀엣을 추가하세요.`,
      autoFix
    }));
  }
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

  const spread = stddevOf(bpms);
  if (spread < 8) {
    issues.push(issue({
      id: 'bpm-stddev',
      labelKo: 'BPM 표준편차',
      expected: '≥ 8',
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
  if (width < 25) {
    issues.push(issue({
      id: 'bpm-range',
      labelKo: 'BPM 범위 폭',
      expected: '≥ 25',
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
// 장르 (genre-variety / genre-max / genre-singleton / genre-consecutive)
// ---------------------------------------------------------------------------
function genreIssues(slots: PreassignedSongSlot[], opts: GenerationOptions): DesignIssue[] {
  const ordered = [...slots].sort((a, b) => a.trackNo - b.trackNo);
  const ids = ordered.map(slot => slot.genreId).filter((id): id is string => Boolean(id));
  const issues: DesignIssue[] = [];
  if (!ids.length) return issues;

  const counts = countBy(ids);
  const distinctCount = Object.keys(counts).length;
  // 3-E (스트레스 테스트) — a channel whose real candidate pool is smaller than
  // 4 genres can never satisfy a flat "4종 이상" floor no matter how the
  // slots are shuffled; the floor scales down to the real candidate count
  // instead of blocking every such channel forever. opts.genreIds is this
  // pack's own resolved candidate pool (not a literal senior/oldpop list —
  // 원칙 4), so this adapts per channel/workspace with no code change.
  const candidatePoolSize = new Set(opts.genreIds ?? []).size || distinctCount;
  const varietyFloor = Math.min(4, candidatePoolSize || 4);
  if (distinctCount < varietyFloor || distinctCount > 9) {
    issues.push(issue({
      id: 'genre-variety',
      labelKo: '장르 종류',
      expected: candidatePoolSize < 4 ? `${varietyFloor}~9종 (후보 ${candidatePoolSize}종뿐이라 하한 조정)` : '4~9종',
      actual: `${distinctCount}종`,
      fixHintKo: '장르 배분을 다시 확인하세요.'
    }));
  }
  const maxCount = Math.max(0, ...Object.values(counts));
  if (maxCount > 5) {
    issues.push(issue({
      id: 'genre-max',
      labelKo: '같은 장르 최대 곡수',
      expected: '≤ 5곡',
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
    ...vocalIssues(slots, opts),
    ...bpmIssues(slots, constraints),
    ...genreIssues(slots, opts),
    ...eraIssues(slots, constraints.era),
    ...killingPointAndArcIssues(slots, opts.songCount)
  ];
  const advisory: DesignIssue[] = [
    ...vocabularyForecastAdvisory(constraints)
  ];
  return { passed: blocking.length === 0, blocking, advisory };
}
