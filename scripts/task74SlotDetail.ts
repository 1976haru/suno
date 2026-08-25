/** 지시문 74 (§6) — 작곡할 트랙의 슬롯 값만 압축해 본다. Usage: npx tsx scripts/task74SlotDetail.ts <slots.json> <trackNo,...> */
import * as fs from 'node:fs';

const file = process.argv[2];
const wanted = (process.argv[3] || '').split(',').map(Number).filter(Boolean);
const slots = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>[];

const FIELDS = [
  'trackNo', 'title', 'hookPhrase', 'songRole', 'tempo', 'genreId', 'genreText',
  'structureTemplate', 'introMode', 'sectionCountRange', 'wordCountRange', 'maxInstrumentalSections',
  'moneyChordText', 'moneyChordSectionText', 'eraPaletteText', 'introTextureText', 'hookDeviceText',
  'killingPointText', 'killingPointPlacement', 'earwormText', 'arrangementDensity',
  'vocalText', 'vocalTechniqueText', 'vocalGender', 'vocalType', 'lyricThemeText', 'lyricThemeArc',
  'pov', 'emotionArc', 'eraTag'
];

for (const slot of slots) {
  if (wanted.length && !wanted.includes(slot.trackNo as number)) continue;
  console.log('='.repeat(70));
  for (const f of FIELDS) {
    if (slot[f] === undefined) continue;
    console.log(`${f}: ${JSON.stringify(slot[f])}`);
  }
}
