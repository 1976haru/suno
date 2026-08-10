import type { ChannelProfile, GenerationOptions } from '../types';
import { DESIGN_GATE_ITEM_IDS } from './auditItemIds';
import { BREADTH_THRESHOLDS } from './designGate';
import { getGenreById, type EraTaggedGenrePack } from '../data/genreLibrary';
import { eraBucketForGenreId, type EraBucket } from '../data/eraExclusions';
import { ERA_BUCKETS_BY_GENRE_ID } from '../data/eraBuckets';
import { eraIntentForWorkspace } from '../data/workspaceEraIntent';
import { ERA_POLICY } from '../data/eraPolicy';
import { resolveConstraintsFromOptions, GENRE_ERA_QUOTA_PER_GENRE_CAP, type ResolvedConstraints } from './constraints';
import { audienceProfileForChannelArchetype } from '../data/audienceProfiles';
import { channelSoundFloorForArchetype } from '../data/channelSoundFloor';
import { buildEraCanonPalettePlan, type PaletteAssignment } from './eraCanonPalettePlan';
import { KILLING_POINTS } from '../data/killingPoints';
import { kidsKillingPointsForTier } from '../data/killingPointsKids';
import { buildArcPlanForProfile } from './localGenerator';
import { expectedArcPhaseCount } from './arcModels';
import { usesUserChosenProgressionPlan, usesMoneyChordQuota } from './moneyChordPlan';
import { moneyChordRotationPool } from '../data/moneyChords';
import { isKidsArchetype } from '../utils/channelArchetype';
import { workspaceForArchetype } from '../data/workspaces';
import { FIXED_GENRE_MAX_PER_GENRE_ARCHETYPES } from '../data/archetypeAudienceProfiles';
import { hashSeed, seedForBlueprint } from './lyricEngine';

/**
 * 지시문 12 (TASK B) — "관문이 존재하지 않는 데이터를 검사한다"는 재발 유형을
 * 없애기 위한 계약 레이어. `designGate.ts`의 37개 이슈 함수는 건드리지 않는다
 * (추가 전용) — 이 레지스트리는 그 함수들이 이미 내리는 판정과 별개로, "이
 * 채널의 실제 데이터로 이 관문을 통과하는 구성이 존재할 수 있는가"만
 * 답한다. `requires`는 정적 분석이라 실제 배정 알고리즘의 근사치이며, 판정
 * 근거는 실제 코드가 읽는 것과 동일한 함수/데이터를 최대한 재사용한다
 * (BREADTH_THRESHOLDS, resolveConstraintsFromOptions, ERA_POLICY,
 * buildEraCanonPalettePlan, buildArcPlanForProfile 등).
 */
export interface GateDataContractResult {
  satisfiable: boolean;
  reasonKo: string;
  observed: string;
  needed: string;
}

export interface GateDataContract {
  gateId: string;
  requires: (channel: ChannelProfile, opts: GenerationOptions) => GateDataContractResult;
}

function genrePoolFor(channel: ChannelProfile, opts: GenerationOptions): EraTaggedGenrePack[] {
  const ids = (opts.genreIds?.length ? opts.genreIds : channel.preferredGenres) ?? [];
  return ids.map(id => getGenreById(id)).filter((g): g is EraTaggedGenrePack => Boolean(g));
}

function resolvedConstraintsFor(channel: ChannelProfile, opts: GenerationOptions): ResolvedConstraints {
  const workspaceId = workspaceForArchetype(channel.archetype)?.id ?? 'senior-oldpop';
  const audience = audienceProfileForChannelArchetype(channel.archetype, opts.audience);
  return resolveConstraintsFromOptions(
    {
      customConcept: opts.customConcept,
      projectTitle: opts.projectTitle,
      songCount: opts.songCount,
      channel: { archetype: channel.archetype, kidsAgeTierId: channel.kidsAgeTierId },
      breadthOverride: opts.breadthOverride,
      kidsAgeTierId: opts.kidsAgeTierId
    },
    audience,
    workspaceId
  );
}

function countGenresInEraBucket(pool: EraTaggedGenrePack[], bucket: EraBucket): number {
  return pool.filter(g => eraBucketForGenreId(g.id) === bucket).length;
}

