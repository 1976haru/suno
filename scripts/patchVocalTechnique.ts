/**
 * 지시문 65 (TASK C) — 하루의 요구: "이미 만들어놓은 가사에 창법만
 * 추가해서 JSON 파일 수정도 가능해?" 기존 팩(lyrics/*.json 형식 —
 * { meta, songs: [{ trackNo, genreId, stylePrompt, ... }] })의 각 곡
 * stylePrompt에, 그 곡의 genreId가 속한 장르의 창법 어휘(TASK A가 채운
 * genre.vocal — vocalTechniqueByGenre.ts의 family 풀)를 보컬 구절 바로
 * 뒤에 끼워 넣는다. 가사·제목·머니코드·악기는 건드리지 않는다. 원본을
 * 덮지 않고 새 파일로 저장한다(§C-4).
 *
 * 보컬 구절 위치는 core/promptElementOrder.ts의 vocalBlockStartClauseIndex
 * (지시문 59가 이미 검증한 콤마절 분류 로직 재사용 — 같은 판정 로직을
 * 두 곳에 두지 않는다, §공통규약)로 찾는다. 같은 장르 곡끼리는
 * rotatingVocalTechniqueForGenre로 서로 다른 phrase를 뽑는다(§C-2 "3 같은
 * 장르 곡끼리 다른 창법을 쓴다").
 *
 * Usage: npx tsx scripts/patchVocalTechnique.ts <팩경로> [--out <출력경로>]
 */
import { readFileSync, writeFileSync } from 'fs';
import { basename, dirname, extname, join } from 'path';
import { getGenreById } from '../src/data/genreLibrary';
import { hasVocalTechniqueWord, rotatingVocalTechniqueForGenre } from '../src/data/vocalTechniqueByGenre';
import { vocalBlockStartClauseIndex } from '../src/core/promptElementOrder';

const PROMPT_LENGTH_CAP = 900; // 지시문 65 F-1 정책값 — 초과하면 그 곡은 건너뛴다(§C-4).

interface PackSong {
  trackNo: number;
  genreId?: string;
  stylePrompt?: string;
  [key: string]: unknown;
}

interface Pack {
  meta?: Record<string, unknown>;
  songs: PackSong[];
}

function parseArgs(argv: string[]): { packPath: string; outPath?: string } {
  const packPath = argv[0];
  const outIdx = argv.indexOf('--out');
  const outPath = outIdx !== -1 ? argv[outIdx + 1] : undefined;
  if (!packPath) {
    console.error('Usage: npx tsx scripts/patchVocalTechnique.ts <팩경로> [--out <출력경로>]');
    process.exit(1);
  }
  return { packPath, outPath };
}

function defaultOutPath(packPath: string): string {
  const dir = dirname(packPath);
  const ext = extname(packPath);
  const base = basename(packPath, ext);
  return join(dir, `${base}.vocal-technique-patched${ext}`);
}

function insertTechniqueClause(stylePrompt: string, technique: string): string | null {
  const clauses = stylePrompt.split(',').map(c => c.trim()).filter(Boolean);
  const startIdx = vocalBlockStartClauseIndex(clauses);
  if (startIdx === null) return null;
  const patched = [...clauses.slice(0, startIdx + 1), technique, ...clauses.slice(startIdx + 1)];
  return patched.join(', ');
}

function main() {
  const { packPath, outPath } = parseArgs(process.argv.slice(2));
  const raw = readFileSync(packPath, 'utf8');
  const pack: Pack = JSON.parse(raw);

  const genreOccurrence = new Map<string, number>();
  let patchedCount = 0;
  let alreadyHasCount = 0;
  let overBudgetCount = 0;
  let noGenreCount = 0;
  let noVocalBlockCount = 0;
  const changeLog: { trackNo: number; title: unknown; before: string; after: string }[] = [];

  for (const song of pack.songs) {
    const stylePrompt = song.stylePrompt;
    if (typeof stylePrompt !== 'string' || !stylePrompt) continue;

    if (hasVocalTechniqueWord(stylePrompt)) {
      alreadyHasCount++;
      console.log(`  T${song.trackNo}: 이미 창법 어휘가 있음 — 건너뜀`);
      continue;
    }

    const genre = song.genreId ? getGenreById(song.genreId) : undefined;
    if (!genre) {
      noGenreCount++;
      console.log(`  T${song.trackNo}: genreId "${song.genreId ?? '(없음)'}" 를 찾을 수 없음 — 건너뜀`);
      continue;
    }

    const occurrence = genreOccurrence.get(genre.id) ?? 0;
    genreOccurrence.set(genre.id, occurrence + 1);
    const technique = rotatingVocalTechniqueForGenre(genre, occurrence * 53 + 1);

    const patched = insertTechniqueClause(stylePrompt, technique);
    if (patched === null) {
      noVocalBlockCount++;
      console.log(`  T${song.trackNo}: 보컬 구절을 찾지 못함(측정 불가) — 건너뜀`);
      continue;
    }
    if (patched.length > PROMPT_LENGTH_CAP) {
      overBudgetCount++;
      console.log(`  T${song.trackNo}: 패치 시 ${patched.length}자로 ${PROMPT_LENGTH_CAP}자를 넘음 — 건너뜀`);
      continue;
    }

    song.stylePrompt = patched;
    patchedCount++;
    changeLog.push({ trackNo: song.trackNo, title: song.title, before: stylePrompt, after: patched });
  }

  const finalOutPath = outPath ?? defaultOutPath(packPath);
  writeFileSync(finalOutPath, JSON.stringify(pack, null, 2), 'utf8');

  console.log(`\n[patch:vocal-technique] ${packPath}`);
  console.log(`  패치됨: ${patchedCount}곡`);
  console.log(`  이미 창법 있어 건너뜀: ${alreadyHasCount}곡`);
  console.log(`  genreId 없음/불일치로 건너뜀: ${noGenreCount}곡`);
  console.log(`  보컬 구절 위치 측정 불가로 건너뜀: ${noVocalBlockCount}곡`);
  console.log(`  900자 초과로 건너뜀: ${overBudgetCount}곡`);
  console.log(`  총 ${pack.songs.length}곡 중 ${patchedCount}곡 패치`);
  console.log(`  출력: ${finalOutPath} (원본 미변경)`);

  if (changeLog.length) {
    console.log('\n곡별 전후 비교:');
    for (const entry of changeLog) {
      console.log(`\n  T${entry.trackNo} "${entry.title}"`);
      console.log(`    전: ${entry.before}`);
      console.log(`    후: ${entry.after}`);
    }
  }
}

main();
