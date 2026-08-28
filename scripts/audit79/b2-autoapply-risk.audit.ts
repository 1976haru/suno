/**
 * 지시문 79 TASK B-2 — 계획표를 자동 적용해도 되는가.
 *
 * 자동 적용의 구조적 위험을 실측한다: Step2Plan의 `plan`은 opts의 함수이고
 * (directSetLocal(..., userChoicesFromOptions(opts))), applyPlanToOptions는
 * 그 opts를 바꾼다(genreIds · diversityAllocations). 적용이 계획을 다시
 * 바꾸면 자동 적용은 되먹임이 된다.
 */
import { it } from 'vitest';
import { channelPresets } from '../../src/data/presets';
import { directSetLocal } from '../../src/core/setDirector';
import { userChoicesFromOptions } from '../../src/core/userChoices';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

it('auto-apply feedback risk', () => {
  const origWarn = console.warn;
  console.warn = () => {};
  const freeText = '늦은 밤에 듣는 노래';
  let changed = 0;
  let stable = 0;
  const rows: string[] = [];

  for (const channel of channelPresets) {
    const base = makeOptions({ channel, projectTitle: freeText, songCount: 12, customConcept: freeText, genreIds: channel.preferredGenres } as Partial<GenerationOptions>) as GenerationOptions;

    const planOf = (opts: GenerationOptions) => {
      const choices = userChoicesFromOptions(opts);
      return directSetLocal(freeText, opts.channel, opts.songCount, { recentGenreIds: [], recentHooks: [] },
        opts.selectedGenreFamilyIds ?? [], opts.vocalTone, opts.breadthOverride, opts.paletteFamilyOverride, choices
      ) as unknown as { slots: Array<{ genreId?: string }>; allocations: Array<{ axis: string; counts: Record<string, number> }> };
    };

    let plan1: ReturnType<typeof planOf>;
    try { plan1 = planOf(base); } catch { continue; }
    const alloc1 = plan1.allocations.find(a => a.axis === 'genre');
    const applied: GenerationOptions = { ...base, genreIds: alloc1 ? Object.keys(alloc1.counts) : base.genreIds };

    let plan2: ReturnType<typeof planOf>;
    try { plan2 = planOf(applied); } catch { continue; }
    const alloc2 = plan2.allocations.find(a => a.axis === 'genre');

    const a = JSON.stringify(alloc1?.counts ?? {});
    const b = JSON.stringify(alloc2?.counts ?? {});
    if (a === b) { stable += 1; } else {
      changed += 1;
      if (rows.length < 6) rows.push(`  ${channel.id}\n     1회차: ${a}\n     2회차: ${b}`);
    }
  }
  console.warn = origWarn;
  console.log('적용 후 계획이 다시 바뀌는가 (되먹임 위험):');
  console.log(rows.join('\n') || '  (없음)');
  console.log(`\n채널 ${stable + changed}개 — 계획 고정 ${stable} / 적용 후 계획이 달라짐 ${changed}`);

  // 지시문 79 §8의 실제 위험: 자동 적용이 사용자가 고른 장르를 덮어쓰는가.
  console.warn = () => {};
  let overwrite = 0;
  let same = 0;
  const diffs: string[] = [];
  for (const channel of channelPresets) {
    const base = makeOptions({ channel, projectTitle: freeText, songCount: 12, customConcept: freeText, genreIds: channel.preferredGenres } as Partial<GenerationOptions>) as GenerationOptions;
    let plan: { allocations: Array<{ axis: string; counts: Record<string, number> }> };
    try {
      plan = directSetLocal(freeText, channel, 12, { recentGenreIds: [], recentHooks: [] }, [], base.vocalTone, undefined, undefined, userChoicesFromOptions(base)) as never;
    } catch { continue; }
    const planned = Object.keys(plan.allocations.find(a => a.axis === 'genre')?.counts ?? {});
    const chosen = base.genreIds ?? [];
    const dropped = chosen.filter(id => !planned.includes(id));
    const added = planned.filter(id => !chosen.includes(id));
    if (dropped.length || added.length) {
      overwrite += 1;
      if (diffs.length < 8) diffs.push(`  ${channel.id.padEnd(28)} 사용자 선택 ${chosen.length}종 → 계획 ${planned.length}종 (빠짐 ${dropped.length}종, 새로 들어옴 ${added.length}종)`);
    } else {
      same += 1;
    }
  }
  console.warn = origWarn;
  console.log('\n자동 적용이 사용자의 장르 선택을 바꾸는가:');
  console.log(diffs.join('\n') || '  (없음)');
  console.log(`\n채널 ${overwrite + same}개 — 그대로 ${same} / 선택이 바뀜 ${overwrite}`);
});
