import { channelPresets, genrePacks } from '../../src/data/presets';
import { preallocateSongSlots } from '../../src/core/batchPreallocation';
import { vocalPresets } from '../../src/data/vocalPresets';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';
const origWarn = console.warn; console.warn = () => {};
for (const id of ['good-morning-memory-radio', 'chill-hours', 'city-night-drive']) {
  const channel = channelPresets.find(c => c.id === id)!;
  const genreIds = channel.preferredGenres.slice(0, 5);
  const opts = makeOptions({ channel, projectTitle: 'Audit2 ToneMatch', songCount: 15, genreIds, customConcept: '힘차게 내지르는 목소리' } as Partial<GenerationOptions>) as GenerationOptions;
  const slots: any[] = preallocateSongSlots(opts, genrePacks.filter(g => genreIds.includes(g.id))) as any;
  console.log(`\n### ${id}`);
  let mismatch = 0;
  for (const s of slots) {
    const p = s.effectiveVocalPresetId ? vocalPresets.find(v => v.id === s.effectiveVocalPresetId) : undefined;
    const pg = p ? (p.gender === 'duet' || p.gender === 'mixed' ? 'mixed' : p.gender) : '-';
    const bad = p && pg !== s.vocalType;
    if (bad) mismatch++;
    console.log(`  트랙${String(s.trackNo).padStart(2)} vocalType=${String(s.vocalType).padEnd(6)} preset=${String(s.effectiveVocalPresetId ?? '-').padEnd(22)} presetGender=${pg.padEnd(6)} src=${s.vocalPresetSource ?? '-'}${bad ? '   <<< 성별 불일치' : ''}`);
  }
  console.log(`  성별 불일치 ${mismatch}/${slots.length}`);
  console.log('  vocalText 표본:', JSON.stringify(slots.slice(0,3).map((s:any)=>s.vocalText)));
}
console.warn = origWarn;
