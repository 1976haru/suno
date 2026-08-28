/**
 * 지시문 79 §7-2 — 실제 15곡 세트 3건을 끝까지 생성하고 곡별 장르 id를
 * 그대로 출력한다. 예상값이 아니라 산출물이다.
 */
import { it } from 'vitest';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../../src/data/presets';
import { generateLocalBlueprint } from '../../src/core/localGenerator';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

const CASES = ['60년대 올드팝', '1960년대 감성', '70년대 가요'];

it('real 15-song sets on showa-seventies', () => {
  const origWarn = console.warn;
  console.warn = () => {};
  const channel = channelPresets.find(c => c.id === 'showa-seventies')!;
  const genreIds = channel.preferredGenres;
  for (const concept of CASES) {
    const opts = makeOptions({
      channel, projectTitle: '지시문79 실측', songCount: 15, genreIds,
      customConcept: concept, lyricLanguage: 'japanese'
    } as Partial<GenerationOptions>) as GenerationOptions;
    const bp = generateLocalBlueprint(
      opts,
      genrePacks.filter(g => genreIds.includes(g.id)),
      moodPacks.filter(m => channel.preferredMoods.includes(m.id)),
      seasonPacks.find(s => s.id === opts.seasonId)
    ) as unknown as { songs: Array<{ trackNo: number; genreId?: string; bpm?: number; warnings?: string[] }> };

    const ids = bp.songs.map(s => s.genreId ?? '-');
    const counts = new Map<string, number>();
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    console.log(`\n##### showa-seventies × "${concept}"  (15곡)`);
    bp.songs.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. ${s.genreId ?? '-'}`));
    console.log(`  → 고유 장르 ${counts.size}종: ${[...counts.entries()].map(([id, n]) => `${id}×${n}`).join(', ')}`);
    const w = bp.songs[0].warnings?.find(x => x.includes('장르가 하나도') || x.includes('지목한 장르'));
    console.log(`  → 1번 곡 경고: ${w ?? '(없음)'}`);
  }
  console.warn = origWarn;
});
