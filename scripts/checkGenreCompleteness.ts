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
 * 지시문 61 (TASK D-1) — 하루의 세 지적(①장르다움 부족 ②시니어다움 부족
 * ③킬링포인트 부족) 중 ①②를 이 스크립트가 수치로 잡는다. §1-3 실측: 채널이
 * 쓰는 137종 중 107종이 rhythm/production/vocal/harmony 각 1개뿐이었다 —
 * 기존 5축 검사(vocalPreference/instruments/rhythm/production/eraNoteKo)는
 * "있다/없다"만 봐서 "1개뿐이라 빈약하다"를 못 잡았다. 이 사이클은 그 축
 * 4개(rhythm/production/vocal/harmony)를 각각 최대 3점으로 점수화하고
 * (총 12점), "채널이 쓰는 장르"(archetypes 필드가 하나라도 있는 장르)만
 * 걸러 8점 미만을 목록으로 낸다 — 기존 5축 검사는 그대로 유지하고(§규약5
 * "낡은 경로를 남긴 채 새 경로를 추가하지 않는다" 위반 방지 — 이 축은 아직
 * 유효한 다른 결함을 잡는다), 새 12점 검사를 추가한다.
 *
 * §하지 말 것 "새 검사로 세트를 차단하지 말 것 — 목록만 낸다": 이 스크립트는
 * exit 0으로 항상 통과한다. blocking이 아니라 advisory 목록 출력이 전부다
 * — 107종을 한 번에 채우라는 뜻이 아니라, 우선순위를 하루가 정할 수
 * 있게 현재 상태를 보여주는 것이 목적이다(§공통 규약 7 "실측 없이 blocking을
 * 만들지 않는다" — 어느 필드가 "필수"인지조차 아직 실측된 정책이 없다).
 *
 * 검사 축 (기존 5개, 지시문50 §D-3② 그대로):
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
 * 신규 축 (지시문 61 TASK D-1, 12점 스코어):
 *   rhythm/production/vocal/harmony 각 min(개수, 3)점 — 장르를 그 장르로
 *   만드는 서술이 몇 갈래인지를 잰다. instruments는 §하지 말 것 "instruments를
 *   건드리지 말 것 — 이미 367종 전부 3개 이상이다"에 따라 점수 축에서
 *   제외한다(이미 포화 상태라 변별력이 없다).
 *
 * Usage: npx tsx scripts/checkGenreCompleteness.ts [--category=jazz] [--json]
 */
import { genreLibrary } from '../src/data/genreLibrary';
import { channelPresets } from '../src/data/presets';
import type { GenrePack } from '../src/types';
import type { EraBucket } from '../src/data/eraBuckets';

/**
 * 지시문 61 (TASK D-1) — "채널이 쓰는 장르"는 §A-1/§B-3이 실측한 137종과
 * 같은 정의라야 한다: 실제 채널 프리셋(data/presets.ts)의 preferredGenres에
 * 등장하는 장르의 합집합. 처음 구현은 GenrePack.archetypes(어떤 아키타입
 * "카테고리"에 속하는지 태그)를 대신 썼는데, 이건 357/367종에 다 붙어있어
 * 변별력이 없었다(실측 후 발견 — 이 doc comment가 그 정정 기록) — archetypes는
 * "이 장르가 속한 카테고리"이지 "실제로 어느 채널이 골라 쓰는가"가 아니다.
 */
const CHANNEL_USED_GENRE_IDS: ReadonlySet<string> = new Set(
  channelPresets.flatMap(channel => channel.preferredGenres ?? [])
);

type CompletenessGenre = GenrePack & { eraBuckets?: EraBucket[]; eraNoteKo?: string };

/** 지시문 61 (TASK D-1) — 하나의 서술 축에 대한 점수. 실측 임계값(정책 필드) — 규약6. */
const AXIS_SCORE_CAP = 3;
/** 채널 사용 장르의 "보강 대상" 판정선 — §완료 판정 표 "8점 미만"을 그대로 상수화. */
const CHANNEL_GENRE_SCORE_THRESHOLD = 8;
const MAX_SCORE = AXIS_SCORE_CAP * 4;

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
  // 지시문 61 (TASK D-1) — 4축 서술 스코어.
  isChannelUsed: boolean;
  rhythmCount: number;
  productionCount: number;
  vocalCount: number;
  harmonyCount: number;
  score: number;
}

function axisScore(count: number): number {
  return Math.min(count, AXIS_SCORE_CAP);
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

  const rhythmCount = genre.rhythm?.length ?? 0;
  const productionCount = genre.production?.length ?? 0;
  const vocalCount = genre.vocal?.length ?? 0;
  const harmonyCount = genre.harmony?.length ?? 0;
  const score = axisScore(rhythmCount) + axisScore(productionCount) + axisScore(vocalCount) + axisScore(harmonyCount);
  // 지시문 61 §완료 판정 "채널 사용 장르" — 실제 채널 프리셋의
  // preferredGenres 합집합에 속하는가(파일 상단 CHANNEL_USED_GENRE_IDS
  // doc comment 참고).
  const isChannelUsed = CHANNEL_USED_GENRE_IDS.has(genre.id);

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
    missing,
    isChannelUsed,
    rhythmCount,
    productionCount,
    vocalCount,
    harmonyCount,
    score
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

  // 지시문 61 (TASK D-1) — 12점 스코어 섹션. 채널이 쓰는 장르만 걸러
  // 8점 미만을 우선순위 목록으로 낸다.
  const channelRows = rows.filter(r => r.isChannelUsed);
  const belowThreshold = channelRows
    .filter(r => r.score < CHANNEL_GENRE_SCORE_THRESHOLD)
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));

  console.log('\n' + '═'.repeat(60));
  console.log(`[지시문 61 TASK D-1] 채널 사용 장르 서술 점수 (rhythm/production/vocal/harmony 각 최대 ${AXIS_SCORE_CAP}점, ${MAX_SCORE}점 만점)`);
  console.log(`채널 사용 장르 ${channelRows.length}종 중 ${CHANNEL_GENRE_SCORE_THRESHOLD}점 미만 ${belowThreshold.length}종\n`);
  if (belowThreshold.length) {
    console.log(`  ${'id'.padEnd(38)} 점수  rhy pro voc har`);
    for (const row of belowThreshold) {
      console.log(`  ${row.id.padEnd(38)} ${String(row.score).padStart(2)}점   ${row.rhythmCount}   ${row.productionCount}   ${row.vocalCount}   ${row.harmonyCount}`);
    }
  }
  const scoreDistribution = new Map<number, number>();
  for (const row of channelRows) {
    scoreDistribution.set(row.score, (scoreDistribution.get(row.score) ?? 0) + 1);
  }
  console.log('\n점수 분포 (채널 사용 장르 전체):');
  for (let score = 0; score <= MAX_SCORE; score++) {
    const count = scoreDistribution.get(score) ?? 0;
    if (count) console.log(`  ${String(score).padStart(2)}점  ${count}종`);
  }

  // 지시문 50 (§하지 말 것) — "새 검사로 세트를 차단하지 말 것 — 목록만
  // 낸다". exit 0 항상 — 이 스크립트는 advisory다.
  console.log('\n[check:genre-completeness] advisory — 통과 처리(exit 0). 우선순위는 하루가 정한다.');
}

main();
