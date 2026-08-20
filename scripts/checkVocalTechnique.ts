/**
 * 지시문 65 (TASK D) — "전 장르 367종의 vocal 필드에 창법 어휘가
 * 있는가"를 실제로 검사한다. check:vocal-floor/check:vocal-genre-fit과
 * 같은 advisory 원칙(exit 0, 목록만 낸다 — §공통규약 7 "실측 없이
 * blocking을 만들지 않는다").
 *
 * 검사 어휘는 지시문 65 §2-2가 나열한 27개 그대로 — genre.vocal의 각
 * 항목을 이 목록과 대조해 하나라도 걸리면 "창법 있음"으로 센다.
 *
 * 두 번째 축("같은 창법 어휘가 5종 넘게 반복 0건")은 vocal 배열에 실제로
 * 부착된 정확한 phrase 문자열(예: "gospel-run melisma on phrase ends")의
 * 중복 횟수를 센다 — 단어 하나(melisma)가 여러 다른 phrase에 걸쳐 등장하는
 * 것은 반복이 아니다(§data/vocalTechniqueByGenre.ts 자기 doc comment).
 *
 * Usage: npx tsx scripts/checkVocalTechnique.ts
 */
import { genreLibrary } from '../src/data/genreLibrary';
import { hasVocalTechniqueWord, vocalTechniquePoolForGenre } from '../src/data/vocalTechniqueByGenre';
import { vocalTechniquesForGenre } from '../src/data/vocalTechniqueFamilies';

// 지시문 66 (TASK D) — 4곡 이상 배정되면 반복이 시작된다(§1-1 실측)는
// 관찰에서 역산한 정책값. 장르 자체 창법(genrePool) + 계열 보충 창법
// (familyPool)의 합이 이 값 미만이면 그 장르가 4곡 이상 배정될 때 같은
// 창법이 반복될 위험이 있다고 본다. 실측 근거일 뿐 하드 임계값이 아니다
// (§공통규약 6 "추정 임계값은 정책 필드로 두고 주석에 명시한다").
const MIN_COMBINED_POOL_SIZE = 4;

function main() {
  console.log('[check:vocal-technique] 지시문 65 TASK D · 지시문 66 TASK D\n');

  const missing: string[] = [];
  const phraseUsage = new Map<string, string[]>();

  for (const genre of genreLibrary) {
    const techniqueEntries = genre.vocal.filter(hasVocalTechniqueWord);
    if (techniqueEntries.length === 0) {
      missing.push(genre.id);
    }
    for (const entry of techniqueEntries) {
      const key = entry.toLowerCase().trim();
      const list = phraseUsage.get(key) ?? [];
      list.push(genre.id);
      phraseUsage.set(key, list);
    }
  }

  console.log(`① 창법 어휘 없는 장르: ${missing.length}/${genreLibrary.length}`);
  if (missing.length) {
    console.log(`  ${missing.join(', ')}`);
  } else {
    console.log('  전 장르에 창법 어휘가 있다.');
  }

  const REPEAT_CAP = 4; // "5종 넘게 반복 0건" — 5종부터 위반.
  const overRepeated = [...phraseUsage.entries()].filter(([, ids]) => ids.length > REPEAT_CAP);
  console.log(`\n② 같은 창법 어휘가 ${REPEAT_CAP}종 넘게 반복: ${overRepeated.length}건`);
  for (const [phrase, ids] of overRepeated.sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  "${phrase}" — ${ids.length}종: ${ids.slice(0, 8).join(', ')}${ids.length > 8 ? ', ...' : ''}`);
  }

  // 지시문 66 (TASK D) — 계열 풀이 커버하지 못하는 장르: 13개 정규식 중
  // 어느 하나에도 걸리지 않는 genreId. 65의 genrePool만으로 살아가는
  // 장르이므로, 그 장르의 65 풀이 작으면(§ ④ 항목) 보충 없이 그대로 반복이
  // 생긴다.
  const unmatchedByFamily = genreLibrary.filter(genre => vocalTechniquesForGenre(genre.id).length === 0);
  console.log(`\n③ 계열 풀에 매칭되지 않는 장르: ${unmatchedByFamily.length}/${genreLibrary.length}`);
  if (unmatchedByFamily.length) {
    console.log(`  ${unmatchedByFamily.map(genre => genre.id).join(', ')}`);
  } else {
    console.log('  전 장르가 13개 계열 정규식 중 하나에 매칭된다.');
  }

  // 지시문 66 (TASK D) — 장르 창법(65 genrePool) + 계열 창법(66 familyPool,
  // 중복 제거) 합계가 MIN_COMBINED_POOL_SIZE 미만인 장르 — 4곡 이상
  // 배정되면 반복이 생길 수 있는 장르 목록(§1-1 그대로의 재현 조건).
  const thinPool = genreLibrary
    .map(genre => {
      const genrePool = vocalTechniquePoolForGenre(genre);
      const familyPool = vocalTechniquesForGenre(genre.id);
      const combined = new Set([...genrePool, ...familyPool]);
      return { id: genre.id, size: combined.size };
    })
    .filter(entry => entry.size < MIN_COMBINED_POOL_SIZE);
  console.log(`\n④ 장르+계열 창법 합계 ${MIN_COMBINED_POOL_SIZE}개 미만: ${thinPool.length}/${genreLibrary.length}`);
  if (thinPool.length) {
    console.log(`  ${thinPool.map(entry => `${entry.id}(${entry.size})`).join(', ')}`);
  } else {
    console.log(`  전 장르가 ${MIN_COMBINED_POOL_SIZE}개 이상의 합산 창법 풀을 가진다.`);
  }

  console.log(`\n[check:vocal-technique] advisory — 통과 처리(exit 0).`);
}

main();