// ---------------------------------------------------------------------------
// 시대 (era-primary-share / era-forbidden / era-neutral-share)
// ---------------------------------------------------------------------------
function eraPrimaryShareRequires(channel: ChannelProfile, opts: GenerationOptions): GateDataContractResult {
  const constraints = resolvedConstraintsFor(channel, opts);
  const era = constraints.era;
  if (era.unspecified) {
    return { satisfiable: true, reasonKo: '컨셉에 시대 신호가 없으면 이 관문 자체가 스킵됩니다.', observed: 'era.unspecified=true', needed: 'N/A' };
  }
  const pool = genrePoolFor(channel, opts);
  const songCount = opts.songCount || 18;
  const buckets = era.coPrimary ? [era.primary, era.coPrimary] : [era.primary];
  const minShare = era.coPrimary ? ERA_POLICY.coPrimaryMinEach : ERA_POLICY.singlePrimaryMin;
  const perBucket = buckets.map(bucket => {
    const distinctGenres = countGenresInEraBucket(pool, bucket);
    const achievableShare = Math.min(1, (distinctGenres * GENRE_ERA_QUOTA_PER_GENRE_CAP) / songCount);
    return { bucket, distinctGenres, achievableShare, ok: achievableShare >= minShare };
  });
  const satisfiable = perBucket.every(r => r.ok);
  return {
    satisfiable,
    reasonKo: satisfiable
      ? '이 채널의 후보 장르 풀로 요구 비중을 수학적으로 채울 수 있습니다.'
      : '이 채널의 후보 장르 풀에 해당 시대 장르가 부족해 요구 비중을 수학적으로 채울 수 없습니다 (곡당 상한 5곡 기준).',
    observed: perBucket.map(r => `${r.bucket} 장르 ${r.distinctGenres}종 (달성 가능 최대 ${Math.round(r.achievableShare * 100)}%)`).join(', '),
    needed: perBucket.map(r => `${r.bucket} ${Math.round(minShare * 100)}% 이상`).join(', ')
  };
}

function eraForbiddenRequires(channel: ChannelProfile, opts: GenerationOptions): GateDataContractResult {
  const constraints = resolvedConstraintsFor(channel, opts);
  const era = constraints.era;
  if (era.unspecified || !era.forbidden.length) {
    return { satisfiable: true, reasonKo: '이 컨셉은 금지 시대가 없어 관문이 항상 통과 가능합니다.', observed: 'forbidden=[]', needed: 'N/A' };
  }
  const pool = genrePoolFor(channel, opts);
  const forbiddenSet = new Set<EraBucket>(era.forbidden);
  const nonForbidden = pool.filter(g => !forbiddenSet.has(eraBucketForGenreId(g.id) as EraBucket));
  const satisfiable = nonForbidden.length > 0;
  return {
    satisfiable,
    reasonKo: satisfiable ? '금지 시대가 아닌 장르가 후보 풀에 있어 회피 가능합니다.' : '후보 풀의 모든 장르가 금지된 시대에 속해 회피가 불가능합니다.',
    observed: `후보 ${pool.length}종 중 비금지 ${nonForbidden.length}종`,
    needed: '금지 시대가 아닌 장르 1종 이상'
  };
}

function isEraNeutralGenreId(genreId: string): boolean {
  const fine = ERA_BUCKETS_BY_GENRE_ID[genreId];
  // constraints.ts의 동일 이름 함수와 같은 이유로 매핑 없는 id는 보수적으로 era-neutral 취급한다.
  return !fine || (fine.length === 1 && fine[0] === 'era-neutral');
}

/**
 * 지시문 12 (TASK A-3) — (구) eraGenericShareRequires를 대체한다. 워크스페이스
 * 정책(data/workspaceEraIntent.ts의 eraNeutralPolicy)이 정의돼 있을 때만
 * 검사한다 — 정의 안 된 워크스페이스는 상한 자체가 없으므로 항상 만족.
 * 지시문 33 (§1) — eraNeutralMaxShare(단일 상한값)가 eraNeutralPolicy(상하한
 * 객체)로 바뀌었다 — 이 계약은 상한(maxTracks)만 본다, 하한은 advisory 전용
 * 이라 "채울 수 있는가"라는 만족 가능성 질문과 무관하다.
 */
function eraNeutralShareRequires(channel: ChannelProfile, opts: GenerationOptions): GateDataContractResult {
  const constraints = resolvedConstraintsFor(channel, opts);
  const era = constraints.era;
  const eraNeutralPolicy = eraIntentForWorkspace(constraints.workspaceId).eraNeutralPolicy;
  if (era.unspecified || eraNeutralPolicy === undefined) {
    return { satisfiable: true, reasonKo: '이 컨셉/워크스페이스 정책에는 era-neutral 상한이 적용되지 않습니다.', observed: 'N/A', needed: 'N/A' };
  }
  const eraNeutralMaxShare = eraNeutralPolicy.maxTracks / 18;
  const pool = genrePoolFor(channel, opts);
  const songCount = opts.songCount || 18;
  const nonNeutralGenres = pool.filter(g => !isEraNeutralGenreId(g.id)).length;
  const achievableNonNeutralShare = Math.min(1, (nonNeutralGenres * GENRE_ERA_QUOTA_PER_GENRE_CAP) / songCount);
  const bestCaseNeutralShare = 1 - achievableNonNeutralShare;
  const satisfiable = bestCaseNeutralShare <= eraNeutralMaxShare;
  return {
    satisfiable,
    reasonKo: satisfiable
      ? '시대색이 있는 장르만으로 세트를 채우면 era-neutral 비중을 상한 아래로 낮출 수 있습니다.'
      : '시대색이 있는 장르가 부족해 era-neutral 비중을 상한 아래로 낮출 수 없습니다.',
    observed: `시대색 있는 장르 ${nonNeutralGenres}종, 최선의 경우도 era-neutral 비중 ${Math.round(bestCaseNeutralShare * 100)}%`,
    needed: `era-neutral 비중 ${Math.round(eraNeutralMaxShare * 100)}% 이하 (${constraints.workspaceId} 정책, 추정치)`
  };
}

