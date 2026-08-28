/**
 * 지시문 79 §5 목표 지표 — "34채널 측정 중 단일 장르 붕괴 세트 0건".
 * 2차 감사 scripts/audit2/f3-genre-collapse.ts와 같은 경로·같은 조건에,
 * 컨셉 표본만 넓혀 잰다.
 */
import { it } from 'vitest';
import { channelPresets, genrePacks } from '../../src/data/presets';
import { preallocateSongSlots } from '../../src/core/batchPreallocation';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

const CONCEPTS = [
  '', '겨울밤 드라이브',
  '60년대 올드팝', '1960년대 감성', '70년대 가요', '70년대 추억이 느껴지는 올드팝',
  '80년대 시티팝', '90년대 발라드', '2000년대 감성', '2010년대 인디'
];

it('single-genre collapse metric', () => {
  const origWarn = console.warn;
  console.warn = () => {};
  let sets = 0;
  let collapsed = 0;
  let twoOrFewer = 0;
  const rows: string[] = [];

  for (const channel of channelPresets) {
    const genreIds = channel.preferredGenres.slice(0, 5);
    const genres = genrePacks.filter(g => genreIds.includes(g.id));
    for (const concept of CONCEPTS) {
      const opts = makeOptions({ channel, projectTitle: '지시문79 지표', songCount: 15, genreIds, customConcept: concept } as Partial<GenerationOptions>) as GenerationOptions;
      let slots: Array<{ effectiveGenreIds: string[] }>;
      try { slots = preallocateSongSlots(opts, genres) as never; } catch { continue; }
      const ids = slots.map(s => s.effectiveGenreIds[0]);
      const distinct = new Set(ids).size;
      sets += 1;
      if (distinct === 1) {
        collapsed += 1;
        rows.push(`  붕괴 ${channel.id} concept="${concept}" → ${ids[0]} ×15`);
      } else if (distinct === 2 && genreIds.length > 2) {
        twoOrFewer += 1;
      }
    }
  }
  console.warn = origWarn;
  console.log(rows.join('\n') || '  (단일 장르 붕괴 없음)');
  console.log(`\n세트 ${sets}개 (채널 ${channelPresets.length} × 컨셉 ${CONCEPTS.length})`);
  console.log(`  단일 장르 붕괴(1종)          : ${collapsed}`);
  console.log(`  2종 (선택 장르가 3종 이상인데): ${twoOrFewer}`);
});
