import { it } from 'vitest';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../../src/data/presets';
import { generateLocalBlueprint } from '../../src/core/localGenerator';
import { vocalPresets } from '../../src/data/vocalPresets';
import { articulationFamilyForPreset } from '../../src/core/conceptVocalPlan';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';
it('articulation debug', () => {
  const w = console.warn; console.warn = () => {};
  for (const id of ['good-morning-memory-radio', 'headphones-down-low', 'after-work-band-pop']) {
    const channel = channelPresets.find(c => c.id === id)!;
    const preset = vocalPresets.find(p => !p.forKids && p.suitedArchetypes?.includes(channel.archetype as never))!;
    const fam = articulationFamilyForPreset(preset);
    const genreIds = channel.preferredGenres.slice(0, 5);
    const opts = makeOptions({ channel, projectTitle: 'dbg', songCount: 4, genreIds, vocalTone: preset.prompt } as Partial<GenerationOptions>) as GenerationOptions;
    const bp: any = generateLocalBlueprint(opts, genrePacks.filter(g => genreIds.includes(g.id)), moodPacks.filter(m => channel.preferredMoods.includes(m.id)), seasonPacks.find(s => s.id === opts.seasonId));
    console.log(`\n##### ${id}`);
    console.log(`  preset ${preset.id}: ${preset.prompt}`);
    console.log(`  family: ${fam ? fam.onsetClauses.join(' | ') : '(없음)'}`);
    for (const s of bp.songs.slice(0, 3)) {
      console.log(`   vocalText : ${s.vocalText}`);
      console.log(`   stylePrompt: ${String(s.stylePrompt).slice(0, 200)}`);
    }
  }
  console.warn = w;
});
