/** 채널 defaultVocal이 프리셋과 정확히 일치하면 tone-match가 컨셉 발성 지목을 항상 이긴다 */
import { channelPresets } from '../../src/data/presets';
import { matchVocalPreset } from '../../src/data/vocalPresets';

console.log('채널ID'.padEnd(28), 'archetype'.padEnd(16), 'defaultVocal이 프리셋과 일치?');
let hit = 0;
for (const c of channelPresets) {
  const m = matchVocalPreset(c.defaultVocal?.trim() ?? '');
  if (m) hit++;
  console.log(c.id.padEnd(28), c.archetype.padEnd(16), m ? `*** ${m.id} ***` : '-');
}
console.log(`\n일치 채널 ${hit}/${channelPresets.length}`);
