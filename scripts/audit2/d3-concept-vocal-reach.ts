/** 유형 D — 컨셉 발성 지목 5계열 × 전 채널 실제 도달성 (실행으로 확인) */
import { channelPresets, genrePacks, moodPacks } from '../../src/data/presets';
import { preallocateSongSlots } from '../../src/core/batchPreallocation';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

const CONCEPT_BY_FAMILY: Record<string, string> = {
  breathy: '숨소리 섞인 목소리로 부르는 노래',
  belted: '파워풀한 보컬로 부르는 노래',
  husky: '허스키한 목소리로 부르는 노래',
  dark: '어두운 목소리로 부르는 노래',
  clean: '담백한 목소리로 부르는 노래',
};

const origWarn = console.warn;
const warns: string[] = [];
console.warn = (...a: unknown[]) => { warns.push(a.join(' ')); };

const fams = Object.keys(CONCEPT_BY_FAMILY);
console.log('채널'.padEnd(28) + 'archetype'.padEnd(17) + fams.map(f => f.padEnd(10)).join(''));
let dead = 0, cells = 0;
for (const channel of channelPresets) {
  const genreIds = channel.preferredGenres.slice(0, 5);
  const genres = genrePacks.filter(g => genreIds.includes(g.id));
  const row: string[] = [];
  for (const f of fams) {
    const opts = makeOptions({ channel, projectTitle: 'Audit2 Reach', songCount: 12, genreIds, customConcept: CONCEPT_BY_FAMILY[f] } as Partial<GenerationOptions>) as GenerationOptions;
    let slots: any[] = [];
    try { slots = preallocateSongSlots(opts, genres) as any; } catch { row.push('ERR'.padEnd(10)); continue; }
    const n = slots.filter(s => s.vocalPresetSource === 'concept').length;
    const flagged = slots.filter(s => s.conceptVocalFamilyId).length;
    cells++;
    if (flagged > 0 && n === 0) { dead++; row.push(`지목만${flagged}`.padEnd(10)); }
    else if (flagged === 0) row.push('미지목'.padEnd(10));
    else row.push(`${n}/12`.padEnd(10));
  }
  console.log(channel.id.padEnd(28) + channel.archetype.padEnd(17) + row.join(''));
}
console.warn = origWarn;
console.log(`\n지목은 됐으나 프리셋이 하나도 배정되지 않은 칸: ${dead} / ${cells}`);
console.log('\n--- console.warn 표본 (중복 제거) ---');
console.log([...new Set(warns)].slice(0, 20).join('\n'));

// 무드 id 무결성
console.log('\n--- channel.preferredMoods 무결성 ---');
const moodIds = new Set(moodPacks.map(m => m.id));
for (const c of channelPresets) {
  const bad = c.preferredMoods.filter(m => !moodIds.has(m));
  if (bad.length) console.log(`${c.id}: 존재하지 않는 무드 ${JSON.stringify(bad)} — 실제 사용 가능 무드 ${c.preferredMoods.length - bad.length}/${c.preferredMoods.length}`);
}
