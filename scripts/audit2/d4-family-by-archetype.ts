import { VOCAL_FAMILY_BY_PRESET_ID, VOCAL_FAMILIES } from '../../src/core/conceptVocalPlan';
import { suitablePresetsForArchetype } from '../../src/core/vocalRecommender';
import { channelPresets } from '../../src/data/presets';
const fams = Object.keys(VOCAL_FAMILIES);
const archetypes = [...new Set(channelPresets.map(c => c.archetype))];
console.log('archetype'.padEnd(18) + fams.map(f => f.padEnd(10)).join(''));
for (const a of archetypes) {
  const ids = suitablePresetsForArchetype(a as any).map(p => p.id);
  const row = fams.map(f => {
    const n = ids.filter(id => (VOCAL_FAMILY_BY_PRESET_ID as any)[id] === f).length;
    return (n === 0 ? '없음' : `${n}종`).padEnd(10);
  });
  console.log(a.padEnd(18) + row.join(''));
}
