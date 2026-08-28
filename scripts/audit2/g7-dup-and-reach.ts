/** ① vocalText 어절 중복  ② 프리셋 33종 도달성 */
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../../src/data/presets';
import { generateLocalBlueprint } from '../../src/core/localGenerator';
import { vocalPresets } from '../../src/data/vocalPresets';
import { suitablePresetsForArchetype } from '../../src/core/vocalRecommender';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';
const origWarn = console.warn; console.warn = () => {};

// ① 중복 절 검사
const CONCEPTS = ['숨소리 섞인 목소리로', '허스키한 목소리로', '힘차게 내지르는 목소리로', '깨끗한 목소리로', '어두운 목소리로'];
let dupSongs = 0, totalSongs = 0; const samples: string[] = [];
for (const channel of channelPresets) {
  const genreIds = channel.preferredGenres.slice(0, 5);
  for (const concept of CONCEPTS) {
    const opts = makeOptions({ channel, projectTitle: 'Audit2 Dup', songCount: 6, genreIds, customConcept: concept } as Partial<GenerationOptions>) as GenerationOptions;
    let bp: any; try { bp = generateLocalBlueprint(opts, genrePacks.filter(g => genreIds.includes(g.id)), moodPacks.filter(m => channel.preferredMoods.includes(m.id)), seasonPacks.find(s => s.id === opts.seasonId)); } catch { continue; }
    for (const s of bp.songs) {
      totalSongs++;
      const parts = String(s.vocalText ?? '').split(',').map((x: string) => x.trim()).filter(Boolean);
      let dup = false;
      for (let i = 0; i < parts.length; i++) for (let j = 0; j < parts.length; j++) {
        if (i !== j && (parts[i] === parts[j] ? i < j : parts[j].includes(parts[i]))) dup = true;
      }
      if (dup) { dupSongs++; if (samples.length < 8) samples.push(`${channel.id} "${concept}" → ${s.vocalText}`); }
    }
  }
}
console.warn = origWarn;
console.log(`① vocalText 안에 동일 절이 두 번 나오는 곡: ${dupSongs}/${totalSongs}`);
console.log(samples.map(s => '   ' + s).join('\n'));

// ② 프리셋 도달성
console.log(`\n② 프리셋 총 ${vocalPresets.length}종`);
const archetypes = [...new Set(channelPresets.map(c => c.archetype))];
const pickable = new Set<string>();
for (const a of archetypes) for (const p of suitablePresetsForArchetype(a as any)) pickable.add(p.id);
const unreachable = vocalPresets.filter(p => !pickable.has(p.id));
console.log(`   어떤 아키타입 픽커에도 노출되지 않는 프리셋: ${unreachable.length}종`);
for (const p of unreachable) console.log(`     ${p.id}  forKids=${(p as any).forKids}  suitedArchetypes=${JSON.stringify(p.suitedArchetypes)}`);
console.log('\n   아키타입별 노출 프리셋 수:');
for (const a of archetypes) console.log(`     ${String(a).padEnd(16)} ${suitablePresetsForArchetype(a as any).length}종`);
