/** §10-6 — 지시문 76의 2대역 브리지: 한 세트에 62 BPM과 128 BPM이 공존하는가 */
import { it } from 'vitest';
import { channelPresets, genrePacks } from '../../src/data/presets';
import { preallocateSongSlots } from '../../src/core/batchPreallocation';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

it('band mix', () => {
  const origWarn = console.warn;
  console.warn = () => {};
  const rows: string[] = [];
  let sets = 0;
  let wide = 0;
  const enChillhop = channelPresets.filter(c => c.archetype === 'en-chillhop');

  for (const channel of enChillhop) {
    for (const title of ['세트 A', '세트 B', '세트 C', '세트 D', '세트 E']) {
      const genreIds = channel.preferredGenres;
      const opts = makeOptions({ channel, projectTitle: title, songCount: 12, genreIds } as Partial<GenerationOptions>) as GenerationOptions;
      let slots: Array<{ tempo: number; effectiveGenreIds: string[] }>;
      try { slots = preallocateSongSlots(opts, genrePacks.filter(g => genreIds.includes(g.id))) as never; } catch { continue; }
      const tempos = slots.map(s => s.tempo).sort((a, b) => a - b);
      const lo = tempos[0];
      const hi = tempos[tempos.length - 1];
      const span = hi - lo;
      const distinct = new Set(slots.map(s => s.effectiveGenreIds[0])).size;
      const maxRepeat = Math.max(...[...new Set(slots.map(s => s.effectiveGenreIds[0]))].map(g => slots.filter(s => s.effectiveGenreIds[0] === g).length));
      sets++;
      const bad = lo <= 70 && hi >= 120;
      if (bad) wide++;
      rows.push(`${bad ? 'XX' : 'OK'} ${channel.id.padEnd(24)} "${title}"  BPM ${lo}~${hi} (폭 ${span})  고유 장르 ${distinct}종  최대 반복 ${maxRepeat}곡`);
    }
  }
  console.warn = origWarn;
  console.log(rows.join('\n'));
  console.log(`\n세트 ${sets}개 중 "저속(<=70)과 고속(>=120)이 한 세트에 공존" ${wide}개`);
});
