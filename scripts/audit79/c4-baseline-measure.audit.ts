import { it } from 'vitest';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../../src/data/presets';
import { generateLocalBlueprint } from '../../src/core/localGenerator';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';
it('senior baseline lengths', () => {
  const w = console.warn; console.warn = () => {};
  const channel = channelPresets[0];
  const opts = makeOptions({ channel, songCount: 18 } as Partial<GenerationOptions>) as GenerationOptions;
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const bp: any = generateLocalBlueprint(opts, genres, moodPacks.filter(m => channel.preferredMoods.includes(m.id)), seasonPacks.find(s => s.id === opts.seasonId));
  console.warn = w;
  const L = bp.songs.map((s: any) => s.stylePrompt.length);
  const words = bp.songs.map((s: any) => s.stylePrompt.split(/\s+/).length);
  console.log(`min=${Math.min(...L)} avg=${(L.reduce((a: number, b: number) => a + b, 0) / L.length).toFixed(1)} max=${Math.max(...L)}`);
  console.log(`단어 수 avg=${(words.reduce((a: number, b: number) => a + b, 0) / words.length).toFixed(1)}`);
});
