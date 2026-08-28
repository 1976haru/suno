/** 발성 어휘가 최종 stylePrompt에 실리는 경로 판별: 프리셋 선택 vs 컨셉 지목 vs 자유 텍스트 */
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../../src/data/presets';
import { generateLocalBlueprint } from '../../src/core/localGenerator';
import { vocalPresets } from '../../src/data/vocalPresets';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';
const VOCAB = ['forward mask resonance', 'clean fold closure', 'soft glottal onset', 'firm glottal closure', 'audible fold rasp', 'low breath pressure', 'breath between phrases'];
const origWarn = console.warn; console.warn = () => {};

function run(label: string, channelId: string, tone: string | undefined, concept: string) {
  const channel = channelPresets.find(c => c.id === channelId)!;
  const genreIds = channel.preferredGenres.slice(0, 5);
  const opts = makeOptions({ channel, projectTitle: 'Audit2 Paths', songCount: 8, genreIds, customConcept: concept, ...(tone ? { vocalTone: tone } : {}) } as Partial<GenerationOptions>) as GenerationOptions;
  const bp: any = generateLocalBlueprint(opts, genrePacks.filter(g => genreIds.includes(g.id)), moodPacks.filter(m => channel.preferredMoods.includes(m.id)), seasonPacks.find(s => s.id === opts.seasonId));
  let hits = 0; const found = new Set<string>();
  for (const s of bp.songs) {
    const all = Object.values(s).filter(v => typeof v === 'string').join(' | ');
    for (const v of VOCAB) if (all.includes(v)) { hits++; found.add(v); }
  }
  console.log(`${label.padEnd(48)} 8곡 중 적중 ${hits}회  ${[...found].join(', ') || '(없음)'}`);
  console.log(`   vocalText[0]: ${bp.songs[0].vocalText}`);
}

const clm = vocalPresets.find(v => v.id === 'clear-light-male')!;
run('A. 프리셋 선택(clear-light-male) · 컨셉 없음', 'good-morning-memory-radio', clm.prompt, '');
run('B. 컨셉 지목(숨소리) · 톤 기본', 'after-hours-deep-house', undefined, '숨소리 섞인 목소리로 부르는 칠 딥하우스');
run('C. 컨셉 지목(허스키) · 톤 기본', 'headphones-down-low', undefined, '허스키한 목소리로 부르는 칠 랩');
run('D. 자유 텍스트(프리셋 아님)', 'good-morning-memory-radio', 'a completely custom made-up vocal description', '');
console.warn = origWarn;
