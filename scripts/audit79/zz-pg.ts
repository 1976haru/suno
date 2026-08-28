import { channelPresets } from '../../src/data/presets';
import { enChillhopBandGenreIds } from '../../src/core/enChillhopBand';
const c = channelPresets.find(x => x.id === 'after-hours-deep-house')!;
console.log('preferredGenres:', c.preferredGenres.join(', '));
const band = enChillhopBandGenreIds('Test Pack');
console.log('rap band(기본) 잠금 후:', c.preferredGenres.filter(id => band.has(id)).join(', ') || '(없음 → 원본 유지)');
