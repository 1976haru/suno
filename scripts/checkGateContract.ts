/**
 * 지시문 12 (TASK B-2) — "관문 데이터 계약" 실행기. 25개 프리셋 채널 × 워크스페이스당
 * 대표 컨셉 3개를 실제 배포 경로(core/batchPreallocation.ts의 preallocateSongSlots —
 * bridge/Batch API가 실제로 쓰는 슬롯 배정 함수, scripts/audit.ts의 directSetLocal
 * 로컬 미리보기 경로가 아니다)로 슬롯을 배정하고 evaluateDesignGate를 실행한다.
 * blocking 이슈가 나오면 그 관문의 GateDataContract.requires로 "이 채널 데이터로
 * 애초에 통과 가능한가"를 판정해 CONTRACT VIOLATION을 가려낸다.
 *
 * Usage: npx tsx scripts/checkGateContract.ts
 */
import { channelPresets } from '../src/data/presets';
import { getGenreById } from '../src/data/genreLibrary';
import { audienceProfileForChannelArchetype } from '../src/data/audienceProfiles';
import { workspaceForArchetype } from '../src/data/workspaces';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { evaluateDesignGate } from '../src/core/designGate';
import { resolveConstraintsFromOptions } from '../src/core/constraints';
import { GATE_DATA_CONTRACTS } from '../src/core/gateDataContract';
import { DESIGN_GATE_ITEM_IDS } from '../src/core/auditItemIds';
import { moneyChordRotationPool, signatureMoneyChordId } from '../src/data/moneyChords';
import { checkConceptCompatibility } from '../src/core/conceptCompatibility';
import type { ChannelProfile, GenerationOptions, WorkspaceId } from '../src/types';

// 워크스페이스당 대표 컨셉 3개 — 시대/무드 신호가 실제로 걸리는 것 위주로 구성
// (지시문 12 §2-1이 지적한 실제 결함 재현 사례를 포함한다: senior-oldpop의
// "60년대 올드팝"이 그 원사례).
const CONCEPTS_BY_WORKSPACE: Record<WorkspaceId, string[]> = {
  'senior-oldpop': ['60년대 올드팝', '70년대 추억이 느껴지는 올드팝', '특정 시대 없이 편안한 아침 올드팝'],
  'kr-2030': ['퇴근 후 감성 인디팝', '다양한 장르가 섞인 20대 감성 플레이리스트', '잔잔한 밤 드라이브 플레이리스트'],
  'jp-2030': ['帰り道の令和ポップ', '様々なジャンルが混ざった20代の感性プレイリスト', '静かな夜のドライブプレイリスト'],
  'kr-kids': ['신나는 동요 모음', '잠자리에 듣는 조용한 동요', '숫자와 색깔을 배우는 동요'],
  'jp-kids': ['元気な童謡集', '眠る前の静かな子守唄', '数字と色を学ぶ童謡'],
  'kr-idol-male': ['무대 위 강렬한 퍼포먼스 콘셉트', '연습생 시절의 열정을 담은 콘셉트', '멤버들과의 우정을 노래하는 콘셉트'],
  'kr-idol-female': ['당당한 자기주도 콘셉트', '친구들과의 밝은 낮 시간 콘셉트', '쿨한 이별과 새출발 콘셉트']
};

interface ContractViolation {
  channelId: string;
  concept: string;
  gateId: string;
  labelKo: string;
  expected: string;
  actual: string;
  reasonKo: string;
  observed: string;
  needed: string;
  /** 지시문 32 (§1) — cross-style 조합의 위반은 advisory 전용: 출력엔 남지만 통과/위반 집계와 exit code에 반영되지 않는다. */
  advisory: boolean;
}

interface UnsupportedPair {
  channelId: string;
  concept: string;
  reasonKo: string;
  suggestedChannelIds: string[];
}

function buildOpts(channel: ChannelProfile, concept: string, genreIds: string[]): GenerationOptions {
  return {
    channel,
    projectTitle: concept,
    songCount: 18,
    lyricLanguage: channel.primaryLanguage,
    market: channel.market,
    audience: channel.audience,
    genreIds,
    moodIds: channel.preferredMoods,
    seasonId: 'spring-open',
    vocalTone: channel.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customMoneyChord: '',
    customConcept: concept,
    avoidWords: '',
    personaMode: false
  };
}

