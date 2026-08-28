import { it } from 'vitest';
import { workspaceDefinitions } from '../../src/data/workspaces/index';
import { channelPresets, genrePacks } from '../../src/data/presets';
import { preallocateSongSlots } from '../../src/core/batchPreallocation';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';
import * as WR from '../../src/core/workspaceReadiness';
it('genre pool per archetype', () => {
  const w = console.warn; console.warn = () => {};
  const fn = (WR as any).genrePoolSizeForArchetype;
  const ws = workspaceDefinitions.find(x => x.id === 'senior-oldpop')!;
  for (const a of ws.archetypeIds) {
    const ch = channelPresets.find(c => c.archetype === a);
    let used = '-';
    if (ch) {
      try {
        const opts = makeOptions({ channel: ch, projectTitle: 'P', songCount: 12, genreIds: ch.preferredGenres } as Partial<GenerationOptions>) as GenerationOptions;
        const slots: any[] = preallocateSongSlots(opts, genrePacks.filter(g => ch.preferredGenres.includes(g.id))) as any;
        used = `${new Set(slots.map(s => s.effectiveGenreIds[0])).size}종`;
      } catch { used = 'ERR'; }
    }
    console.log(`${String(a).padEnd(18)} 배지가 세는 풀 ${fn ? fn(a) : '?'}종   채널 preferredGenres ${ch ? ch.preferredGenres.length : '-'}종   실제 12곡에 쓰인 고유 장르 ${used}   (채널: ${ch?.id ?? '없음'})`);
  }
  console.warn = w;
});
