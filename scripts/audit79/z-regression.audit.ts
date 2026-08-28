/** 지시문 79 §5 회귀 금지 항목 실측. */
import { it } from 'vitest';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../../src/data/presets';
import { generateLocalBlueprint } from '../../src/core/localGenerator';
import { preallocateSongSlots } from '../../src/core/batchPreallocation';
import { suitablePresetsForArchetype } from '../../src/core/vocalRecommender';
import { vocalPresets } from '../../src/data/vocalPresets';
import { getCoreGenreIdsForArchetype } from '../../src/data/genreLibrary';
import { adultLyricThemes } from '../../src/data/lyricThemes';
import { makeOptions } from '../../tests/fixtures';
import type { ChannelArchetype, GenerationOptions } from '../../src/types';

it('regression metrics', () => {
  const origWarn = console.warn;
  console.warn = () => {};

  console.log('① suitablePresetsForArchetype');
  const ADULT7: ChannelArchetype[] = ['oldpop-lounge', 'showa-70s', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-male', 'kr-idol-female', 'en-chillhop'];
  for (const a of ADULT7) console.log(`   ${a.padEnd(16)} ${suitablePresetsForArchetype(a).length}종 (기준 8 이상)`);
  for (const a of ['kr-kids-song', 'jp-kids-song'] as ChannelArchetype[]) console.log(`   ${a.padEnd(16)} ${suitablePresetsForArchetype(a).length}종 (기준 10 무변경)`);
  console.log(`   forKids 프리셋 ${vocalPresets.filter(p => p.forKids).length}종 (기준 10 무변경) / 전체 ${vocalPresets.length}종`);

  console.log('\n② en-chillhop 자산');
  console.log(`   코어 장르 ${getCoreGenreIdsForArchetype('en-chillhop').length}종 (기준 15)`);
  console.log(`   채널 ${channelPresets.filter(c => c.archetype === 'en-chillhop').length}개 (기준 5)`);
  const enThemes = adultLyricThemes.filter(t => (t.suitedArchetypes as readonly string[] | undefined)?.includes('en-chillhop'));
  console.log(`   테마 ${enThemes.length}개 (기준 70)`);

  console.log('\n③ stylePrompt 평균 단어 수 · 성별 쿼터 (34채널 × 12곡)');
  let words = 0;
  let songs = 0;
  const quota: Record<string, number> = { male: 0, female: 0, mixed: 0 };
  for (const channel of channelPresets) {
    const genreIds = channel.preferredGenres.slice(0, 5);
    const opts = makeOptions({ channel, projectTitle: '지시문79 회귀', songCount: 12, genreIds } as Partial<GenerationOptions>) as GenerationOptions;
    try {
      const bp = generateLocalBlueprint(opts, genrePacks.filter(g => genreIds.includes(g.id)),
        moodPacks.filter(m => channel.preferredMoods.includes(m.id)),
        seasonPacks.find(s => s.id === opts.seasonId)) as unknown as { songs: Array<{ stylePrompt: string }> };
      for (const song of bp.songs) { words += song.stylePrompt.split(/\s+/).length; songs += 1; }
      const slots = preallocateSongSlots(opts, genrePacks.filter(g => genreIds.includes(g.id))) as unknown as Array<{ vocalType: string }>;
      for (const s of slots) quota[s.vocalType] = (quota[s.vocalType] ?? 0) + 1;
    } catch { /* skip */ }
  }
  console.warn = origWarn;
  console.log(`   stylePrompt 평균 단어 수 ${(words / songs).toFixed(1)} (${songs}곡)`);
  const total = quota.male + quota.female + quota.mixed;
  console.log(`   성별 쿼터 합계 남 ${quota.male} · 여 ${quota.female} · 듀엣 ${quota.mixed} (${((quota.male / total) * 100).toFixed(1)}% / ${((quota.female / total) * 100).toFixed(1)}% / ${((quota.mixed / total) * 100).toFixed(1)}%)`);
});