// ---------------------------------------------------------------------------
// 지시문 27 (TASK D-1) — "머니코드 회전 풀이 세트를 채울 수 있는가". 이번
// 결함(§1-3: 아키타입 7개가 회전 풀 1종뿐이라 36곡 전부 같은 화성)도 "관문이
// 검사하지 않는 데이터" 유형이었다 — 지시문 12의 계약에 이 축이 아예 없었다.
// 13개 정본 아키타입 각각에 대해 (a) 회전 풀 크기 >= 2인가 (b) 18곡 기준
// 시그니처 상한(designGate.ts's MONEY_CHORD_MAX_SONGS_PER_PROGRESSION=8)
// 이내로 세트를 채울 수 있는가를 검사한다. 실제 생성을 돌리지 않는다 —
// moneyChordRotationPool/signatureMoneyChordId 자체가 순수 데이터 함수라
// 직접 호출로 충분하다(§9 실측 — 근사 계산이 아니라 실제 정책 함수 호출).
// ---------------------------------------------------------------------------
const CANONICAL_ARCHETYPES_FOR_MONEY_CHORD: string[] = [
  'senior-morning', 'showa-cafe', 'showa-70s', 'j2000s', 'modern-chill', 'city-night',
  'oldpop-lounge', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-male', 'kr-idol-female', 'lofi-study',
  'kids'
];
const MONEY_CHORD_MAX_SONGS_PER_PROGRESSION = 8;
const REPRESENTATIVE_SONG_COUNT = 18;

function checkMoneyChordRotationContract(): number {
  console.log(`\n[check:gates TASK D-1] 머니코드 회전 풀 계약 — 정본 아키타입 ${CANONICAL_ARCHETYPES_FOR_MONEY_CHORD.length}개\n`);
  let violationCount = 0;
  for (const archetype of CANONICAL_ARCHETYPES_FOR_MONEY_CHORD) {
    const pool = moneyChordRotationPool(archetype);
    const signature = signatureMoneyChordId(archetype);
    const poolOk = pool.length >= 2;
    // 풀이 균등 회전한다고 가정할 때, 18곡을 pool.length종으로 나눈 최댓값이
    // 상한(8)을 넘지 않는가 — "세트를 채울 수 있는가"의 최소 조건.
    const maxIfEven = Math.ceil(REPRESENTATIVE_SONG_COUNT / Math.max(1, pool.length));
    const fillableOk = !poolOk || maxIfEven <= MONEY_CHORD_MAX_SONGS_PER_PROGRESSION;
    const hasSignature = pool.includes(signature);
    if (!poolOk || !fillableOk || !hasSignature) {
      violationCount += 1;
      console.log(`✗ CONTRACT VIOLATION  archetype=${archetype}`);
      if (!poolOk) console.log(`    회전 풀 크기 ${pool.length}종 (< 2) — 회전 불가, moneyChordRotationPool에 엔트리 추가 필요`);
      if (poolOk && !fillableOk) console.log(`    회전 풀 ${pool.length}종으로 ${REPRESENTATIVE_SONG_COUNT}곡 균등 배분 시 최대 ${maxIfEven}곡/진행 — 상한 ${MONEY_CHORD_MAX_SONGS_PER_PROGRESSION}곡 초과`);
      if (!hasSignature) console.log(`    시그니처(${signature})가 자기 자신의 회전 풀에 없음`);
    } else {
      console.log(`✓ ${archetype.padEnd(16)} 풀 ${pool.length}종 (시그니처 ${signature}), 균등 배분 시 최대 ${maxIfEven}곡/진행`);
    }
  }
  console.log(`\n[TASK D-1] 통과 ${CANONICAL_ARCHETYPES_FOR_MONEY_CHORD.length - violationCount} / CONTRACT VIOLATION ${violationCount}`);
  return violationCount;
}

// ---------------------------------------------------------------------------
// 지시문 27 (TASK D-2)가 여기 두었던 "아키타입별 정의 누락 전수표"는 지시문 28
// (TASK A)의 `npm run check:coverage`(scripts/checkArchetypeCoverage.ts)로
// 대체되었다 — 5개 축(moneyChordRotationPool/signatureMoneyChordId/arcModelId/
// introTexturePool/killingPointPool·vocalPresetPool)만 보던 것을 19개 축으로
// 넓히고, "0개가 구조적으로 불가능"이라 보고했던 introTexturePool도 폴백
// 이전 원본 매칭 개수를 드러낸다(실측 결과 oldpop-lounge/kr-2030-pop/
// jp-2030-pop/kr-idol-male/kr-idol-female은 원본 매칭이 0개 — 전체 풀로
// 조용히 폴백하고 있었다, 이 스크립트의 "10개 미만 매칭 시 폴백"이라는
// 설명 자체는 맞았지만 "그래서 0개가 안 나온다"는 결론이 실제로는
// "0개인데 안 보인다"였다). 낡은 경로를 남긴 채 새 경로를 추가하지
// 않는다(§규약 5) — 여기 있던 함수는 삭제했다. 아키타입별 정의 커버리지가
// 궁금하면 check:coverage를 실행할 것.
// ---------------------------------------------------------------------------

