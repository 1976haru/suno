/**
 * 지시문 69 (TASK E) — conceptKeywords.ts 상단 doc comment가 "Every pattern
 * list covers Korean, English, and Japanese synonyms"라고 단언했지만 아무도
 * 세어본 적이 없었다. 실측 결과 axis:'genre' 규칙 17개 중 일본어 패턴
 * 보유는 0개(0%)였다 — 지시문 68의 seedForBlueprint 주석과 같은 실패
 * 유형("측정 없이 작성된 주석이 잘못된 근거가 됐다")의 재발을 막는다.
 *
 * CONCEPT_KEYWORD_RULES와 SITUATION_FRAME_RULES를 순회하며 각 규칙이
 * 한국어/영어/일본어 패턴을 갖고 있는지 센다. axis:'genre' 규칙은 따로
 * 집계한다(이번에 0%였던 지점).
 *
 * §하지 말 것 "새 검사로 세트를 차단하지 말 것" — advisory. 항상 exit 0.
 *
 * Usage: npx tsx scripts/checkConceptLanguageCoverage.ts [--json]
 */
import { CONCEPT_KEYWORD_RULES, type KeywordRule } from '../src/data/conceptKeywords';
import { SITUATION_FRAME_RULES, type SituationFrameRule } from '../src/data/lyricThemes';

const KOREAN_RANGE = /[가-힣]/;
const JAPANESE_RANGE = /[぀-ヿ一-鿿]/;
// 3자 이상 연속된 라틴 문자만 "영어 패턴"으로 센다 — \b, \s*, i 플래그 같은
// regex 문법 조각(1~2자)을 영어 커버리지로 오인하지 않기 위해서다.
const ENGLISH_RUN = /[a-zA-Z]{3,}/;

interface RuleLanguageCoverage {
  id: string;
  hasKorean: boolean;
  hasEnglish: boolean;
  hasJapanese: boolean;
  isGenreAxis: boolean;
}

function sourceOf(patterns: RegExp[]): string {
  return patterns.map(p => p.source).join(' ');
}

function coverageFor(id: string, patterns: RegExp[], isGenreAxis: boolean): RuleLanguageCoverage {
  const combined = sourceOf(patterns);
  return {
    id,
    hasKorean: KOREAN_RANGE.test(combined),
    hasEnglish: ENGLISH_RUN.test(combined),
    hasJapanese: JAPANESE_RANGE.test(combined),
    isGenreAxis
  };
}

function summarize(label: string, rows: RuleLanguageCoverage[]): void {
  const total = rows.length;
  const ko = rows.filter(r => r.hasKorean).length;
  const en = rows.filter(r => r.hasEnglish).length;
  const ja = rows.filter(r => r.hasJapanese).length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  console.log(`\n${label} — 총 ${total}개`);
  console.log(`  한국어 패턴 보유 : ${ko}개 (${pct(ko)}%)`);
  console.log(`  영어  패턴 보유 : ${en}개 (${pct(en)}%)`);
  console.log(`  일본어 패턴 보유 : ${ja}개 (${pct(ja)}%)`);
  if (ja === 0 && total > 0) {
    console.log(`  ⚠ 일본어 패턴이 전혀 없습니다.`);
  }
}

function main() {
  const jsonMode = process.argv.includes('--json');

  const conceptRows = (CONCEPT_KEYWORD_RULES as KeywordRule[]).map(rule =>
    coverageFor(rule.id, rule.patterns, rule.axis === 'genre')
  );
  const genreAxisRows = conceptRows.filter(r => r.isGenreAxis);

  const frameRows = (SITUATION_FRAME_RULES as SituationFrameRule[]).map(rule =>
    coverageFor(rule.frameId, [rule.pattern], false)
  );

  if (jsonMode) {
    console.log(JSON.stringify({ conceptRows, genreAxisRows, frameRows }, null, 2));
    return;
  }

  console.log('[check:concept-language] 지시문 69 TASK E');

  summarize('CONCEPT_KEYWORD_RULES 전체', conceptRows);
  summarize("CONCEPT_KEYWORD_RULES 중 axis:'genre'", genreAxisRows);
  summarize('SITUATION_FRAME_RULES', frameRows);

  const jaZero = conceptRows.filter(r => !r.hasJapanese).map(r => r.id);
  if (jaZero.length > 0) {
    console.log(`\n일본어 패턴 없는 규칙 id (${jaZero.length}개):`);
    console.log(`  ${jaZero.join(', ')}`);
  }

  console.log('\n[check:concept-language] advisory — exit 0.');
}

main();
