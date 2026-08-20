/**
 * 지시문 51 (TASK D) — "정의됐고 배선됐는가"는 check:coverage/consumption/
 * reachability가 이미 본다. 아무도 안 본 것은 "실제로 쓰이는가"다. 하루의
 * 실측(컨셉 5개 기준 18~25%, 장르 많은 채널일수록 활용률이 낮다)을 이
 * 스크립트로 재현 가능하게 만든다 — 매번 손으로 5~10개 컨셉을 넣어보지
 * 않아도 된다.
 *
 * 각 아키타입에 대해:
 *   1) core/conceptAgent.ts의 recommendConceptLocal(로컬 경로, API 비용 0)로
 *      컨셉 표본 10개를 돌린다 — 두 추천(primary+secondary) 모두의
 *      genreAllocation을 합쳐 "이 아키타입에서 추천이 실제로 쓴 장르"로 센다.
 *   2) 채널의 preferredGenres(그 채널이 실제로 갖고 있는 장르 — TASK A-2가
 *      "채널 장르"라고 부르는 것)와 대조해 활용률(%)을 낸다.
 *   3) 한 번도 안 쓰인 장르 목록을 낸다.
 *
 * §하지 말 것 "세트를 차단하지 말 것" — 50% 미만이면 경고만 출력한다.
 * exit 0 고정.
 *
 * Usage: npx tsx scripts/checkGenreUtilization.ts [--archetype=senior-morning] [--concepts=20]
 */
import { recommendConceptLocal } from '../src/core/conceptAgent';
import { channelPresets } from '../src/data/presets';
import type { ChannelArchetype } from '../src/types';

/** 지시문 51 §1-1/§1-2가 실측에 쓴 10개 표본 그대로 — 새 표본을 지어내지 않는다. */
const CONCEPT_SAMPLES = [
  '카페에서 듣고 싶은 노래',
  '비 오는 날',
  '밤에 듣는 노래',
  '드라이브',
  '아침',
  '재즈',
  '발라드',
  '60년대',
  '70년대',
  '크리스마스'
];

/** 지시문51 §UTILIZATION_WARN_THRESHOLD — advisory 경고 임계값(추정치, verified: false). 하루의 실측(18~25%)이 훨씬 낮았던 것을 근거로 "절반은 써야 한다"는 §A-2 요구를 그대로 옮긴다. */
const UTILIZATION_WARN_THRESHOLD = 0.5;

const ARCHETYPES: ChannelArchetype[] = [
  'kr-2030-pop', 'senior-morning', 'oldpop-lounge', 'modern-chill', 'city-night',
  'lofi-study', 'kr-kids-song', 'jp-kids-song', 'kr-idol-female', 'jp-2030-pop',
  'kr-idol-male', 'kids', 'showa-70s'
];

interface UtilizationRow {
  archetype: ChannelArchetype;
  channelId: string;
  channelGenreCount: number;
  usedCount: number;
  utilization: number;
  unused: string[];
  usageCounts: Map<string, number>;
}

function measureArchetype(archetype: ChannelArchetype, conceptCount: number): UtilizationRow | null {
  const channel = channelPresets.find(c => c.archetype === archetype);
  if (!channel) return null;
  const channelGenres = new Set(channel.preferredGenres);
  const usageCounts = new Map<string, number>();
  const samples = CONCEPT_SAMPLES.slice(0, conceptCount);

  // 지시문 51 (TASK A-2①) — "이력 기반 tie-break"를 실제로 재현한다: 한
  // 컨셉의 결과를 다음 컨셉 호출의 recentGenreIds로 넘겨 누적한다. 실제
  // UI(ConceptAgentPanel.tsx)도 core/recentGenreStore.ts를 통해 같은 방식
  // (세션 내 실제 적용 이력 누적)으로 동작한다 — 매 호출을 독립적으로
  // recentGenreIds=[]로 돌리면 이 tie-break 자체를 측정에서 빼먹는
  // 것이다.
  let recentGenreIds: string[] = [];
  for (const text of samples) {
    const result = recommendConceptLocal(text, archetype, undefined, 0, 15, recentGenreIds);
    const usedThisCall: string[] = [];
    for (const rec of result.recommendations) {
      for (const slot of rec.genreAllocation) {
        usageCounts.set(slot.genreId, (usageCounts.get(slot.genreId) ?? 0) + 1);
        usedThisCall.push(slot.genreId);
      }
    }
    recentGenreIds = [...new Set([...usedThisCall, ...recentGenreIds])].slice(0, 12);
  }

  const usedInChannel = [...usageCounts.keys()].filter(id => channelGenres.has(id));
  const unused = [...channelGenres].filter(id => !usageCounts.has(id));

  return {
    archetype,
    channelId: channel.id,
    channelGenreCount: channelGenres.size,
    usedCount: usedInChannel.length,
    utilization: channelGenres.size ? usedInChannel.length / channelGenres.size : 0,
    unused,
    usageCounts
  };
}

function main() {
  const args = process.argv.slice(2);
  const archetypeArg = args.find(a => a.startsWith('--archetype='))?.split('=')[1];
  const conceptCount = Number(args.find(a => a.startsWith('--concepts='))?.split('=')[1] ?? '10');

  const targets = archetypeArg ? ARCHETYPES.filter(a => a === archetypeArg) : ARCHETYPES;

  console.log(`[check:genre-utilization] 컨셉 표본 ${conceptCount}개 × ${targets.length}개 아키타입\n`);
  console.log('아키타입              채널ID                        채널 장르   사용됨   활용률');
  console.log('─'.repeat(90));

  let warnCount = 0;
  const rows: UtilizationRow[] = [];
  for (const archetype of targets) {
    const row = measureArchetype(archetype, conceptCount);
    if (!row) { console.log(`${archetype.padEnd(20)} (채널 없음 — 건너뜀)`); continue; }
    rows.push(row);
    const pct = (row.utilization * 100).toFixed(0) + '%';
    const warn = row.utilization < UTILIZATION_WARN_THRESHOLD ? ' ⚠' : '';
    if (row.utilization < UTILIZATION_WARN_THRESHOLD) warnCount++;
    console.log(`${row.archetype.padEnd(20)} ${row.channelId.padEnd(28)} ${String(row.channelGenreCount).padStart(6)}   ${String(row.usedCount).padStart(4)}   ${pct.padStart(5)}${warn}`);
  }

  console.log('\n한 번도 안 쓰인 장르 (채널 장르 중):');
  for (const row of rows) {
    if (!row.unused.length) continue;
    console.log(`  ${row.archetype}: ${row.unused.join(', ')}`);
  }

  console.log(`\n${UTILIZATION_WARN_THRESHOLD * 100}% 미만 아키타입: ${warnCount}/${rows.length}`);
  console.log('[check:genre-utilization] advisory — 통과 처리(exit 0). 차단하지 않는다.');
}

main();