function main() {
  const violations: ContractViolation[] = [];
  const unsupportedPairs: UnsupportedPair[] = [];
  const unregisteredGateIds = new Set<string>();
  let pairsPassed = 0;
  let pairsViolated = 0;
  let pairCount = 0;

  console.log(`[check:gates] ${channelPresets.length}채널 × 워크스페이스별 대표 컨셉 3개 × 관문 ${Object.keys(DESIGN_GATE_ITEM_IDS).length}종\n`);

  for (const channel of channelPresets) {
    const workspaceId = workspaceForArchetype(channel.archetype)?.id ?? 'senior-oldpop';
    const concepts = CONCEPTS_BY_WORKSPACE[workspaceId] ?? CONCEPTS_BY_WORKSPACE['senior-oldpop'];
    const audienceProfile = audienceProfileForChannelArchetype(channel.archetype, channel.audience);
    const genreIds = channel.preferredGenres;
    const genres = genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));

    for (const concept of concepts) {
      pairCount += 1;

      // 지시문 32 (§1) — 이 조합을 애초에 이 채널에서 시도해야 하는지 먼저
      // 판정한다. unsupported면 CONTRACT VIOLATION 집계에서 완전히 빼고
      // "지원하지 않는 조합"으로 별도 기록한다(채널 데이터 결핍이 아니라
      // 조합 설계 자체의 문제이므로). cross-style이면 관문은 그대로 돌리되
      // 위반이 나와도 advisory로만 남긴다(§ "하지 말 것": cross-style을
      // unsupported로 강등 금지, 그렇다고 supported처럼 blocking으로 세지도
      // 않는다).
      const compat = checkConceptCompatibility(concept, channel);
      if (compat.compatibility === 'unsupported') {
        unsupportedPairs.push({
          channelId: channel.id,
          concept,
          reasonKo: compat.reasonKo,
          suggestedChannelIds: compat.suggestedChannelIds ?? []
        });
        continue;
      }

      const opts = buildOpts(channel, concept, genreIds);
      const constraints = resolveConstraintsFromOptions(opts, audienceProfile, workspaceId);
      const slots = preallocateSongSlots(opts, genres);
      const result = evaluateDesignGate(slots, constraints, opts);

      let pairHasBlockingViolation = false;
      for (const issueItem of result.blocking) {
        const contract = GATE_DATA_CONTRACTS[issueItem.id];
        if (!contract) {
          unregisteredGateIds.add(issueItem.id);
          continue;
        }
        const requiresResult = contract.requires(channel, opts);
        if (!requiresResult.satisfiable) {
          const advisory = compat.compatibility === 'cross-style';
          if (!advisory) pairHasBlockingViolation = true;
          violations.push({
            channelId: channel.id,
            concept,
            gateId: issueItem.id,
            labelKo: issueItem.labelKo,
            expected: issueItem.expected,
            actual: issueItem.actual,
            reasonKo: requiresResult.reasonKo,
            observed: requiresResult.observed,
            needed: requiresResult.needed,
            advisory
          });
        }
      }
      if (pairHasBlockingViolation) pairsViolated += 1; else pairsPassed += 1;
    }
  }

  const blockingViolations = violations.filter(v => !v.advisory);
  const advisoryViolations = violations.filter(v => v.advisory);

  for (const v of blockingViolations) {
    console.log(`✗ CONTRACT VIOLATION  ${v.channelId} / "${v.concept}"`);
    console.log(`    ${v.gateId}    ${v.labelKo} — 기대 ${v.expected} | 실측 ${v.actual}`);
    console.log(`    이 채널의 데이터: ${v.observed}`);
    console.log(`    필요: ${v.needed}`);
    console.log(`    → ${v.reasonKo}\n`);
  }

  if (advisoryViolations.length) {
    console.log(`--- cross-style 조합 advisory (blocking 아님, 참고용) ---`);
    for (const v of advisoryViolations) {
      console.log(`△ ADVISORY  ${v.channelId} / "${v.concept}"`);
      console.log(`    ${v.gateId}    ${v.labelKo} — 기대 ${v.expected} | 실측 ${v.actual}`);
      console.log(`    → ${v.reasonKo}\n`);
    }
  }

  if (unsupportedPairs.length) {
    console.log(`--- 지원하지 않는 조합 (unsupported — CONTRACT VIOLATION 집계 제외) ---`);
    for (const p of unsupportedPairs) {
      console.log(`○ UNSUPPORTED  ${p.channelId} / "${p.concept}"`);
      console.log(`    → ${p.reasonKo}`);
      if (p.suggestedChannelIds.length) console.log(`    대안 채널: ${p.suggestedChannelIds.join(', ')}`);
      console.log('');
    }
  }

  if (unregisteredGateIds.size) {
    console.log(`✗ UNREGISTERED GATE — requires가 등록되지 않은 관문: ${[...unregisteredGateIds].join(', ')}\n`);
  }

  console.log(`통과 ${pairsPassed} / 위반 ${pairsViolated}  (총 ${pairCount}쌍, 지원하지 않는 조합 제외 후 검사 대상 ${pairCount - unsupportedPairs.length}쌍, CONTRACT VIOLATION ${blockingViolations.length}건, cross-style advisory ${advisoryViolations.length}건, 지원하지 않는 조합 ${unsupportedPairs.length}건, 미등록 관문 ${unregisteredGateIds.size}개)`);

  const moneyChordViolations = checkMoneyChordRotationContract();

  if (pairsViolated > 0 || unregisteredGateIds.size > 0 || moneyChordViolations > 0) {
    process.exitCode = 1;
  }
}

main();
