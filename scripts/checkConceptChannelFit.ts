/**
 * 지시문 79 (TASK A-2) — "컨셉 × 채널 부적합" 전수 검사.
 *
 * 실측 배경: `showa-seventies` × "60년대 올드팝"은 그 채널 코어 장르 4종이
 * 전부 1970s라 1950s-60s 후보가 0종이다. 예전에는 이 사실이 어디에도
 * 표시되지 않은 채 core/constraints.ts의 applyEraQuota가 장르 구성을
 * 1종으로 붕괴시켰다(실측 15/15, 2차 감사 §2 항목 2). TASK A-1이 붕괴를
 * 막고 TASK A-2가 경고를 만들었으니, 이 스크립트는 **그 경고가 실제로
 * 몇 개의 조합에서 나오는지**를 전수로 세어 다음 지시문의 장르 확충
 * 판단 근거를 남긴다.
 *
 * 판정 함수는 앱이 실제로 쓰는 core/conceptChannelFit.ts의
 * evaluateConceptChannelFit **하나뿐**이다 — 검사와 런타임이 서로 다른
 * 기준을 들고 드리프트하지 않게 한다(지시문 63 TASK C가
 * dominantVocalTypeForGenre로 세운 것과 같은 원칙).
 *
 * 표본은 컨셉 500선 4종 파일 전체다. 파일 파싱은 scripts/task74ConceptMatchRate.ts가
 * 이미 쓰는 것과 같은 정규식을 재사용한다(같은 항목 집합을 봐야 두 검사의
 * 숫자를 나란히 읽을 수 있다).
 *
 * §"새 검사로 생성을 차단하지 말 것" — advisory. 항상 exit 0.
 *
 * Usage: npx tsx scripts/checkConceptChannelFit.ts (또는 npm run check:concept-channel-fit)
 */
import * as fs from 'node:fs';
import { channelPresets } from '../src/data/presets';
import { workspaceDefinitions } from '../src/data/workspaces';
import { evaluateConceptChannelFit } from '../src/core/conceptChannelFit';
import type { ChannelArchetype } from '../src/types';

/**
 * 각 컨셉 파일이 실제로 겨냥한 아키타입. 파일 머리말의 "대상 워크스페이스"
 * 표기(`senior-showa` / `kpop-2030` / `kids-songs`)는 실제 WorkspaceId와
 * 다른 옛 이름이라 그대로 쓸 수 없다 — 내용 기준으로 아키타입을 직접
 * 적는다. 전체 교차표(모든 아키타입 × 모든 컨셉)는 그대로 내되, 실제로
 * 조치가 필요한 것은 이 "본래 대상" 대각선뿐이다: 동요 컨셉을 아이돌
 * 채널에 넣었을 때 안 맞는 것은 결함이 아니라 당연한 결과다.
 */
const FILES: Array<{ file: string; intendedArchetypes: ChannelArchetype[] }> = [
  { file: '컨셉500_시니어올드팝.md', intendedArchetypes: ['senior-morning', 'oldpop-lounge'] },
  { file: '컨셉500_일본시니어.md', intendedArchetypes: ['showa-cafe', 'showa-70s', 'j2000s'] },
  { file: '컨셉500_2030케이팝.md', intendedArchetypes: ['kr-2030-pop', 'kr-idol-male', 'kr-idol-female'] },
  { file: '컨셉500_동요.md', intendedArchetypes: ['kr-kids-song', 'jp-kids-song'] }
];

/** scripts/task74ConceptMatchRate.ts와 동일한 항목 추출 규칙. */
function conceptsFrom(path: string): string[] {
  if (!fs.existsSync(path)) return [];
  const out: string[] = [];
  for (const raw of fs.readFileSync(path, 'utf-8').split('\n')) {
    const m = raw.match(/^\s*\d+\.\s+(.+?)\s*(\[[^\]]+\]\s*)*$/);
    if (!m) continue;
    const text = m[1].replace(/\s*\[[^\]]+\]\s*/g, ' ').trim();
    if (text) out.push(text);
  }
  return out;
}

interface Row {
  archetype: ChannelArchetype;
  total: number;
  eraMismatch: number;
  genreMismatch: number;
  /** 시대 축 어긋남을 만든 시대별 건수 */
  eraByBucket: Map<string, number>;
}

