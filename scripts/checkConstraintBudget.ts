/**
 * 지시문 36 (TASK D) — "제약 예산 검사". 개별 관문(check:gates/check:settings/
 * check:coverage/check:archetype)은 저마다 하나의 축만 검사한다 — 어떤 관문도
 * "이 아키타입에 동시에 걸려 있는 제약을 전부 합치면, 그래도 좋은 곡이 나올
 * 여지가 남는가"는 검사하지 않는다. 이 스크립트는 판정하지 않는다 — 나열하고
 * 세기만 한다(§D-3 "절대 blocking 아님").
 *
 * 대상은 scripts/checkGateContract.ts의 CANONICAL_ARCHETYPES_FOR_MONEY_CHORD와
 * 동일한 13개 정본 아키타입이다 — 지시문 36 원문이 "13 워크스페이스"라고 쓴
 * 숫자가 실제 WorkspaceId(7개)와 맞지 않아, 이 저장소에 이미 존재하는 유일한
 * "13개" 관례(지시문 27, TASK D-1)를 실제 기준으로 채택했다. WorkspaceId(7개)
 * 기준이 아니라 ChannelArchetype(13개 정본) 기준인 이유: senior-oldpop
 * 워크스페이스 하나가 시니어(4개)와 비-시니어(j2000s/modern-chill/city-night)
 * 아키타입을 함께 묶고 있어([[senior_oldpop_multi_audience]] 메모리 참고),
 * 워크스페이스 단위로만 세면 이 차이가 사라진다.
 *
 * Usage: npx tsx scripts/checkConstraintBudget.ts
 */
import type { ChannelArchetype, WorkspaceId } from '../src/types';
import { channelSoundFloorForArchetype } from '../src/data/channelSoundFloor';
import { audienceProfileForChannelArchetype, tempoBandsForProfile } from '../src/data/audienceProfiles';
import { workspaceForArchetype } from '../src/data/workspaces';
import { eraIntentForWorkspace } from '../src/data/workspaceEraIntent';
import { ERA_POLICY } from '../src/data/eraPolicy';
import { LISTENING_INTENT_POLICY, DEFAULT_LISTENING_INTENT } from '../src/data/listeningIntentPolicy';

// 지시문 27 (TASK D-1)의 CANONICAL_ARCHETYPES_FOR_MONEY_CHORD와 동일한 13개.
const CANONICAL_ARCHETYPES: ChannelArchetype[] = [
  'senior-morning', 'showa-cafe', 'showa-70s', 'j2000s', 'modern-chill', 'city-night',
  'oldpop-lounge', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-male', 'kr-idol-female', 'lofi-study',
  'kids'
];

const SAMPLE_SONG_COUNT = 18;
// setDirector.ts's capCompatibleFamilySongs가 실제로 쓰는 하드코딩 상수
// (line 1741의 리터럴 5) — 팔레트 계열 축의 "주 그룹 최소 곡 수"는
// songCount - 이 캡으로 유도된다.
const PALETTE_FAMILY_COMPATIBLE_CAP = 5;

/**
 * §D-3 "8종을 넘으면 창작 여지가 좁아질 수 있습니다" — 하루/챗지피티가 제안한
 * 추정 임계값이다. 검증된 값이 아니다 — 절대 blocking에 쓰지 않는다(§D-3
 * "하지 말 것: 절대 blocking 없음").
 */
const CONSTRAINT_COUNT_WARNING_THRESHOLD = 8;

interface ConstraintRow {
  labelKo: string;
  sourceKo: string;
  removesKo: string;
}

function workspaceIdFor(archetype: ChannelArchetype): WorkspaceId | undefined {
  return workspaceForArchetype(archetype)?.id;
}

