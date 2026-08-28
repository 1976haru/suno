import { it } from 'vitest';
/** §10-7 — fixed-pool vs concept-generated 가 단일세트/멀티세트에서 어떻게 갈리는가 (실행 확인) */
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../../src/data/presets';
import { buildClaudeCodeInstruction, buildMultiSetClaudeCodeMasterInstruction } from '../../src/core/bridgeInstruction';
import { preallocateSongSlots } from '../../src/core/batchPreallocation';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

it('scene mode', () => {
const origWarn = console.warn; console.warn = () => {};
const channel = channelPresets.find(c => c.id === 'headphones-down-low')!;
const genreIds = channel.preferredGenres.slice(0, 4);
const genres = genrePacks.filter(g => genreIds.includes(g.id));
const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
const season = seasonPacks.find(s => s.id === 'christmas')!;
const opts = makeOptions({ channel, projectTitle: 'Audit2 Scene', songCount: 6, genreIds, customConcept: '비 오는 날 창밖을 보는 늦은 오후' } as Partial<GenerationOptions>) as GenerationOptions;
const slots = preallocateSongSlots(opts, genres);

const ctx = { recentSituations: ['a'], recentLyricLines: ['b'], recentOpenings: ['c'] };
const single = buildClaudeCodeInstruction(opts, genres, moods, season, undefined, slots, false, {}, ctx);
const singleNoCtx = buildClaudeCodeInstruction(opts, genres, moods, season, undefined, slots, false, {}, undefined);
const master = buildMultiSetClaudeCodeMasterInstruction(opts, 2, 6, genres, moods, season, undefined, false);
console.warn = origWarn;

const pick = (t: string) => {
  const m = t.match(/scenePlanningMode[^\n]*/g);
  return m ? m.join(' | ') : '(문자열 없음)';
};
const txt = (x: unknown) => typeof x === 'string' ? x : (x as { instruction: string }).instruction;
console.log('단일세트 + conceptSceneContext 전달 :', pick(txt(single)));
console.log('단일세트 + 전달 안 함             :', pick(txt(singleNoCtx)));
console.log('멀티세트 마스터 (파라미터 자체 없음) :', pick(txt(master)));
console.log('\n장면 지시 문구 존재 여부:');
for (const [label, t] of [['단일+ctx', txt(single)], ['단일-ctx', txt(singleNoCtx)], ['마스터', txt(master)]] as const) {
  console.log(`  ${label.padEnd(10)} concept-generated=${t.includes('concept-generated')}  fixed-pool=${t.includes('fixed-pool')}  길이=${t.length}`);
}
});