// ---------------------------------------------------------------------------
// BPM (bpm-stddev / bpm-range / bpm-within-profile)
// ---------------------------------------------------------------------------
function bpmSpreadRequires(channel: ChannelProfile, opts: GenerationOptions, kind: 'stddev' | 'range'): GateDataContractResult {
  const constraints = resolvedConstraintsFor(channel, opts);
  if (constraints.genreBoundedTempo) {
    return { satisfiable: true, reasonKo: 'genreBoundedTempo 오디언스(kr-kids/jp-kids)는 이 관문 자체가 스킵됩니다.', observed: 'genreBoundedTempo=true', needed: 'N/A' };
  }
  const pool = genrePoolFor(channel, opts);
  if (!pool.length) return { satisfiable: false, reasonKo: '후보 장르가 없습니다.', observed: '0종', needed: '1종 이상' };
  const [floor, ceiling] = constraints.tempoRange;
  const lows = pool.map(g => Math.max(g.tempoRange[0], floor));
  const highs = pool.map(g => Math.min(g.tempoRange[1], ceiling));
  const achievableWidth = Math.max(0, Math.max(...highs) - Math.min(...lows));
  const threshold = BREADTH_THRESHOLDS[constraints.breadth].bpm;
  if (kind === 'range') {
    const satisfiable = achievableWidth >= threshold.rangeFloor;
    return {
      satisfiable,
      reasonKo: satisfiable ? '후보 장르의 템포 범위 합이 요구 폭을 커버합니다.' : '후보 장르들의 템포 범위가 좁아 요구 폭을 물리적으로 만들 수 없습니다.',
      observed: `후보 장르 템포 범위 합 폭 ${achievableWidth.toFixed(0)} (오디언스 ${floor}~${ceiling})`,
      needed: `폭 ${threshold.rangeFloor} 이상 (breadth=${constraints.breadth})`
    };
  }
  // stddev는 근사치 — 폭의 절반을 균등 이분포로 나눴을 때 이론적으로 달성 가능한 최대 표준편차로 추정한다 (보수적 상한, 실제 분포 형태에 따라 낮을 수 있음).
  const approxAchievableStddev = achievableWidth / 2;
  const satisfiable = approxAchievableStddev >= threshold.stddevFloor;
  return {
    satisfiable,
    reasonKo: satisfiable
      ? '후보 장르의 템포 범위 폭이 요구 표준편차를 이론상 커버합니다 (근사치).'
      : '후보 장르들의 템포 범위가 좁아 요구 표준편차를 물리적으로 만들 수 없습니다 (근사치).',
    observed: `근사 달성가능 표준편차 ${approxAchievableStddev.toFixed(1)} (범위 폭 ${achievableWidth.toFixed(0)}의 절반)`,
    needed: `≥ ${threshold.stddevFloor} (breadth=${constraints.breadth}, 근사치)`
  };
}

function bpmWithinProfileRequires(): GateDataContractResult {
  return {
    satisfiable: true,
    reasonKo: '트랙 템포는 오디언스 프로파일 자신의 템포 밴드(tempoBandsForProfile)로부터 생성되므로 항상 프로파일 범위 안에 있어야 합니다 — 위반은 데이터 부족이 아니라 배정 로직 결함을 의미합니다.',
    observed: 'N/A',
    needed: '항상 만족 가능'
  };
}

// ---------------------------------------------------------------------------
// 예상 길이 (advisory)
// ---------------------------------------------------------------------------
function songLengthRequires(): GateDataContractResult {
  return {
    satisfiable: true,
    reasonKo: 'advisory 항목이며 BPM/구조 템플릿 배정으로 결정되어 채널 데이터 부족과 무관합니다.',
    observed: 'N/A',
    needed: 'N/A'
  };
}

