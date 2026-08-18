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
import { hasVocalTechniqueWord } from '../src/data/vocalTechniqueByGenre';

function main() {
  console.log('[check:vocal-technique] 지시문 65 TASK D\n');

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

  console.log(`\n[check:vocal-technique] advisory — 통과 처리(exit 0).`);
}

main();
