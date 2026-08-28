import { it } from 'vitest';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../../src/data/presets';
import { generateLocalBlueprint } from '../../src/core/localGenerator';
import { minTotalSectionsForBpm } from '../../src/core/bpmLengthControl';
import { countLyricSections } from '../../src/core/instrumentalSectionFill';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';
it('section debug', () => {
  const w = console.warn; console.warn = () => {};
  let shown = 0;
  for (const channel of channelPresets) {
    const genreIds = channel.preferredGenres.slice(0, 5);
    const opts = makeOptions({ channel, projectTitle: 'check:path-coverage', songCount: 12, genreIds } as Partial<GenerationOptions>) as GenerationOptions;
    let bp: any; try { bp = generateLocalBlueprint(opts, genrePacks.filter(g => genreIds.includes(g.id)), moodPacks.filter(m => channel.preferredMoods.includes(m.id)), seasonPacks.find(s => s.id === opts.seasonId)); } catch { continue; }
    for (const s of bp.songs) {
      const floor = minTotalSectionsForBpm(Number(s.bpm ?? 0));
      if (!floor) continue;
      const marks = [...String(s.lyrics).matchAll(/^\[([^\]]+)\]/gm)].map((m: any) => m[1].trim());
      const sections = countLyricSections(String(s.lyrics));
      if (sections >= floor) continue;
      if (shown++ >= 3) { console.warn = w; return; }
      console.log(`\n${channel.id} 트랙 ${s.trackNo} BPM ${s.bpm} 하한 ${floor} 실측 ${sections}`);
      console.log(`  마커: ${marks.join(' > ')}`);
    }
  }
  console.warn = w;
});
