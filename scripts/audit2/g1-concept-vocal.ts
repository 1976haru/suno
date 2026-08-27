/** §10-3: 지시문 77 vocalPresetWeights가 effectiveVocalPresetId에 도달하는가 */
import { channelPresets, genrePacks } from '../../src/data/presets';
import { preallocateSongSlots } from '../../src/core/batchPreallocation';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

const origWarn = console.warn; const warns: string[] = [];
console.warn = (...a: any[]) => warns.push(a.join(' '));

function dist(channelId: string, concept: string) {
  const channel = channelPresets.find(c => c.id === channelId)!;
  const genreIds = channel.preferredGenres.slice(0, 5);
  const opts = makeOptions({ channel, projectTitle: 'Audit2 ConceptVocal', songCount: 15, genreIds, customConcept: concept } as Partial<GenerationOptions>) as GenerationOptions;
  const genres = genrePacks.filter(g => genreIds.includes(g.id));
  const slots: any[] = preallocateSongSlots(opts, genres) as any;
  const presets = slots.map(s => s.effectiveVocalPresetId ?? '-');
  const srcs = slots.map(s => s.vocalPresetSource ?? '-');
  const fams = slots.map(s => s.conceptVocalFamilyId ?? '-');
  return { presets, srcs, fams };
}

for (const [ch, a, b] of [
  ['after-hours-deep-house', '숨소리 섞인 목소리로 부르는 칠 딥하우스', '칠 딥하우스'],
  ['headphones-down-low', '허스키한 목소리로 부르는 칠 랩', '칠 랩'],
  ['good-morning-memory-radio', '힘차게 내지르는 목소리의 올드팝', '올드팝'],
] as const) {
  const A = dist(ch, a), B = dist(ch, b);
  console.log(`\n##### ${ch}`);
  console.log(`컨셉A "${a}"`);
  console.log('  presets:', A.presets.join(','));
  console.log('  source :', A.srcs.join(','));
  console.log('  family :', A.fams.join(','));
  console.log(`컨셉B "${b}"`);
  console.log('  presets:', B.presets.join(','));
  console.log('  source :', B.srcs.join(','));
  console.log('  family :', B.fams.join(','));
  const same = A.presets.join(',') === B.presets.join(',');
  console.log('  => 두 컨셉의 프리셋 분포 동일:', same ? '*** 동일 (컨셉이 배정을 바꾸지 못함) ***' : '다름 (컨셉이 반영됨)');
}
console.warn = origWarn;
console.log('\n--- console.warn ---'); console.log(warns.join('\n') || '(없음)');
