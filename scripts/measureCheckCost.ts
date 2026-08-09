/**
 * 지시문 19 (TASK D) — 측정 전용. S4/stress-v314 DV1이 CI에서 타임아웃난다는
 * 지시문의 claim을 실측 없이 그대로 믿지 않는다(이 세션 전체의 확립된 관행:
 * "지시문 자체 숫자도 stale할 수 있다" — archetype 하드코딩 개수, Suno-Weaver-
 * Studio 문자열 개수, lint 131/66 등 매번 재측정해서 검증해왔음). 이 스크립트는
 * S4/DV1이 실제로 반복 호출하는 단일 연산(generateLocalBlueprint 등)의 곡당
 * 실측 비용과, 그 연산이 몇 번 반복되는지(조합 수)를 각각 독립적으로 측정해
 * "전체 시간 = 1회 비용 × 반복 횟수"가 실측과 맞는지 교차검증한다.
 *
 * 타임아웃 자체를 올리지 않는다(지시문 19 명시 금지) — 이 스크립트는 순수 측정
 * 도구이며, npm run measure:checks로만 실행된다.
 *
 * Vite 전용 `?worker` import를 거치는 모듈(core/localGenerationClient.ts 등)은
 * import하지 않는다 — scripts/performanceBudget.ts의 동일한 doc comment 참고.
 * 이 스크립트는 그 제약이 없는 순수 함수만 다루므로 `npx tsx`로 직접 실행 가능.
 */
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { evaluateDesignGate } from '../src/core/designGate';
import { resolveConstraintsFromOptions } from '../src/core/constraints';
import { runFullAudit } from '../src/core/fullAudit';
import { audienceProfileForChannelArchetype } from '../src/data/audienceProfiles';
import { channelPresets, genrePacks, moodPacks, seasonPacks, makeOptions } from '../tests/fixtures';
import { vocalPresets } from '../src/data/vocalPresets';
import { moneyChordPresets } from '../src/data/moneyChords';
import { getCoreGenreIdsForArchetype } from '../src/data/genreLibrary';
import type { GenerationOptions } from '../src/types';

function time<T>(fn: () => T): { result: T; ms: number } {
  const start = performance.now();
  const result = fn();
  return { result, ms: performance.now() - start };
}

function meanMs(samples: number[]): number {
  return samples.reduce((sum, v) => sum + v, 0) / samples.length;
}

function repeat(n: number, fn: () => void): number[] {
  const samples: number[] = [];
  for (let i = 0; i < n; i++) {
    const { ms } = time(fn);
    samples.push(ms);
  }
  return samples;
}

const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
const genre = genrePacks[0];
const season = seasonPacks[0];
const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id)).slice(0, 2);

console.log('=== 지시문 19 TASK D — 실측 (measure only, timeout 상향 없음) ===\n');

// ---------------------------------------------------------------------------
// 1. S4의 실제 반복 단위: generateLocalBlueprint(songCount:1) 1회 호출 비용
// ---------------------------------------------------------------------------
{
  const opts = makeOptions({ channel, songCount: 1, genreIds: [genre.id], seasonId: season.id });
  const samples = repeat(50, () => generateLocalBlueprint(opts, [genre], moods, season));
  const perCall = meanMs(samples);
  const s4Combos = genrePacks.length * 3 * seasonPacks.length; // genre x {en,ko,ja} x season
  console.log(`[S4 구성 요소] generateLocalBlueprint(songCount=1) 평균: ${perCall.toFixed(3)}ms (50회 샘플)`);
  console.log(`[S4 반복 횟수] genrePacks(${genrePacks.length}) x 3언어 x seasonPacks(${seasonPacks.length}) = ${s4Combos}회`);
  console.log(`[S4 예측 총합] ${perCall.toFixed(3)}ms x ${s4Combos} = ${(perCall * s4Combos).toFixed(0)}ms (실측 stress-production.test.ts 단독 실행 시간과 비교할 것)`);
  console.log('');
}

// ---------------------------------------------------------------------------
// 2. DV1의 실제 반복 단위: generateLocalBlueprint(songCount:1) 1회 호출 비용
//    (같은 함수, 다른 조합 축 — 실제 DV1 코드와 동일한 옵션 구성으로 별도 측정)
// ---------------------------------------------------------------------------
{
  const coreGenreIds = getCoreGenreIdsForArchetype('senior-morning');
  const moneyChordModes = (Object.keys(moneyChordPresets) as GenerationOptions['moneyChordMode'][]).filter(m => m !== 'default');
  const vocal = vocalPresets[0];
  const dv1Genre = genrePacks.find(g => g.id === coreGenreIds[0])!;
  const opts = makeOptions({
    channel, songCount: 1, genreIds: [dv1Genre.id], moodIds: moods.map(m => m.id), seasonId: season.id,
    vocalTone: vocal.prompt, moneyChordMode: moneyChordModes[0]
  });
  const samples = repeat(50, () => generateLocalBlueprint(opts, [dv1Genre], moods, season));
  const perCall = meanMs(samples);
  const dv1Combos = moneyChordModes.length * vocalPresets.length * coreGenreIds.length;
  console.log(`[DV1 구성 요소] generateLocalBlueprint(songCount=1, moneyChord+vocal 조합) 평균: ${perCall.toFixed(3)}ms (50회 샘플)`);
  console.log(`[DV1 반복 횟수] moneyChordModes(${moneyChordModes.length}, default 제외) x vocalPresets(${vocalPresets.length}) x senior-morning core genres(${coreGenreIds.length}) = ${dv1Combos}회`);
  console.log(`[DV1 예측 총합] ${perCall.toFixed(3)}ms x ${dv1Combos} = ${(perCall * dv1Combos).toFixed(0)}ms (실측 stress-v314.test.ts 단독 실행 시간과 비교할 것)`);
  console.log('');
}

// ---------------------------------------------------------------------------
// 3. 참고: 18곡 팩 기준 개별 관문/체크 비용 (perf:budget이 이미 다루는 것과
//    겹치지 않는, S4/DV1이 직접 부르지 않는 항목은 제외 — evaluateDesignGate/
//    runFullAudit은 S4/DV1 경로에 없지만 "다른 무거운 연산과 비교" 참고용으로 포함)
// ---------------------------------------------------------------------------
{
  const opts = makeOptions({ channel, songCount: 18, genreIds: channel.preferredGenres, seasonId: season.id });
  const genres18 = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const { result: bp18, ms: genMs } = time(() => generateLocalBlueprint(opts, genres18, moods, season));
  const audienceProfile = audienceProfileForChannelArchetype(opts.channel.archetype, opts.audience);
  const constraints = resolveConstraintsFromOptions(opts, audienceProfile);
  const slots = preallocateSongSlots(opts, genres18);
  const { ms: gateMs } = time(() => evaluateDesignGate(slots, constraints, opts));
  const { ms: auditMs } = time(() => runFullAudit(bp18.songs, { conceptLabel: opts.projectTitle, songCount: 18, audienceProfile }));
  console.log('[참고] 18곡 팩 1회 기준 (S4/DV1이 직접 부르지 않는 경로, 비교용):');
  console.log(`  generateLocalBlueprint(18곡): ${genMs.toFixed(1)}ms`);
  console.log(`  evaluateDesignGate: ${gateMs.toFixed(1)}ms`);
  console.log(`  runFullAudit: ${auditMs.toFixed(1)}ms`);
  console.log('');
}

console.log('=== 실측 종료 — 위 "예측 총합"을 npm run test:stress 실측치와 대조해 리포트에 첨부할 것 ===');