function main() {
  console.log('[check:concept-channel-fit] 지시문 79 TASK A-2 — 컨셉 500선 4종 × 전 워크스페이스\n');

  const samples = FILES.map(entry => ({ ...entry, concepts: conceptsFrom(entry.file) }));
  const totalConcepts = samples.reduce((sum, s) => sum + s.concepts.length, 0);
  for (const { file, concepts, intendedArchetypes } of samples) {
    console.log(`  ${file.padEnd(26)} ${String(concepts.length).padStart(4)}개  본래 대상: ${intendedArchetypes.join(', ')}${concepts.length ? '' : '  (파일 없음 — 건너뜀)'}`);
  }
  console.log(`  ${'합계'.padEnd(24)} ${totalConcepts}개\n`);
  if (!totalConcepts) {
    console.log('컨셉 표본을 찾지 못해 검사할 것이 없습니다.');
    return;
  }

  // 아키타입 단위로 판정한다 — evaluateConceptChannelFit의 판정 축(코어 티어 ·
  // isGenreEligibleForArchetype)이 전부 아키타입 스코프이기 때문이다. 채널
  // 34개를 따로 돌면 같은 아키타입끼리 결과가 완전히 같아 출력만 4배가 된다.
  const archetypes = [...new Set(channelPresets.map(c => c.archetype))];
  const workspaceOf = new Map<ChannelArchetype, string>();
  for (const ws of workspaceDefinitions) {
    for (const a of ws.archetypeIds) if (!workspaceOf.has(a)) workspaceOf.set(a, ws.id);
  }

  const rows: Row[] = [];
  for (const archetype of archetypes) {
    const row: Row = { archetype, total: 0, eraMismatch: 0, genreMismatch: 0, eraByBucket: new Map() };
    for (const { concepts } of samples) {
      for (const concept of concepts) {
        row.total += 1;
        const fit = evaluateConceptChannelFit(concept, archetype);
        if (fit.eraPrimary && fit.eraCandidateCount === 0) {
          row.eraMismatch += 1;
          row.eraByBucket.set(fit.eraPrimary, (row.eraByBucket.get(fit.eraPrimary) ?? 0) + 1);
        }
        if (fit.pointedGenreIds.length > 0 && fit.coreIntersection.length === 0) row.genreMismatch += 1;
      }
    }
    rows.push(row);
  }

  console.log('① 시대 축 — 컨셉이 명시한 연대의 장르가 이 아키타입에 0종');
  console.log(`  ${'archetype'.padEnd(17)}${'workspace'.padEnd(16)}${'건수'.padStart(7)}   ${'비율'.padStart(6)}   시대별 내역`);
  for (const row of [...rows].sort((a, b) => b.eraMismatch - a.eraMismatch)) {
    const detail = [...row.eraByBucket.entries()].sort((a, b) => b[1] - a[1]).map(([b, n]) => `${b}×${n}`).join(', ');
    console.log(`  ${row.archetype.padEnd(17)}${(workspaceOf.get(row.archetype) ?? '-').padEnd(16)}${String(row.eraMismatch).padStart(7)}   ${((row.eraMismatch / row.total) * 100).toFixed(1).padStart(5)}%   ${detail || '-'}`);
  }

  console.log('\n② 장르 축 — 컨셉이 지목한 장르가 이 아키타입 코어 티어에 0종 (지목이 있었던 컨셉만)');
  console.log(`  ${'archetype'.padEnd(17)}${'workspace'.padEnd(16)}${'건수'.padStart(7)}   ${'비율'.padStart(6)}`);
  for (const row of [...rows].sort((a, b) => b.genreMismatch - a.genreMismatch)) {
    console.log(`  ${row.archetype.padEnd(17)}${(workspaceOf.get(row.archetype) ?? '-').padEnd(16)}${String(row.genreMismatch).padStart(7)}   ${((row.genreMismatch / row.total) * 100).toFixed(1).padStart(5)}%`);
  }

  // 본래 대상 대각선 — 실제로 조치가 필요한 유일한 구간.
  console.log('\n③ 본래 대상 대각선 — 그 컨셉 파일이 겨냥한 아키타입에서만 잰 어긋남 (조치 대상)');
  console.log(`  ${'컨셉 파일'.padEnd(24)}${'archetype'.padEnd(17)}${'시대축'.padStart(7)}${'장르축'.padStart(8)}   ${'표본'.padStart(5)}`);
  let diagEra = 0;
  let diagGenre = 0;
  let diagPairs = 0;
  for (const { file, concepts, intendedArchetypes } of samples) {
    for (const archetype of intendedArchetypes) {
      let era = 0;
      let genre = 0;
      for (const concept of concepts) {
        const fit = evaluateConceptChannelFit(concept, archetype);
        if (fit.eraPrimary && fit.eraCandidateCount === 0) era += 1;
        if (fit.pointedGenreIds.length > 0 && fit.coreIntersection.length === 0) genre += 1;
      }
      diagEra += era;
      diagGenre += genre;
      diagPairs += concepts.length;
      console.log(`  ${file.padEnd(24)}${archetype.padEnd(17)}${String(era).padStart(7)}${String(genre).padStart(8)}   ${String(concepts.length).padStart(5)}`);
    }
  }
  console.log(`  ${'합계'.padEnd(41)}${String(diagEra).padStart(7)}${String(diagGenre).padStart(8)}   ${String(diagPairs).padStart(5)}`);

  const eraTotal = rows.reduce((sum, r) => sum + r.eraMismatch, 0);
  const genreTotal = rows.reduce((sum, r) => sum + r.genreMismatch, 0);
  const pairs = rows.reduce((sum, r) => sum + r.total, 0);
  console.log(`\n총 ${pairs}쌍 (아키타입 ${rows.length} × 컨셉 ${totalConcepts}) — 시대 축 어긋남 ${eraTotal}건, 장르 축 어긋남 ${genreTotal}건`);
  console.log('\n[check:concept-channel-fit] advisory — 통과 처리(exit 0). 어긋남은 결함이 아니라 "이 채널로는 그 컨셉을 표현할 수 없다"는 사실이며, 앱은 경고를 남기고 사용자가 고른 장르 구성을 그대로 쓴다.');
}

main();
