/** §10-4: 지시문 78 발성 어휘가 최종 stylePrompt에 실리는가 */
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../../src/data/presets';
import { generateLocalBlueprint } from '../../src/core/localGenerator';
import { vocalPresets } from '../../src/data/vocalPresets';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

const VOCAB = ['forward mask resonance', 'clean fold closure', 'soft glottal onset', 'firm glottal closure', 'chest-dominant', 'breath-mixed'];
const origWarn = console.warn; console.warn = () => {};
const totals = new Map<string, number>();
let songs = 0;
const perChannel: string[] = [];

for (const channel of channelPresets) {
  const genreIds = channel.preferredGenres.slice(0, 5);
  for (const [label, tone] of [['기본', channel.defaultVocal], ['프리셋선택', vocalPresets.find(p => p.suitedArchetypes?.includes(channel.archetype as any))?.prompt ?? channel.defaultVocal]] as const) {
    const opts = makeOptions({ channel, projectTitle: 'Audit2 Vocab', songCount: 6, genreIds, vocalTone: tone } as Partial<GenerationOptions>) as GenerationOptions;
    let bp: any;
    try {
      bp = generateLocalBlueprint(opts,
        genrePacks.filter(g => genreIds.includes(g.id)),
        moodPacks.filter(m => channel.preferredMoods.includes(m.id)),
        seasonPacks.find(s => s.id === opts.seasonId));
    } catch (e) { perChannel.push(`ERR ${channel.id} ${e}`); continue; }
    const list = bp.songs ?? bp;
    const hits = new Map<string, number>();
    for (const song of list) {
      songs++;
      const p = `${song.stylePrompt ?? ''}`;
      for (const v of VOCAB) if (p.includes(v)) { hits.set(v, (hits.get(v) ?? 0) + 1); totals.set(v, (totals.get(v) ?? 0) + 1); }
    }
    perChannel.push(`${channel.id.padEnd(26)} ${label.padEnd(6)} ${list.length}곡  적중: ${[...hits.entries()].map(([k, v]) => `${k}×${v}`).join(', ') || '(없음)'}`);
  }
}
console.warn = origWarn;
console.log(perChannel.join('\n'));
console.log(`\n총 ${songs}곡 | 어휘별 총 적중:`);
for (const v of VOCAB) console.log(`  ${v.padEnd(24)} ${totals.get(v) ?? 0}`);
