/**
 * 지시문 50 (TASK D-4) — check:reachability/check:consumption과 같은
 * "만들었는데 배선이 없다" 회귀 방지선 계열이지만, 저 둘은 모듈/정책
 * 단위다. 이번 사이클(재즈 53종 중 vocalPreference 8종·eraBuckets 7종만
 * 채워진 것)이 보여준 것은 그 아래 단위 — "장르 하나가 필드까지 다
 * 채워졌는가" — 는 아무도 검사하지 않는다는 것이다(check:coverage는
 * 아키타입 단위, 장르 단위가 아니다). 하루가 어떤 장르를 "별로다"라고
 * 할 때마다 그 원인이 매번 같은 모양(eraBuckets/vocalPreference/genreText
 * 미비)으로 반복되지 않도록, genreLibrary 전수를 훑어 미달 목록을 낸다.
 *
 * §하지 말 것 "새 검사로 세트를 차단하지 말 것 — 목록만 낸다": 이 스크립트는
 * exit 0으로 항상 통과한다. blocking이 아니라 advisory 목록 출력이 전부다
 * — 재즈 45종을 한 번에 채우라는 뜻이 아니라, 우선순위를 하루가 정할 수
 * 있게 현재 상태를 보여주는 것이 목적이다(§규약 7 "실측 없이 blocking을
 * 만들지 않는다" — 어느 필드가 "필수"인지조차 아직 실측된 정책이 없다).
 *
 * 검사 축 6개 (지시문50 §D-3② 그대로):
 *   eraBuckets       — 존재는 항상 함(폴백 ['era-neutral']) — 여기서는
 *                      "era-neutral뿐인가"만 참고 정보로 표시, 미달로
 *                      세지 않는다(재즈 다수처럼 진짜로 era-neutral인
 *                      장르가 많다 — §eraBuckets.ts 자기 doc comment).
 *   vocalPreference  — 없으면 미달
 *   instruments      — 필수 필드(빈 배열도 유효 타입)이나, 빈 배열은
 *                      "채워지지 않음"으로 취급
 *   rhythm           — 없거나 빈 배열이면 미달
 *   production       — 없거나 빈 배열이면 미달
 *   eraNoteKo        — 없으면 미달 (단, eraBuckets가 era-neutral일 때는
 *                      "왜 era-neutral인지" 설명이 있어야 완전하다고 보므로
 *                      더 중요하다 — 실측: 이미 거의 모든 장르가 채워져
 *                      있다, eraBuckets.ts가 지시문12에서 전수 부여했다)
 *
 * Usage: npx tsx scripts/checkGenreCompleteness.ts [--category=jazz] [--json]
 */
import { genreLibrary } from '../src/data/genreLibrary';
import type { GenrePack } from '../src/types';
import type { EraBucket } from '../src/data/eraBuckets';

type CompletenessGenre = GenrePack & { eraBuckets?: EraBucket[]; eraNoteKo?: string };

interface GenreCompletenessRow {
  id: string;
  label: string;
  categoryId?: string;
  hasVocalPreference: boolean;
  hasInstruments: boolean;
  hasRhythm: boolean;
  hasProduction: boolean;
  hasEraNoteKo: boolean;
  isEraNeutralOnly: boolean;
  missingCount: number;
  missing: string[];
}

function evaluate(genre: CompletenessGenre): GenreCompletenessRow {
  const eraBuckets = genre.eraBuckets ?? ['era-neutral'];
  const isEraNeutralOnly = eraBuckets.length === 1 && eraBuckets[0] === 'era-neutral';
  const hasVocalPreference = Boolean(genre.vocalPreference);
  const hasInstruments = Boolean(genre.instruments?.length);
  const hasRhythm = Boolean(genre.rhythm?.length);
  const hasProduction = Boolean(genre.production?.length);
  const hasEraNoteKo = Boolean(genre.eraNoteKo);
  const missing: string[] = [];
  // 지시문 50 (TASK D-4) — instruments는 GenrePack 필수 필드라 실무상 거의
  // 항상 채워져 있다(빈 배열인 장르가 있다면 그것도 실제 결함이다). rhythm/
  // production은 legacy-preset 계열에만 있고 notion-analysis 파생 장르는
  // 원래 없는 경우가 많다 — "미달"로 세되, blocking 판단은 이 스크립트
  // 밖(하루)의 몫이다.
  if (!hasVocalPreference) missing.push('vocalPreference');
  if (!hasInstruments) missing.push('instruments');
  if (!hasRhythm) missing.push('rhythm');
  if (!hasProduction) missing.push('production');
  if (!hasEraNoteKo) missing.push('eraNoteKo');
  return {
    id: genre.id,
    label: genre.label,
    categoryId: genre.categoryId,
    hasVocalPreference,
    hasInstruments,
    hasRhythm,
    hasProduction,
    hasEraNoteKo,
    isEraNeutralOnly,
    missingCount: missing.length,
    missing
  };
}

function main() {
  const args = process.argv.slice(2);
  const categoryArg = args.find(a => a.startsWith('--category='))?.split('=')[1];
  const jsonMode = args.includes('--json');

  const targetGenres = categoryArg
    ? genreLibrary.filter(g => g.categoryId === categoryArg || g.id.startsWith(`${categoryArg}-`))
    : genreLibrary;

  const rows = (targetGenres as CompletenessGenre[]).map(evaluate);
  const byCategory = new Map<string, GenreCompletenessRow[]>();
  for (const row of rows) {
    const key = row.categoryId ?? '(no categoryId)';
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(row);
  }

  if (jsonMode) {
    console.log(JSON.stringify({ total: rows.length, rows }, null, 2));
    return;
  }

  console.log(`[check:genre-completeness] ${categoryArg ? `카테고리 "${categoryArg}"` : '전체'} ${rows.length}종 검사\n`);

  const sortedCategories = [...byCategory.entries()].sort((a, b) => b[1].length - a[1].length);
  let totalMissing = 0;
  for (const [category, categoryRows] of sortedCategories) {
    const withGaps = categoryRows.filter(r => r.missingCount > 0);
    if (!withGaps.length) continue;
    totalMissing += withGaps.length;
    console.log(`── ${category} (${categoryRows.length}종 중 ${withGaps.length}종 미달) ──`);
    for (const row of withGaps) {
      const eraNote = row.isEraNeutralOnly ? ' [era-neutral]' : '';
      console.log(`  ${row.id.padEnd(38)} 미달: ${row.missing.join(', ')}${eraNote}`);
    }
    console.log('');
  }

  const complete = rows.length - totalMissing;
  console.log('─'.repeat(60));
  console.log(`완결 ${complete}/${rows.length}  미달 ${totalMissing}/${rows.length}`);

  // 축별 요약
  const axisSummary = [
    ['vocalPreference', rows.filter(r => !r.hasVocalPreference).length],
    ['instruments', rows.filter(r => !r.hasInstruments).length],
    ['rhythm', rows.filter(r => !r.hasRhythm).length],
    ['production', rows.filter(r => !r.hasProduction).length],
    ['eraNoteKo', rows.filter(r => !r.hasEraNoteKo).length]
  ] as const;
  console.log('\n축별 미달 (참고용):');
  for (const [axis, count] of axisSummary) {
    console.log(`  ${axis.padEnd(18)} ${count}/${rows.length}`);
  }

  // 지시문 50 (§하지 말 것) — "새 검사로 세트를 차단하지 말 것 — 목록만
  // 낸다". exit 0 항상 — 이 스크립트는 advisory다.
  console.log('\n[check:genre-completeness] advisory — 통과 처리(exit 0). 우선순위는 하루가 정한다.');
}

main();