function buildConstraintRows(archetype: ChannelArchetype): ConstraintRow[] {
  const rows: ConstraintRow[] = [];
  const workspaceId = workspaceIdFor(archetype);

  const floor = channelSoundFloorForArchetype(archetype);
  if (floor) {
    if (floor.forbiddenAtoms.length > 0) {
      rows.push({
        labelKo: `forbiddenAtoms ${floor.forbiddenAtoms.length}종`,
        sourceKo: 'channelSoundFloor',
        removesKo: '프로덕션 수단'
      });
    }
    if (floor.requiredAtoms.length > 0) {
      rows.push({
        labelKo: `requiredAtoms ${floor.requiredAtoms.length}종`,
        sourceKo: 'channelSoundFloor',
        removesKo: '믹스 폭·필수 질감'
      });
    }
  }

  const audienceProfile = audienceProfileForChannelArchetype(archetype, undefined);
  rows.push({
    labelKo: `tempoCeiling ${audienceProfile.tempoCeiling}`,
    sourceKo: 'audienceProfile',
    removesKo: '템포 상단'
  });
  const bands = tempoBandsForProfile(audienceProfile);
  rows.push({
    labelKo: `BPM 대역 ${bands.length}개 (${bands.map(b => b.shareOf18).join('·')})`,
    sourceKo: 'audienceProfile',
    removesKo: '템포 분포'
  });
  if (audienceProfile.hardExclusions.length > 0) {
    rows.push({
      labelKo: `hardExclusions ${audienceProfile.hardExclusions.length}종`,
      sourceKo: 'audienceProfile',
      removesKo: '킬링포인트에서도 안 풀리는 배제 요소'
    });
  }
  if (audienceProfile.constraints.length > 0) {
    rows.push({
      labelKo: `constraints ${audienceProfile.constraints.length}종`,
      sourceKo: 'audienceProfile',
      removesKo: '보컬·편곡 스타일'
    });
  }

  const intentPolicy = LISTENING_INTENT_POLICY[DEFAULT_LISTENING_INTENT];
  rows.push({
    labelKo: `목표 에너지 ${intentPolicy.targetAverageEnergy} (${intentPolicy.labelKo})`,
    sourceKo: 'listeningIntent',
    removesKo: '에너지 상단'
  });

  if (workspaceId) {
    const eraIntent = eraIntentForWorkspace(workspaceId);
    if (eraIntent.mode === 'strict-decade') {
      rows.push({
        labelKo: `era primary ${Math.round(ERA_POLICY.singlePrimaryMin * 100)}%`,
        sourceKo: 'eraIntent',
        removesKo: '장르 선택지'
      });
    }
    if (eraIntent.eraNeutralPolicy) {
      rows.push({
        labelKo: `era-neutral 상한 ${eraIntent.eraNeutralPolicy.maxTracks}`,
        sourceKo: 'eraNeutralPolicy',
        removesKo: '발라드 등 시대색 없는 장르 상단'
      });
    }
  }

  if (floor?.usesPaletteFamily) {
    rows.push({
      labelKo: `팔레트 계열 주 그룹 ${SAMPLE_SONG_COUNT - PALETTE_FAMILY_COMPATIBLE_CAP}곡 이상`,
      sourceKo: 'paletteFamilies + setDirector.capCompatibleFamilySongs',
      removesKo: '음색 다양성(가족 밖 장르 유입)'
    });
  }

  rows.push({
    labelKo: `편곡 밀도 sparseMin${audienceProfile.arrangementDensityLimits.sparseMin}/fullMax${audienceProfile.arrangementDensityLimits.fullMax}`,
    sourceKo: 'audienceProfile.arrangementDensityLimits',
    removesKo: '밀도 분포'
  });

  return rows;
}

function printArchetypeReport(archetype: ChannelArchetype): number {
  const workspaceId = workspaceIdFor(archetype);
  const rows = buildConstraintRows(archetype);
  console.log(`\n[check:budget] ${archetype} (${workspaceId ?? '워크스페이스 미상'}) / ${LISTENING_INTENT_POLICY[DEFAULT_LISTENING_INTENT].labelKo}\n`);
  console.log('  제약                                    출처                                        제거하는 것');
  console.log('  ' + '─'.repeat(100));
  for (const row of rows) {
    console.log(`  ${row.labelKo.padEnd(40)}  ${row.sourceKo.padEnd(40)}  ${row.removesKo}`);
  }
  console.log(`\n  동시 제약 ${rows.length}종`);
  if (rows.length > CONSTRAINT_COUNT_WARNING_THRESHOLD) {
    console.log(`  ⚠ 경고: 제약이 ${CONSTRAINT_COUNT_WARNING_THRESHOLD}종을 넘으면 창작 여지가 좁아질 수 있습니다 (추정 임계값, blocking 아님).`);
  }
  return rows.length;
}

function main() {
  console.log('='.repeat(100));
  console.log('[check:budget] 워크스페이스/아키타입별 동시 제약 목록 — 지시문 36 TASK D');
  console.log('출력 전용입니다. 어떤 세트도 이 결과로 막히지 않습니다.');
  console.log('='.repeat(100));

  const counts: { archetype: ChannelArchetype; workspaceId: WorkspaceId | undefined; count: number }[] = [];
  for (const archetype of CANONICAL_ARCHETYPES) {
    const count = printArchetypeReport(archetype);
    counts.push({ archetype, workspaceId: workspaceIdFor(archetype), count });
  }

  console.log(`\n${'='.repeat(100)}`);
  console.log('[check:budget] 요약 — 아키타입별 동시 제약 수 (내림차순)');
  console.log('='.repeat(100));
  const sorted = [...counts].sort((a, b) => b.count - a.count);
  for (const { archetype, workspaceId, count } of sorted) {
    const flag = count > CONSTRAINT_COUNT_WARNING_THRESHOLD ? ' ⚠' : '';
    console.log(`  ${archetype.padEnd(16)} (${(workspaceId ?? '?').padEnd(14)}) ${String(count).padStart(2)}종${flag}`);
  }

  const seniorArchetypes = new Set(['senior-morning', 'showa-cafe', 'showa-70s', 'oldpop-lounge']);
  const seniorCounts = counts.filter(c => seniorArchetypes.has(c.archetype)).map(c => c.count);
  const kr2030Count = counts.find(c => c.archetype === 'kr-2030-pop')?.count ?? 0;
  const kidsCount = counts.find(c => c.archetype === 'kids')?.count ?? 0;
  const seniorMax = seniorCounts.length ? Math.max(...seniorCounts) : 0;
  const seniorMin = seniorCounts.length ? Math.min(...seniorCounts) : 0;
  console.log(`\n  시니어(4개 아키타입) 제약 수: ${seniorMin}~${seniorMax}종 · kr-2030-pop ${kr2030Count}종 · kids ${kidsCount}종`);
  console.log(`  ⚠ senior 계열이 kr-2030-pop보다 ${seniorMin - kr2030Count >= 0 ? seniorMin - kr2030Count : 0}~${seniorMax - kr2030Count}종 더 많습니다.\n`);
}

main();
