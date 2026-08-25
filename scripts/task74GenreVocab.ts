/** 지시문 74 — 각 장르의 instruments/rhythm 원문(=③ 검사가 부분 문자열로 찾는 값). */
import { getGenreById } from '../src/data/genreLibrary';

for (const id of process.argv.slice(2)) {
  const g = getGenreById(id);
  if (!g) { console.log(`${id}: NOT FOUND`); continue; }
  console.log(`### ${id}`);
  console.log(`  instruments: ${JSON.stringify(g.instruments)}`);
  console.log(`  rhythm: ${JSON.stringify((g as { rhythm?: string[] }).rhythm ?? [])}`);
}