// ---------------------------------------------------------------------------
// 팔레트 커버리지 (channel sound floor)
// ---------------------------------------------------------------------------
function paletteRequires(channel: ChannelProfile, opts: GenerationOptions, kind: 'coverage' | 'variety' | 'variety-max'): GateDataContractResult {
  const floor = channelSoundFloorForArchetype(channel.archetype);
  if (!floor?.usesPaletteFamily) {
    return { satisfiable: true, reasonKo: '이 아키타입은 팔레트 커버리지 관문이 적용되지 않습니다 (usesPaletteFamily=false).', observed: 'usesPaletteFamily=false', needed: 'N/A' };
  }
  const pool = genrePoolFor(channel, opts);
  const songCount = opts.songCount || 18;
  if (!pool.length) return { satisfiable: false, reasonKo: '후보 장르가 없습니다.', observed: '0종', needed: '1종 이상' };
  // 최선의 경우를 추정하기 위해 후보 풀 전체를 라운드로빈으로 songCount만큼 채워 팔레트 배정을 시뮬레이션한다.
  const genreIdsRepeated: string[] = Array.from({ length: songCount }, (_, i) => pool[i % pool.length].id);
  const seed = hashSeed(seedForBlueprint(opts));
  const assignments = buildEraCanonPalettePlan(genreIdsRepeated, seed, floor.minPaletteVariety);
  const covered = assignments.filter((a): a is PaletteAssignment => Boolean(a));
  const uncovered = assignments.length - covered.length;
  const distinctPalettes = new Set(covered.map(a => a.palette.id)).size;

  if (kind === 'coverage') {
    const satisfiable = uncovered <= floor.maxUncoveredGenreTracks;
    return {
      satisfiable,
      reasonKo: satisfiable ? '채널의 후보 장르로 팔레트 커버리지를 만족할 수 있습니다 (라운드로빈 시뮬레이션).' : '채널의 후보 장르 중 팔레트가 없는 장르가 너무 많아 커버리지 상한을 만족할 수 없습니다.',
      observed: `미적용 ${uncovered}곡 (후보 ${pool.length}종 라운드로빈 배정 시뮬레이션 기준)`,
      needed: `≤ ${floor.maxUncoveredGenreTracks}곡`
    };
  }
  if (kind === 'variety') {
    const satisfiable = !covered.length || distinctPalettes >= floor.minPaletteVariety;
    return {
      satisfiable,
      reasonKo: satisfiable ? '후보 장르가 커버하는 팔레트 종류가 최소 기준 이상입니다.' : '후보 장르가 커버하는 팔레트 종류가 최소 기준보다 적습니다.',
      observed: `${distinctPalettes}종`,
      needed: `≥ ${floor.minPaletteVariety}종`
    };
  }
  return {
    satisfiable: true,
    reasonKo: '팔레트 종류 상한은 세트 구성을 한 계열(paletteFamilies.ts) 안으로 좁히면 항상 만족 가능합니다.',
    observed: `라운드로빈 시뮬레이션 ${distinctPalettes}종`,
    needed: `≤ ${floor.maxPaletteVariety}종`
  };
}

// ---------------------------------------------------------------------------
// 장르 (genre-variety / genre-max / genre-singleton / genre-consecutive)
// ---------------------------------------------------------------------------
function genreVarietyRequires(channel: ChannelProfile, opts: GenerationOptions): GateDataContractResult {
  const constraints = resolvedConstraintsFor(channel, opts);
  const pool = genrePoolFor(channel, opts);
  const threshold = BREADTH_THRESHOLDS[constraints.breadth].genre;
  const candidatePoolSize = pool.length;
  const varietyFloor = Math.min(threshold.min, candidatePoolSize || threshold.min);
  const satisfiable = candidatePoolSize >= varietyFloor;
  return {
    satisfiable,
    reasonKo: satisfiable
      ? '후보 장르 수에 맞춰 하한이 자동 조정되므로(genreIssues의 candidatePoolSize 로직) 항상 만족 가능합니다.'
      : '이 채널에 후보 장르가 전혀 없습니다.',
    observed: `후보 ${candidatePoolSize}종`,
    needed: `${varietyFloor}~${threshold.max}종 (후보 수 기준 자동 조정)`
  };
}

function genreMaxRequires(channel: ChannelProfile, opts: GenerationOptions): GateDataContractResult {
  const constraints = resolvedConstraintsFor(channel, opts);
  const pool = genrePoolFor(channel, opts);
  const threshold = BREADTH_THRESHOLDS[constraints.breadth].genre;
  const songCount = opts.songCount || 18;
  const candidatePoolSize = pool.length || 1;
  const effectiveMaxPerGenre = channel.archetype && FIXED_GENRE_MAX_PER_GENRE_ARCHETYPES.has(channel.archetype)
    ? threshold.maxPerGenre
    : Math.max(threshold.maxPerGenre, Math.ceil(songCount / candidatePoolSize));
  const minPossibleMax = Math.ceil(songCount / candidatePoolSize);
  const satisfiable = minPossibleMax <= effectiveMaxPerGenre;
  return {
    satisfiable,
    reasonKo: satisfiable
      ? '후보 장르 수 대비 상한이 자동 조정되어(senior-morning 제외) 항상 만족 가능합니다.'
      : `senior-morning은 자동 조정 예외라 후보 ${candidatePoolSize}종으로는 장르당 최소 ${minPossibleMax}곡이 필요한데 고정 상한 ${effectiveMaxPerGenre}곡을 넘습니다.`,
    observed: `후보 ${candidatePoolSize}종, songCount ${songCount}`,
    needed: `≤ ${effectiveMaxPerGenre}곡/장르`
  };
}

function genreStructuralRequires(): GateDataContractResult {
  return {
    satisfiable: true,
    reasonKo: '1곡짜리/연속 장르는 genreCountsFromIds·distributeInto의 라운드로빈 배정으로 구조적으로 회피되므로, 위반은 데이터 부족이 아니라 배정 로직 결함을 의미합니다.',
    observed: 'N/A',
    needed: '항상 만족 가능'
  };
}

