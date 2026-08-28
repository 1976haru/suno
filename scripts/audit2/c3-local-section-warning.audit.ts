/** §10-5 후속 — 로컬 생성물이 자기 채점기(scoreSong)의 섹션 하한 경고를 실제로 받는가 */
import { it } from 'vitest';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../../src/data/presets';
import { generateLocalBlueprint } from '../../src/core/localGenerator';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

it('local section warning rate', () => {
  const origWarn = console.warn;
  console.warn = () => {};
  let songs = 0;
  let warned = 0;
  const byChannel: string[] = [];
  const samples: string[] = [];

  for (const channel of channelPresets) {
    const genreIds = channel.preferredGenres.slice(0, 5);
    const opts = makeOptions({ channel, projectTitle: 'Audit2 SecWarn', songCount: 12, genreIds } as Partial<GenerationOptions>) as GenerationOptions;
    let bp: { songs: Array<{ warnings?: string[]; qualityScore?: number; bpm?: number; trackNo?: number }> };
    try {
      bp = generateLocalBlueprint(
        opts,
        genrePacks.filter(g => genreIds.includes(g.id)),
        moodPacks.filter(m => channel.preferredMoods.includes(m.id)),
        seasonPacks.find(s => s.id === opts.seasonId)
      ) as never;
    } catch { continue; }
    let n = 0;
    for (const song of bp.songs) {
      songs++;
      const hit = (song.warnings ?? []).some(w => w.includes('섹션이') && w.includes('최소'));
      if (hit) {
        warned++;
        n++;
        if (samples.length < 5) samples.push(`  ${channel.id} 트랙 ${song.trackNo} (${song.bpm} BPM, 점수 ${song.qualityScore}) — ${(song.warnings ?? []).find(w => w.includes('섹션이'))}`);
      }
    }
    if (n) byChannel.push(`  ${channel.id.padEnd(28)} ${n}/12곡`);
  }
  console.warn = origWarn;
  console.log(`로컬 생성 ${songs}곡 중 자기 채점기의 섹션 하한 경고를 받은 곡: ${warned} (${(warned / songs * 100).toFixed(1)}%)`);
  console.log(byChannel.join('\n'));
  console.log('\n표본:');
  console.log(samples.join('\n'));
});
