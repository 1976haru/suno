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

function main() {
  const violations: ContractViolation[] = [];
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
      const opts = buildOpts(channel, concept, genreIds);
      const constraints = resolveConstraintsFromOptions(opts, audienceProfile, workspaceId);
      const slots = preallocateSongSlots(opts, genres);
      const result = evaluateDesignGate(slots, constraints, opts);

      let pairHasViolation = false;
      for (const issueItem of result.blocking) {
        const contract = GATE_DATA_CONTRACTS[issueItem.id];
        if (!contract) {
          unregisteredGateIds.add(issueItem.id);
          continue;
        }
        const requiresResult = contract.requires(channel, opts);
        if (!requiresResult.satisfiable) {
          pairHasViolation = true;
          violations.push({
            channelId: channel.id,
            concept,
            gateId: issueItem.id,
            labelKo: issueItem.labelKo,
            expected: issueItem.expected,
            actual: issueItem.actual,
            reasonKo: requiresResult.reasonKo,
            observed: requiresResult.observed,
            needed: requiresResult.needed
          });
        }
      }
      if (pairHasViolation) pairsViolated += 1; else pairsPassed += 1;
    }
  }

  for (const v of violations) {
    console.log(`✗ CONTRACT VIOLATION  ${v.channelId} / "${v.concept}"`);
    console.log(`    ${v.gateId}    ${v.labelKo} — 기대 ${v.expected} | 실측 ${v.actual}`);
    console.log(`    이 채널의 데이터: ${v.observed}`);
    console.log(`    필요: ${v.needed}`);
    console.log(`    → ${v.reasonKo}\n`);
  }

  if (unregisteredGateIds.size) {
    console.log(`✗ UNREGISTERED GATE — requires가 등록되지 않은 관문: ${[...unregisteredGateIds].join(', ')}\n`);
  }

  console.log(`통과 ${pairsPassed} / 위반 ${pairsViolated}  (총 ${pairCount}쌍, CONTRACT VIOLATION ${violations.length}건, 미등록 관문 ${unregisteredGateIds.size}개)`);

  if (pairsViolated > 0 || unregisteredGateIds.size > 0) {
    process.exitCode = 1;
  }
}

main();
