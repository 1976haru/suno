/** §1.3 — Step1 준비 상태 배지(n/5)가 재는 값 vs 실제 세트가 쓰는 값 */
import { it } from 'vitest';
import { channelPresets, genrePacks } from '../../src/data/presets';
import { computeWorkspaceReadiness } from '../../src/core/workspaceReadiness';
import { workspaceDefinitions as WORKSPACES } from '../../src/data/workspaces/index';
import { preallocateSongSlots } from '../../src/core/batchPreallocation';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

it('readiness badge vs actual', () => {
  const origWarn = console.warn;
  console.warn = () => {};
  for (const ws of WORKSPACES) {
    const r = computeWorkspaceReadiness(ws, 0);
    const genreItem = r.items.find(i => i.id === 'genre-pool');
    const chans = channelPresets.filter(c => (ws.archetypeIds as readonly string[]).includes(c.archetype));
    const actual = chans.map(c => {
      const opts = makeOptions({ channel: c, projectTitle: 'Audit2 Ready', songCount: 12, genreIds: c.preferredGenres } as Partial<GenerationOptions>) as GenerationOptions;
      let slots: Array<{ effectiveGenreIds: string[] }>;
      try { slots = preallocateSongSlots(opts, genrePacks.filter(g => c.preferredGenres.includes(g.id))) as never; } catch { return `${c.id}=ERR`; }
      return `${c.id}=${new Set(slots.map(s => s.effectiveGenreIds[0])).size}종`;
    });
    console.log(`${ws.id.padEnd(18)} ${r.passCount}/${r.total}  ` + r.items.map(i => `${i.ok ? "O" : "X"} ${i.labelKo}(${i.detailKo})`).join("  "));
    console.log(`   실제 12곡 세트가 쓰는 고유 장르: ${actual.join(', ')}`);
  }
  console.warn = origWarn;
});
