/**
 * 지시문 74 (§6) — 작곡한 검증용 곡에 슬롯의 식별 필드(genreId/genreText/tempo 등)를
 * 붙인다. check:genre-fidelity와 check:era-palette-conflict --pack이 그 필드를 읽는다.
 *
 * Usage: npx tsx scripts/task74AttachSlotFields.ts <songs.json> <slots.json>
 */
import * as fs from 'node:fs';

const songsFile = process.argv[2];
const slotsFile = process.argv[3];
const data = JSON.parse(fs.readFileSync(songsFile, 'utf-8')) as { songs: Record<string, unknown>[] };
const slots = JSON.parse(fs.readFileSync(slotsFile, 'utf-8')) as Record<string, unknown>[];

const CARRY = ['genreId', 'genreText', 'tempo', 'structureTemplate', 'vocalType', 'vocalGender', 'arrangementDensity', 'eraPaletteText', 'moneyChordText', 'moneyChordSectionText', 'songRole'];

for (const song of data.songs) {
  const slot = slots.find(s => s.trackNo === song.trackNo);
  if (!slot) continue;
  for (const field of CARRY) {
    if (slot[field] !== undefined && song[field] === undefined) song[field] = slot[field];
  }
}

fs.writeFileSync(songsFile, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`attached slot fields to ${data.songs.length} songs in ${songsFile}`);
