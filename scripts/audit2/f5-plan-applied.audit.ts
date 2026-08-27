/** 유형 F 후속 — [설계 적용]을 눌렀을 때는 표와 실제가 맞는가 (버튼 효과의 크기) */
import { it } from 'vitest';
import { channelPresets, genrePacks } from '../../src/data/presets';
import { directSetLocal } from '../../src/core/setDirector';
import { preallocateSongSlots } from '../../src/core/batchPreallocation';
import { normalizeDiversityAllocations } from '../../src/core/diversityAllocation';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

it('plan applied vs not', () => {
  const origWarn = console.warn;
  console.warn = () => {};
  let tracks = 0, gNo = 0, gYes = 0, tNo = 0, tYes = 0;
  const rows: string[] = [];

  for (const channel of channelPresets) {
    const freeText = '늦은 밤에 듣는 노래';
    const songCount = 12;
    let plan: { slots: Array<{ genreId?: string; tempo: number }>; allocations: unknown[] };
    try { plan = directSetLocal(freeText, channel, songCount, { recentGenreIds: [], recentHooks: [] }) as never; } catch { continue; }

    const genreAlloc = (plan.allocations as Array<{ axis: string; counts: Record<string, number> }>).find(a => a.axis === 'genre');
    const appliedGenreIds = genreAlloc ? Object.keys(genreAlloc.counts) : channel.preferredGenres;

    const base = { channel, projectTitle: freeText, songCount, customConcept: freeText };
    const optsNo = makeOptions({ ...base, genreIds: channel.preferredGenres } as Partial<GenerationOptions>) as GenerationOptions;
    // Step2Plan.tsx applyPlanToOptions 재현: genreIds + diversityAllocations
    const optsYes = makeOptions({ ...base, genreIds: appliedGenreIds, diversityAllocations: normalizeDiversityAllocations(plan.allocations as never) } as Partial<GenerationOptions>) as GenerationOptions;

    const run = (o: GenerationOptions, ids: string[]) => preallocateSongSlots(o, genrePacks.filter(g => ids.includes(g.id))) as unknown as Array<{ effectiveGenreIds: string[]; tempo: number }>;
    let sNo: ReturnType<typeof run>, sYes: ReturnType<typeof run>;
    try { sNo = run(optsNo, channel.preferredGenres); sYes = run(optsYes, appliedGenreIds); } catch { continue; }

    let a = 0, b = 0, c = 0, d = 0;
    for (let i = 0; i < songCount; i++) {
      tracks++;
      if ((plan.slots[i]?.genreId ?? '') !== (sNo[i]?.effectiveGenreIds?.[0] ?? '')) { gNo++; a++; }
      if ((plan.slots[i]?.genreId ?? '') !== (sYes[i]?.effectiveGenreIds?.[0] ?? '')) { gYes++; b++; }
      if (plan.slots[i]?.tempo !== sNo[i]?.tempo) { tNo++; c++; }
      if (plan.slots[i]?.tempo !== sYes[i]?.tempo) { tYes++; d++; }
    }
    rows.push(`${channel.id.padEnd(28)} 장르 불일치 미적용 ${String(a).padStart(2)}/12 → 적용 ${String(b).padStart(2)}/12    BPM 미적용 ${String(c).padStart(2)}/12 → 적용 ${String(d).padStart(2)}/12`);
  }
  console.warn = origWarn;
  console.log(rows.join('\n'));
  console.log(`\n트랙 ${tracks}개`);
  console.log(`  장르: [설계 적용] 안 누름 ${gNo} (${(gNo / tracks * 100).toFixed(1)}%)  →  누름 ${gYes} (${(gYes / tracks * 100).toFixed(1)}%)`);
  console.log(`  BPM : [설계 적용] 안 누름 ${tNo} (${(tNo / tracks * 100).toFixed(1)}%)  →  누름 ${tYes} (${(tYes / tracks * 100).toFixed(1)}%)`);
});