// ---------------------------------------------------------------------------
// 머니코드
// ---------------------------------------------------------------------------
function moneyChordExplicitRequires(): GateDataContractResult {
  return {
    satisfiable: true,
    reasonKo: '사용자가 명시적으로 선택한 진행이므로 최소 1곡 배정 및 대표곡 반영이 항상 보장됩니다 — 위반은 배정 로직 결함을 의미합니다.',
    observed: 'N/A',
    needed: 'N/A'
  };
}

const MONEYCHORD_MAX_PER_PROGRESSION = 5;

/**
 * 지시문 12 (TASK D) — 3dd661d 재현 실측: kr-kids/jp-kids의 진행 풀이 당시
 * kidsSimple/kidsBright/kidsMarch 3종뿐이라 18÷3=6곡/진행이 강제돼 상한
 * 5곡을 수학적으로 만족할 수 없었다(이후 kidsRound 추가로 4종, 18÷4=4.5로
 * 해소). usesMoneyChordQuota가 true인 아키타입(회전 배분 대상)만 실제
 * moneyChordRotationPool 크기로 판정한다 — 그 외 아키타입은 회전 배분
 * 대상이 아니라 이 관문의 실제 데이터 의존성이 다르므로(이번 세션에서
 * 조사하지 않음) 보수적으로 만족 가능으로 둔다.
 */
function moneyChordMaxRequires(channel: ChannelProfile, opts: GenerationOptions): GateDataContractResult {
  if (usesUserChosenProgressionPlan(opts)) {
    return { satisfiable: true, reasonKo: '명시적 선택 모드는 이 상한 대신 moneychord-explicit-choice-* 로 대체됩니다.', observed: 'explicit-choice mode', needed: 'N/A' };
  }
  if (!usesMoneyChordQuota(opts)) {
    return { satisfiable: true, reasonKo: '이 아키타입은 회전 배분 대상이 아니라(usesMoneyChordQuota=false) 이 계약의 조사 범위 밖입니다 — 보수적으로 만족 가능 처리합니다.', observed: 'usesMoneyChordQuota=false', needed: 'N/A' };
  }
  const songCount = opts.songCount || 18;
  const poolSize = moneyChordRotationPool(channel.archetype).length || 1;
  const minPossibleMax = Math.ceil(songCount / poolSize);
  const satisfiable = minPossibleMax <= MONEYCHORD_MAX_PER_PROGRESSION;
  return {
    satisfiable,
    reasonKo: satisfiable
      ? '회전 배분 풀 크기로 상한을 만족할 수 있습니다.'
      : `회전 배분 풀이 ${poolSize}종뿐이라 균등 분배해도 진행당 최소 ${minPossibleMax}곡이 강제되어 상한 ${MONEYCHORD_MAX_PER_PROGRESSION}곡을 넘습니다.`,
    observed: `회전 배분 풀 ${poolSize}종 (${moneyChordRotationPool(channel.archetype).join(', ')}), songCount ${songCount}`,
    needed: `≤ ${MONEYCHORD_MAX_PER_PROGRESSION}곡/진행`
  };
}

function moneyChordVarietyRequires(channel: ChannelProfile, opts: GenerationOptions): GateDataContractResult {
  if (usesUserChosenProgressionPlan(opts)) {
    return { satisfiable: true, reasonKo: '명시적 선택 모드는 이 관문 대신 moneychord-explicit-choice-share로 대체됩니다.', observed: 'explicit-choice mode', needed: 'N/A' };
  }
  if (!usesMoneyChordQuota(opts)) {
    return { satisfiable: true, reasonKo: '이 아키타입은 회전 배분 대상이 아니라(usesMoneyChordQuota=false) 이 계약의 조사 범위 밖입니다 — 보수적으로 만족 가능 처리합니다.', observed: 'usesMoneyChordQuota=false', needed: 'N/A' };
  }
  const poolSize = moneyChordRotationPool(channel.archetype).length;
  const satisfiable = poolSize >= 4;
  return {
    satisfiable,
    reasonKo: satisfiable ? '회전 배분 풀이 요구 종류 수 이상입니다.' : '회전 배분 풀이 요구 종류 수(4종)보다 적습니다.',
    observed: `회전 배분 풀 ${poolSize}종`,
    needed: '4~6종'
  };
}

// ---------------------------------------------------------------------------
// 편곡 밀도
// ---------------------------------------------------------------------------
function arrangementDensityRequires(): GateDataContractResult {
  return {
    satisfiable: true,
    reasonKo: '편곡 밀도는 고정 3:4:2 가중치 알고리즘으로 배정되며 오디언스 프로파일의 arrangementDensityLimits와 항상 정합되도록 설계되어 있습니다 — 위반은 배정 로직 결함을 의미합니다.',
    observed: 'N/A',
    needed: 'N/A'
  };
}

