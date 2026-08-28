/** 컨셉 문자열이 장르 구성을 붕괴시키는지: Step2가 보여준 장르 종류 수 vs 실제 생성 장르 종류 수 */
import { channelPresets, genrePacks } from '../../src/data/presets';
import { buildGenreRotationPlan } from '../../src/core/genreRotation';
import { hashSeed } from '../../src/utils/prng';
import { preallocateSongSlots } from '../../src/core/batchPreallocation';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

const CONCEPTS = ['', '겨울밤 드라이브', '60년대 올드팝', '70년대 추억이 느껴지는 올드팝', '80년대 시티팝', '90년대 발라드', '2000년대 감성'];
const origWarn = console.warn; console.warn = () => {};
const rows: string[] = [];
let collapsed = 0, total = 0;
for (const channel of channelPresets) {
  for (const concept of CONCEPTS) {
    const songCount = 15;
    const genreIds = channel.preferredGenres.slice(0, 5);
    const opts = makeOptions({ channel, projectTitle: 'Audit2 Collapse', songCount, genreIds, customConcept: concept } as Partial<GenerationOptions>) as GenerationOptions;
    const seed = hashSeed(`${channel.id}:${opts.projectTitle}`);
    const previewPlan = buildGenreRotationPlan(genreIds, songCount, seed);
    const genres = genrePacks.filter(g => genreIds.includes(g.id));
    let slots: any[];
    try { slots = preallocateSongSlots(opts, genres) as any; } catch { continue; }
    const previewDistinct = new Set(previewPlan).size;
    const actualIds = slots.map(s => s.effectiveGenreIds?.[0]);
    const actualDistinct = new Set(actualIds).size;
    const topCount = Math.max(...[...new Set(actualIds)].map(id => actualIds.filter(x => x === id).length));
    total++;
    if (actualDistinct < previewDistinct) {
      collapsed++;
      rows.push(`${channel.id.padEnd(26)} ${channel.archetype.padEnd(16)} concept="${concept}"  화면 ${previewDistinct}종 → 실제 ${actualDistinct}종 (최다 장르 ${topCount}/${songCount}곡)`);
    }
  }
}
console.warn = origWarn;
console.log(rows.join('\n'));
console.log(`\n총 ${total}건 중 장르 종류 축소 ${collapsed}건`);
