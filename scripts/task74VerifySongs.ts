/**
 * 지시문 74 (§6/§7) — 작곡한 검증용 곡이 실제 슬롯 계획과 새 규칙을 지키는지 잰다.
 * Usage: npx tsx scripts/task74VerifySongs.ts <songs.json> <slots.json>
 */
import * as fs from 'node:fs';
import { parseLyricsSections } from '../src/core/lyricsAst';
import { minTotalSectionsForBpm } from '../src/core/bpmLengthControl';
import { firstInstrumentPosition, INSTRUMENT_POSITION_MAX_CHARS } from '../src/core/promptElementOrder';

const songsFile = process.argv[2];
const slotsFile = process.argv[3];
const songs = (JSON.parse(fs.readFileSync(songsFile, 'utf-8')) as { songs: Record<string, string>[] }).songs;
const slots = JSON.parse(fs.readFileSync(slotsFile, 'utf-8')) as Record<string, unknown>[];

const REQUIRED_PHRASE = 'short intro, 3:10-3:35, full arrangement, not a short cut';

let fail = 0;
for (const song of songs) {
  const trackNo = Number(song.trackNo);
  const slot = slots.find(s => s.trackNo === trackNo)!;
  const sections = parseLyricsSections(song.lyrics);
  const instrumental = sections.filter(s => s.lines.length === 0).length;
  const words = song.lyrics.replace(/\[[^\]]*\]/g, ' ').split(/\s+/).filter(Boolean).length;
  const [sMin, sMax] = slot.sectionCountRange as [number, number];
  const [wMin, wMax] = slot.wordCountRange as [number, number];
  const maxInstr = slot.maxInstrumentalSections as number;
  const tempo = slot.tempo as number;
  const floor = minTotalSectionsForBpm(tempo);
  const hookCount = song.lyrics.split(song.hookPhrase).length - 1;
  const instrPos = firstInstrumentPosition(slot.genreId as string, song.stylePrompt);
  const bpmInPrompt = new RegExp(`\\b${tempo}\\s*BPM\\b`, 'i').test(song.stylePrompt);
  const bpmClauseIndex = song.stylePrompt.split(',').findIndex(c => /\d{2,3}\s*bpm/i.test(c));
  const clauseCount = song.stylePrompt.split(',').length;

  const problems: string[] = [];
  if (sections.length < sMin || sections.length > sMax) problems.push(`sections ${sections.length} outside ${sMin}-${sMax}`);
  if (floor && sections.length < floor) problems.push(`sections ${sections.length} under floor ${floor}`);
  if (instrumental > maxInstr) problems.push(`instrumental ${instrumental} over ${maxInstr}`);
  if (words < wMin || words > wMax) problems.push(`words ${words} outside ${wMin}-${wMax}`);
  if (!bpmInPrompt) problems.push(`stylePrompt missing "${tempo} BPM"`);
  if (!song.stylePrompt.includes(REQUIRED_PHRASE)) problems.push('missing required duration phrase');
  if (song.stylePrompt.length > 900) problems.push(`stylePrompt ${song.stylePrompt.length} chars > 900`);
  if (song.excludePrompt && song.excludePrompt.length > 900) problems.push(`excludePrompt ${song.excludePrompt.length} > 900`);
  if (hookCount < 3) problems.push(`hook appears ${hookCount}x`);
  if (instrPos !== null && instrPos > INSTRUMENT_POSITION_MAX_CHARS) problems.push(`first instrument at ${instrPos} chars > ${INSTRUMENT_POSITION_MAX_CHARS}`);
  if (/\[(end|outro)\]\s*$/i.test(song.lyrics.trim()) && floor === 0) problems.push('trailing outro/end tag on a non-fast track');

  if (problems.length) fail += 1;
  const promptWords = song.stylePrompt.split(/\s+/).filter(Boolean).length;
  console.log(
    `#${trackNo} ${String(tempo).padStart(3)}BPM sec=${sections.length}(${sMin}-${sMax}) instr=${instrumental}/${maxInstr} words=${words}(${wMin}-${wMax}) hook=${hookCount}x ` +
    `sp=${song.stylePrompt.length}c/${promptWords}w firstInstr=${instrPos ?? 'n/a'} bpmClause=${bpmClauseIndex + 1}/${clauseCount} ${problems.length ? 'FAIL: ' + problems.join('; ') : 'OK'}`
  );
}
console.log(fail ? `\n${fail} song(s) with problems` : '\nall songs conform');