// ---------------------------------------------------------------------------
// 킬링포인트·아크
// ---------------------------------------------------------------------------
function killingPointCountRequires(channel: ChannelProfile, opts: GenerationOptions): GateDataContractResult {
  const constraints = resolvedConstraintsFor(channel, opts);
  const songCount = opts.songCount || 18;
  const plan = buildArcPlanForProfile(songCount, constraints.arcModelId, constraints.kidsAgeTierId);
  const achievable = plan.filter(p => p.peakStrength !== 'none').length;
  const expected = Math.round(songCount * (12 / 18));
  const satisfiable = achievable >= expected;
  return {
    satisfiable,
    reasonKo: satisfiable ? '아크 플랜상 peakStrength≠none 트랙 수가 기대치를 충족합니다.' : '이 songCount/아크모델 조합에서는 아크 플랜이 기대치만큼의 peakStrength≠none 트랙을 만들지 못합니다.',
    observed: `아크 플랜 기준 ${achievable}곡`,
    needed: `≥ ${expected}곡`
  };
}

function killingPointVarietyRequires(channel: ChannelProfile, opts: GenerationOptions): GateDataContractResult {
  const constraints = resolvedConstraintsFor(channel, opts);
  const songCount = opts.songCount || 18;
  const pool = isKidsArchetype(channel.archetype) ? kidsKillingPointsForTier(constraints.kidsAgeTierId) : KILLING_POINTS;
  const varietyCeiling = isKidsArchetype(channel.archetype) ? pool.length : Infinity;
  const expected = Math.min(Math.max(1, Math.round(songCount * (6 / 18))), varietyCeiling);
  const satisfiable = pool.length >= expected;
  return {
    satisfiable,
    reasonKo: satisfiable ? '후보 킬링포인트 풀이 기대 종류 수 이상입니다 (연령대별 상한은 이미 기대치 계산에 반영됨).' : '이 채널(연령대)의 후보 킬링포인트 풀이 기대 종류 수보다 적습니다.',
    observed: `후보 풀 ${pool.length}종`,
    needed: `≥ ${expected}종`
  };
}

function arcPhasesRequires(channel: ChannelProfile, opts: GenerationOptions): GateDataContractResult {
  const constraints = resolvedConstraintsFor(channel, opts);
  const songCount = opts.songCount || 18;
  const expected = expectedArcPhaseCount(constraints.arcModelId, songCount, constraints.kidsAgeTierId);
  if (songCount < expected) {
    return { satisfiable: true, reasonKo: '이 songCount에서는 아크 구간 체크 자체가 스킵됩니다 (songCount < 기대 구간 수).', observed: `songCount ${songCount} < 기대 ${expected}`, needed: 'N/A' };
  }
  const plan = buildArcPlanForProfile(songCount, constraints.arcModelId, constraints.kidsAgeTierId);
  const achievable = new Set(plan.map(p => p.phase)).size;
  const satisfiable = achievable >= expected;
  return {
    satisfiable,
    reasonKo: satisfiable ? '아크 플랜이 이 songCount 기준으로 전체 구간을 자연히 포함합니다.' : '이 songCount로는 아크 플랜이 전체 구간을 물리적으로 만들 수 없습니다 — 배정 로직 결함을 의미합니다.',
    observed: `실제 아크 플랜 ${achievable}종 (기대 ${expected}종)`,
    needed: `${expected}종`
  };
}

function kidsArcStructureRequires(channel: ChannelProfile, opts: GenerationOptions): GateDataContractResult {
  const constraints = resolvedConstraintsFor(channel, opts);
  if (constraints.arcModelId !== 'repetition-cycle') {
    return { satisfiable: true, reasonKo: 'repetition-cycle 아크모델(kids 워크스페이스)이 아니면 이 관문은 적용되지 않습니다.', observed: constraints.arcModelId, needed: 'N/A' };
  }
  return {
    satisfiable: true,
    reasonKo: '번들 구조는 songCount와 선택된 연령대로부터 결정적으로 계산되므로(kidsArcBundlePlanFor) 구현이 올바르면 항상 만족 가능합니다 — 위반은 데이터 부족이 아니라 배정/재사용 로직 결함을 의미합니다.',
    observed: `songCount=${opts.songCount}, tier=${constraints.kidsAgeTierId ?? '기본(kids-t2)'}`,
    needed: '선택 연령대 정의(arcModels.ts)와 일치'
  };
}

// ---------------------------------------------------------------------------
// 보컬
// ---------------------------------------------------------------------------
function vocalDiversityRequires(channel: ChannelProfile): GateDataContractResult {
  if (channel.vocalQuotaOverride) {
    return {
      satisfiable: true,
      reasonKo: 'vocalQuotaOverride가 있으면 이 일반 다양성 관문 대신 vocal-quota-fidelity로 완전히 대체되어(vocalIssues의 조기 반환) 이 관문 자체가 절대 발생하지 않습니다.',
      observed: 'vocalQuotaOverride 존재',
      needed: 'N/A'
    };
  }
  return { satisfiable: true, reasonKo: '보컬 타입 배분은 장르 데이터와 무관하게 vocalPlan 쿼터 로직이 결정하므로 항상 만족 가능합니다.', observed: 'N/A', needed: '항상 만족 가능' };
}

