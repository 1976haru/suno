import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../../src/data/presets';
import { generateLocalBlueprint } from '../../src/core/localGenerator';
import { vocalPresets } from '../../src/data/vocalPresets';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';
const origWarn = console.warn; console.warn = () => {};
const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
const p = vocalPresets.find(v => v.id === 'clear-light-male')!;
console.log('선택 프리셋 prompt:', p.prompt);
const genreIds = channel.preferredGenres.slice(0, 5);
const opts = makeOptions({ channel, projectTitle: 'Audit2 Dump', songCount: 4, genreIds, vocalTone: p.prompt } as Partial<GenerationOptions>) as GenerationOptions;
const bp: any = generateLocalBlueprint(opts, genrePacks.filter(g => genreIds.includes(g.id)), moodPacks.filter(m => channel.preferredMoods.includes(m.id)), seasonPacks.find(s => s.id === opts.seasonId));
console.warn = origWarn;
const s = bp.songs[0];
console.log('\n--- 곡1 필드 ---');
for (const k of Object.keys(s)) {
  const v = (s as any)[k];
  if (typeof v === 'string' && v.length < 700) console.log(`${k}: ${v}`);
}
console.log('\n--- 프리셋 문구가 어느 필드에 실렸는가 ---');
for (const song of bp.songs) {
  for (const k of Object.keys(song)) {
    const v = (song as any)[k];
    if (typeof v === 'string' && (v.includes('forward mask') || v.includes('clean fold') || v.includes('glottal'))) console.log(`곡${song.trackNo} ${k}: HIT`);
  }
}
