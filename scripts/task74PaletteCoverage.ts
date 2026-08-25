/** 지시문 74 (TASK B-5) — en-chillhop 장르의 팔레트 커버리지 실측. */
import { eraCanonPalettesForGenreId, partialPaletteForGenreId } from '../src/data/eraCanonPalettes';

const ids = [
  'chill-rap', 'boom-bap-mellow', 'jazz-rap', 'lofi-hiphop-study', 'trap-soul', 'alt-rnb',
  'en-deep-house-melodic', 'en-deep-house-organic', 'en-deep-house-vocal-anthem',
  'en-deep-house-soulful', 'en-deep-house-tech-groove', 'en-house-garage-swing'
];

for (const id of ids) {
  const full = eraCanonPalettesForGenreId(id).map(p => p.id);
  const partial = partialPaletteForGenreId(id)?.id;
  console.log(`${id.padEnd(30)} full: ${full.length ? full.join(', ') : '-'}   | partial: ${partial ?? '-'}`);
}