function vocalQuotaFidelityRequires(channel: ChannelProfile): GateDataContractResult {
  const override = channel.vocalQuotaOverride;
  const total = override ? override.male + override.female + override.mixed : 0;
  const satisfiable = Boolean(override) && total > 0;
  return {
    satisfiable,
    reasonKo: satisfiable ? '채널 자신의 고정 쿼터를 기준으로 측정되므로 항상 만족 가능합니다 — 위반은 배정 로직 결함을 의미합니다.' : 'vocalQuotaOverride가 없거나 합이 0이라 이 관문이 성립하지 않습니다.',
    observed: override ? `male ${override.male}/female ${override.female}/mixed ${override.mixed}` : 'override 없음',
    needed: 'override 합 > 0'
  };
}

// ---------------------------------------------------------------------------
// 어휘 다양성 예측 (advisory)
// ---------------------------------------------------------------------------
function vocabDiversityForecastRequires(channel: ChannelProfile, opts: GenerationOptions): GateDataContractResult {
  const constraints = resolvedConstraintsFor(channel, opts);
  const bankCount = constraints.vocabulary.preferredBanks.length;
  const satisfiable = bankCount >= 3;
  return {
    satisfiable,
    reasonKo: satisfiable ? '이 워크스페이스/시대 조합에 어휘 뱅크가 충분합니다.' : '이 워크스페이스/시대 조합에 등록된 어휘 뱅크가 3개 미만입니다 (advisory이므로 blocking은 아닙니다).',
    observed: `뱅크 ${bankCount}개`,
    needed: '≥ 3개'
  };
}

