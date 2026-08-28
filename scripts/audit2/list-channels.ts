import { channelPresets, genrePacks } from '../../src/data/presets';
for (const c of channelPresets) {
  console.log(`${c.id}\t${c.archetype}\t${c.name}\tdefaultVocal=${JSON.stringify(c.defaultVocal)}\tquotaOverride=${JSON.stringify((c as any).vocalQuotaOverride)}`);
}
console.log('--- genres with chill/lofi/rap/boom ---');
for (const g of genrePacks) if (/rap|lofi|lo-fi|boom|house|chill/i.test(g.id + ' ' + g.name)) console.log(`${g.id}\t${g.name}`);
