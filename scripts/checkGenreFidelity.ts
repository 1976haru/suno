/**
 * 지시문 58 (TASK D) — "같은 회귀가 반복되지 않게 한다". 지시문 44가 "장르
 * 라벨이 맨 앞에 정확히 들어간다"를 한 번 확인만 하고 회귀 검사를 만들지
 * 않아, 지시문 46(시대 바닥)이 그걸 다시 깨뜨릴 때까지(8/14) 아무도
 * 몰랐다. core/genreFidelity.ts의 순수 함수(npm run audit의
 * genre_opens_prompt/genre_core_vocabulary 항목과 동일 로직)를 그대로
 * 재사용해, 실제 export된 팩 JSON({ songs: [...] }) 파일 하나를 바로
 * 검사한다 — npm run audit처럼 채널/컨셉 컨텍스트를 재구성하지 않는,
 * 훨씬 가벼운 단일 목적 도구다.
 *
 * 지시문 59 (TASK D) — ④ 첫 악기 등장 위치(100자 이내, 잠정)·⑤ 보컬 서술
 * 개수(2~3개, 잠정) 두 항목 추가. "장르가 첫 자리인가"(58)와 다른 축인
 * "악기가 어디 있는가"(59) — 같은 genreFidelity.ts 순수 함수를 그대로
 * 재사용한다.
 *
 * §하지 말 것 "새 검사로 세트를 차단하지 말 것" — advisory. 항상 exit 0.
 *
 * Usage: npx tsx scripts/checkGenreFidelity.ts --pack <path-to-pack.json> [--json]
 */
import fs from 'fs';
import { runGenreFidelityCheck, type GenreFidelitySong } from '../src/core/genreFidelity';

interface RawSong {
  trackNo: number;
  genreId?: string;
  stylePrompt?: string;
}

/** 지시문 59 §1-1/§1-3 실측 표(최소/중앙/최대)와 같은 형식. */
function statsLine(values: number[]): string {
  if (!values.length) return '-';
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return `최소 ${min}·중앙 ${median}·최대 ${max}`;
}

function loadSongs(packPath: string): GenreFidelitySong[] {
  const raw = fs.readFileSync(packPath, 'utf-8').replace(/^﻿/, '');
  const parsed = JSON.parse(raw) as { songs?: RawSong[] };
  const songs = parsed.songs ?? [];
  return songs.map(song => ({
    trackNo: song.trackNo,
    genreId: song.genreId,
    stylePrompt: song.stylePrompt ?? ''
  }));
}

function main() {
  const args = process.argv.slice(2);
  const packPath = args.find(a => a.startsWith('--pack='))?.split('=')[1]
    ?? (args.includes('--pack') ? args[args.indexOf('--pack') + 1] : undefined);
  const jsonMode = args.includes('--json');

  if (!packPath) {
    console.log('Usage: npx tsx scripts/checkGenreFidelity.ts --pack <path-to-pack.json> [--json]');
    process.exit(0);
  }
  if (!fs.existsSync(packPath)) {
    console.log(`[check:genre-fidelity] 파일을 찾을 수 없습니다: ${packPath}`);
    process.exit(0);
  }

  const songs = loadSongs(packPath);
  if (!songs.length) {
    console.log(`[check:genre-fidelity] "${packPath}" — songs 배열이 비어 있거나 형식이 다릅니다.`);
    process.exit(0);
  }

  const report = runGenreFidelityCheck(songs);

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`[check:genre-fidelity] ${packPath} (${report.songCount}곡)\n`);

  const genreLine = `① stylePrompt가 장르로 시작 — ${report.opensWithGenre.pass}/${report.opensWithGenre.total}` +
    (report.opensWithGenre.failedTrackNos.length ? ` (미달: T${report.opensWithGenre.failedTrackNos.join(', T')})` : '');
  console.log(report.opensWithGenre.failedTrackNos.length ? `⚠ ${genreLine}` : `✅ ${genreLine}`);

  const vocabLine = report.coreVocabulary.total
    ? `③ 장르 핵심 악기·리듬 반영 — ${report.coreVocabulary.pass}/${report.coreVocabulary.total}` +
      (report.coreVocabulary.failedTrackNos.length ? ` (미달: T${report.coreVocabulary.failedTrackNos.join(', T')})` : '')
    : '③ 장르 핵심 악기·리듬 반영 — genreId 없는 곡뿐이라 판정 불가';
  console.log(report.coreVocabulary.failedTrackNos.length ? `⚠ ${vocabLine}` : `✅ ${vocabLine}`);

  const dist = report.distribution;
  const distLine = `② 장르 배분 — 최대 ${dist.maxCount}곡/${Object.values(dist.counts).reduce((a, b) => a + b, 0)}곡(${Math.round(dist.maxShare * 100)}%, 허용 ${dist.maxAllowed}곡) · 1곡짜리 ${dist.singletons.length}개` +
    (dist.singletons.length ? ` (${dist.singletons.join(', ')})` : '');
  console.log(dist.withinMax && dist.noSingletons ? `✅ ${distLine}` : `⚠ ${distLine}`);

  // 지시문 59 (TASK D)
  const instrumentLine = report.instrumentPosition.total
    ? `④ 첫 악기 등장 위치 (100자 이내) — ${report.instrumentPosition.pass}/${report.instrumentPosition.total} (${statsLine(report.instrumentPosition.positions)}자)` +
      (report.instrumentPosition.failedTrackNos.length ? ` (미달: T${report.instrumentPosition.failedTrackNos.join(', T')})` : '')
    : '④ 첫 악기 등장 위치 — genreId 없거나 악기를 못 찾은 곡뿐이라 판정 불가';
  console.log(report.instrumentPosition.failedTrackNos.length ? `⚠ ${instrumentLine}` : `✅ ${instrumentLine}`);

  const vocalCountLine = report.vocalDescriptorCount.total
    ? `⑤ 보컬 서술 개수 (2~3개) — ${report.vocalDescriptorCount.pass}/${report.vocalDescriptorCount.total} (${statsLine(report.vocalDescriptorCount.counts)}개)` +
      (report.vocalDescriptorCount.failedTrackNos.length ? ` (미달: T${report.vocalDescriptorCount.failedTrackNos.join(', T')})` : '')
    : '⑤ 보컬 서술 개수 — 시작점을 못 찾은 곡뿐이라 판정 불가';
  console.log(report.vocalDescriptorCount.failedTrackNos.length ? `⚠ ${vocalCountLine}` : `✅ ${vocalCountLine}`);

  console.log('\n[check:genre-fidelity] advisory — 통과 처리(exit 0). 차단하지 않는다.');
}

main();
