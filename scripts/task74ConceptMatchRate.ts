/**
 * 지시문 74 — 회귀 확인용. 컨셉500 4종 파일의 각 항목을
 * data/conceptKeywords.ts의 matchConceptRules에 넣어 매칭률을 잰다.
 *
 * 이 지시문이 요구하는 "컨셉 500선 4종 매칭률 유지"를 브랜치/기준선 양쪽에서
 * 같은 방법으로 재기 위한 스크립트다. 절대값 자체보다 두 실행의 차이가
 * 의미를 갖는다.
 *
 * Usage: npx tsx scripts/task74ConceptMatchRate.ts
 */
import * as fs from 'node:fs';
import { matchConceptRules } from '../src/data/conceptKeywords';

const FILES = [
  '컨셉500_시니어올드팝.md',
  '컨셉500_일본시니어.md',
  '컨셉500_2030케이팝.md',
  '컨셉500_동요.md'
];

/** "12.   컨셉 텍스트   [태그][태그]" 형태의 항목 줄만 추출한다. */
function conceptsFrom(path: string): string[] {
  const lines = fs.readFileSync(path, 'utf-8').split('\n');
  const out: string[] = [];
  for (const raw of lines) {
    const m = raw.match(/^\s*\d+\.\s+(.+?)\s*(\[[^\]]+\]\s*)*$/);
    if (!m) continue;
    const text = m[1].replace(/\s*\[[^\]]+\]\s*/g, ' ').trim();
    if (text) out.push(text);
  }
  return out;
}

let totalAll = 0;
let matchedAll = 0;
for (const file of FILES) {
  if (!fs.existsSync(file)) {
    console.log(`${file}: (파일 없음)`);
    continue;
  }
  const concepts = conceptsFrom(file);
  const matched = concepts.filter(concept => matchConceptRules(concept).length > 0).length;
  totalAll += concepts.length;
  matchedAll += matched;
  const rate = concepts.length ? (matched / concepts.length) * 100 : 0;
  console.log(`${file.padEnd(26)} ${matched}/${concepts.length} = ${rate.toFixed(1)}%`);
}
console.log(`${'합계'.padEnd(24)} ${matchedAll}/${totalAll} = ${totalAll ? ((matchedAll / totalAll) * 100).toFixed(1) : '0.0'}%`);
