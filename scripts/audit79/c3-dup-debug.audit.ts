import { it } from 'vitest';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../../src/data/presets';
import { generateLocalBlueprint } from '../../src/core/localGenerator';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';
it('dup debug', () => {
  const w = console.warn; console.warn = () => {};
  const samples: string[] = [];
  const kinds = new Map<string, number>();
  for (const channel of channelPresets) {
    const genreIds = channel.preferredGenres.slice(0, 5);
    for (const concept of ['', '숨소리 섞인 목소리로 부르는 노래', '허스키한 목소리로 부르는 노래']) {
      const opts = makeOptions({ channel, projectTitle: 'dbg', songCount: 6, genreIds, customConcept: concept } as Partial<GenerationOptions>) as GenerationOptions;
      let bp: any; try { bp = generateLocalBlueprint(opts, genrePacks.filter(g => genreIds.includes(g.id)), moodPacks.filter(m => channel.preferredMoods.includes(m.id)), seasonPacks.find(s => s.id === opts.seasonId)); } catch { continue; }
      for (const s of bp.songs) {
        const wr = (s.warnings ?? []).find((x: string) => x.includes('중복된 절'));
        if (!wr) continue;
        const m = wr.match(/"([^"]+)"/g) ?? [];
        const key = m.slice(0, 2).join(' ⊂ ');
        kinds.set(key, (kinds.get(key) ?? 0) + 1);
        if (samples.length < 6) samples.push(`  ${channel.id} "${concept}" → ${wr.slice(0, 190)}`);
      }
    }
  }
  console.warn = w;
  console.log('--- 중복 유형 상위 ---');
  for (const [k, n] of [...kinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${String(n).padStart(4)}  ${k}`);
  console.log('\n--- 표본 ---');
  console.log(samples.join('\n'));
});
