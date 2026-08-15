/**
 * 지시문 64 (TASK C) — 자연어 컨셉 표본 50개(data/conceptCoverageSamples.ts)를
 * 실제 로컬 매칭 경로(core/conceptAgent.ts의 matchConceptRules/
 * recommendConceptLocal — Step2Concept.tsx의 "컨셉 에이전트"가 실제로
 * 호출하는 것과 같은 함수)에 넣어 세 축을 잰다.
 *
 *   ① 매칭률       — 키워드가 하나라도 매칭되는 비율
 *   ② 워크스페이스 적합 — 매칭된 장르가 그 워크스페이스 코어 티어에 속하는가
 *   ③ 계절 오배정   — 계절 관련 신호가 전혀 없는데 seasonPacks[0](구 하드코딩
 *                    기본값 'new-year')로 떨어지는가. TASK B-3가 고친 실제
 *                    원인(§conceptAgent.ts의 calendarSeasonFallback) 회귀를
 *                    이 스크립트가 계속 감시한다.
 *
 * §하지 말 것 "새 검사로 세트를 차단하지 말 것" — advisory. 매칭률 90%
 * 미만이면 경고만 내고 항상 exit 0.
 *
 * Usage: npx tsx scripts/checkConceptCoverage.ts [--json]
 */
import { matchConceptRules } from '../src/data/conceptKeywords';
import { CONCEPT_COVERAGE_SAMPLES } from '../src/data/conceptCoverageSamples';
import { recommendConceptLocal } from '../src/core/conceptAgent';
import { getCoreGenreIdsForArchetype } from '../src/data/genreLibrary';

const WARN_THRESHOLD = 0.9;
// TASK H2/지시문64 TASK B-3의 옛 하드코딩 폴백 — 이 값으로 떨어지면서
// 계절 신호가 전혀 없었다면 "엉뚱한 계절 배정"으로 센다.
const LEGACY_FALLBACK_SEASON_ID = 'new-year';

interface SampleResult {
  text: string;
  archetype: string;
  matchedRuleIds: string[];
  matchedAnyRule: boolean;
  matchedWorkspaceGenre: boolean;
  seasonId: string;
  seasonSignalPresent: boolean;
  seasonMisassigned: boolean;
}

function evaluateSample(sample: (typeof CONCEPT_COVERAGE_SAMPLES)[number]): SampleResult {
  const matched = matchConceptRules(sample.text);
  const coreGenreIds = getCoreGenreIdsForArchetype(sample.archetype);
  const coreGenreIdSet = new Set(coreGenreIds);
  const matchedWorkspaceGenre = matched.some(rule =>
    Object.keys(rule.genreWeights || {}).some(id => coreGenreIdSet.has(id))
  );
  const seasonSignalPresent = matched.some(rule => Object.keys(rule.seasonWeights || {}).length > 0);
  const result = recommendConceptLocal(sample.text, sample.archetype);
  const seasonId = result.recommendations[0]?.seasonId ?? '(없음)';
  const seasonMisassigned = !seasonSignalPresent && seasonId === LEGACY_FALLBACK_SEASON_ID;
  return {
    text: sample.text,
    archetype: sample.archetype,
    matchedRuleIds: matched.map(rule => rule.id),
    matchedAnyRule: matched.length > 0,
    matchedWorkspaceGenre,
    seasonId,
    seasonSignalPresent,
    seasonMisassigned
  };
}

function main() {
  const jsonMode = process.argv.includes('--json');
  const results = CONCEPT_COVERAGE_SAMPLES.map(evaluateSample);

  if (jsonMode) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log('[check:concept-coverage] 지시문 64 TASK C\n');
  console.log(`표본 ${results.length}개\n`);

  let matchedCount = 0;
  let workspaceGenreCount = 0;
  let seasonMisassignedCount = 0;
  for (const r of results) {
    if (r.matchedAnyRule) matchedCount += 1;
    if (r.matchedWorkspaceGenre) workspaceGenreCount += 1;
    if (r.seasonMisassigned) seasonMisassignedCount += 1;
    const flags = [
      r.matchedAnyRule ? '' : '⚠ 미매칭',
      r.matchedAnyRule && !r.matchedWorkspaceGenre ? '⚠ 워크스페이스 장르 없음' : '',
      r.seasonMisassigned ? `⚠ 계절 오배정(${r.seasonId})` : ''
    ].filter(Boolean).join(' · ');
    console.log(`[${r.archetype}] "${r.text}"`);
    console.log(`  매칭: ${r.matchedRuleIds.join(', ') || '(없음)'} · 계절: ${r.seasonId}${flags ? '  ' + flags : ''}`);
  }

  const matchRate = results.length ? matchedCount / results.length : 0;
  const workspaceRate = results.length ? workspaceGenreCount / results.length : 0;

  console.log('\n--- 요약 ---');
  console.log(`① 매칭률: ${matchedCount}/${results.length} (${Math.round(matchRate * 100)}%)`);
  console.log(`② 워크스페이스 적합 장르 매칭: ${workspaceGenreCount}/${results.length} (${Math.round(workspaceRate * 100)}%)`);
  console.log(`③ 계절 오배정: ${seasonMisassignedCount}건`);

  if (matchRate < WARN_THRESHOLD) {
    console.log(`\n⚠ 매칭률이 ${Math.round(WARN_THRESHOLD * 100)}% 미만입니다 — 키워드 확장이 더 필요합니다.`);
  }

  console.log('\n[check:concept-coverage] advisory — exit 0.');
}

main();