// ---------------------------------------------------------------------------
// 레지스트리 — DESIGN_GATE_ITEM_IDS의 모든 id를 키로 쓰는 추가 전용 맵.
// requires가 없는 id는 tests/gateDataContract.test.ts의 드리프트 테스트가 잡는다.
// ---------------------------------------------------------------------------
export const GATE_DATA_CONTRACTS: Record<string, GateDataContract> = {
  [DESIGN_GATE_ITEM_IDS.vocalTypeVariety]: { gateId: DESIGN_GATE_ITEM_IDS.vocalTypeVariety, requires: (c) => vocalDiversityRequires(c) },
  [DESIGN_GATE_ITEM_IDS.vocalTypeMin]: { gateId: DESIGN_GATE_ITEM_IDS.vocalTypeMin, requires: (c) => vocalDiversityRequires(c) },
  [DESIGN_GATE_ITEM_IDS.vocalConsecutive]: { gateId: DESIGN_GATE_ITEM_IDS.vocalConsecutive, requires: (c) => vocalDiversityRequires(c) },
  [DESIGN_GATE_ITEM_IDS.vocalSegmentBalance]: { gateId: DESIGN_GATE_ITEM_IDS.vocalSegmentBalance, requires: (c) => vocalDiversityRequires(c) },
  [DESIGN_GATE_ITEM_IDS.vocalQuotaFidelity]: { gateId: DESIGN_GATE_ITEM_IDS.vocalQuotaFidelity, requires: (c) => vocalQuotaFidelityRequires(c) },

  [DESIGN_GATE_ITEM_IDS.bpmStddev]: { gateId: DESIGN_GATE_ITEM_IDS.bpmStddev, requires: (c, o) => bpmSpreadRequires(c, o, 'stddev') },
  [DESIGN_GATE_ITEM_IDS.bpmRange]: { gateId: DESIGN_GATE_ITEM_IDS.bpmRange, requires: (c, o) => bpmSpreadRequires(c, o, 'range') },
  [DESIGN_GATE_ITEM_IDS.bpmWithinProfile]: { gateId: DESIGN_GATE_ITEM_IDS.bpmWithinProfile, requires: () => bpmWithinProfileRequires() },

  [DESIGN_GATE_ITEM_IDS.songLengthEstimate]: { gateId: DESIGN_GATE_ITEM_IDS.songLengthEstimate, requires: () => songLengthRequires() },

  [DESIGN_GATE_ITEM_IDS.paletteCoverage]: { gateId: DESIGN_GATE_ITEM_IDS.paletteCoverage, requires: (c, o) => paletteRequires(c, o, 'coverage') },
  [DESIGN_GATE_ITEM_IDS.paletteVariety]: { gateId: DESIGN_GATE_ITEM_IDS.paletteVariety, requires: (c, o) => paletteRequires(c, o, 'variety') },
  [DESIGN_GATE_ITEM_IDS.paletteVarietyMax]: { gateId: DESIGN_GATE_ITEM_IDS.paletteVarietyMax, requires: (c, o) => paletteRequires(c, o, 'variety-max') },

  [DESIGN_GATE_ITEM_IDS.genreVariety]: { gateId: DESIGN_GATE_ITEM_IDS.genreVariety, requires: (c, o) => genreVarietyRequires(c, o) },
  [DESIGN_GATE_ITEM_IDS.genreMax]: { gateId: DESIGN_GATE_ITEM_IDS.genreMax, requires: (c, o) => genreMaxRequires(c, o) },
  [DESIGN_GATE_ITEM_IDS.genreSingleton]: { gateId: DESIGN_GATE_ITEM_IDS.genreSingleton, requires: () => genreStructuralRequires() },
  [DESIGN_GATE_ITEM_IDS.genreConsecutive]: { gateId: DESIGN_GATE_ITEM_IDS.genreConsecutive, requires: () => genreStructuralRequires() },

  [DESIGN_GATE_ITEM_IDS.moneychordExplicitChoiceZero]: { gateId: DESIGN_GATE_ITEM_IDS.moneychordExplicitChoiceZero, requires: () => moneyChordExplicitRequires() },
  [DESIGN_GATE_ITEM_IDS.moneychordExplicitChoiceFlagship]: { gateId: DESIGN_GATE_ITEM_IDS.moneychordExplicitChoiceFlagship, requires: () => moneyChordExplicitRequires() },
  [DESIGN_GATE_ITEM_IDS.moneychordMax]: { gateId: DESIGN_GATE_ITEM_IDS.moneychordMax, requires: (c, o) => moneyChordMaxRequires(c, o) },
  [DESIGN_GATE_ITEM_IDS.moneychordExplicitChoiceShare]: { gateId: DESIGN_GATE_ITEM_IDS.moneychordExplicitChoiceShare, requires: () => moneyChordExplicitRequires() },
  [DESIGN_GATE_ITEM_IDS.moneychordVariety]: { gateId: DESIGN_GATE_ITEM_IDS.moneychordVariety, requires: (c, o) => moneyChordVarietyRequires(c, o) },

  [DESIGN_GATE_ITEM_IDS.arrangementDensityFullMax]: { gateId: DESIGN_GATE_ITEM_IDS.arrangementDensityFullMax, requires: () => arrangementDensityRequires() },
  [DESIGN_GATE_ITEM_IDS.arrangementDensityMediumMin]: { gateId: DESIGN_GATE_ITEM_IDS.arrangementDensityMediumMin, requires: () => arrangementDensityRequires() },
  [DESIGN_GATE_ITEM_IDS.arrangementDensityConsecutive]: { gateId: DESIGN_GATE_ITEM_IDS.arrangementDensityConsecutive, requires: () => arrangementDensityRequires() },

  [DESIGN_GATE_ITEM_IDS.eraPrimaryShare]: { gateId: DESIGN_GATE_ITEM_IDS.eraPrimaryShare, requires: (c, o) => eraPrimaryShareRequires(c, o) },
  [DESIGN_GATE_ITEM_IDS.eraForbidden]: { gateId: DESIGN_GATE_ITEM_IDS.eraForbidden, requires: (c, o) => eraForbiddenRequires(c, o) },
  [DESIGN_GATE_ITEM_IDS.eraNeutralShare]: { gateId: DESIGN_GATE_ITEM_IDS.eraNeutralShare, requires: (c, o) => eraNeutralShareRequires(c, o) },

  [DESIGN_GATE_ITEM_IDS.killingPointCount]: { gateId: DESIGN_GATE_ITEM_IDS.killingPointCount, requires: (c, o) => killingPointCountRequires(c, o) },
  [DESIGN_GATE_ITEM_IDS.killingPointVariety]: { gateId: DESIGN_GATE_ITEM_IDS.killingPointVariety, requires: (c, o) => killingPointVarietyRequires(c, o) },
  [DESIGN_GATE_ITEM_IDS.arcPhases]: { gateId: DESIGN_GATE_ITEM_IDS.arcPhases, requires: (c, o) => arcPhasesRequires(c, o) },

  [DESIGN_GATE_ITEM_IDS.kidsArcAdultPhaseLeak]: { gateId: DESIGN_GATE_ITEM_IDS.kidsArcAdultPhaseLeak, requires: (c, o) => kidsArcStructureRequires(c, o) },
  [DESIGN_GATE_ITEM_IDS.kidsArcBundleSetMismatch]: { gateId: DESIGN_GATE_ITEM_IDS.kidsArcBundleSetMismatch, requires: (c, o) => kidsArcStructureRequires(c, o) },
  [DESIGN_GATE_ITEM_IDS.kidsArcBundleCountMismatch]: { gateId: DESIGN_GATE_ITEM_IDS.kidsArcBundleCountMismatch, requires: (c, o) => kidsArcStructureRequires(c, o) },
  [DESIGN_GATE_ITEM_IDS.kidsArcLastPhaseIdentity]: { gateId: DESIGN_GATE_ITEM_IDS.kidsArcLastPhaseIdentity, requires: (c, o) => kidsArcStructureRequires(c, o) },
  [DESIGN_GATE_ITEM_IDS.kidsArcLastBundleIntensity]: { gateId: DESIGN_GATE_ITEM_IDS.kidsArcLastBundleIntensity, requires: (c, o) => kidsArcStructureRequires(c, o) },
  [DESIGN_GATE_ITEM_IDS.kidsArcMovingConsecutive]: { gateId: DESIGN_GATE_ITEM_IDS.kidsArcMovingConsecutive, requires: (c, o) => kidsArcStructureRequires(c, o) },

  [DESIGN_GATE_ITEM_IDS.vocabDiversityForecast]: { gateId: DESIGN_GATE_ITEM_IDS.vocabDiversityForecast, requires: (c, o) => vocabDiversityForecastRequires(c, o) }
};
