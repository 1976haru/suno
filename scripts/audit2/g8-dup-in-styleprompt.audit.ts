/** 지시문 78 신설 프리셋의 onset 절 중복이 최종 stylePrompt까지 살아남는가 */
import { it } from 'vitest';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../../src/data/presets';
import { generateLocalBlueprint } from '../../src/core/localGenerator';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

const PHRASES = ['audible fold rasp', 'lowered larynx', 'soft glottal onset', 'firm glottal closure', 'even unforced onset'];

it('duplicate onset clause in stylePrompt', () => {
  const origWarn = console.warn;
  console.warn = () => {};
  let songs = 0, dupVocalText = 0, dupStylePrompt = 0, warned = 0;
  const samples: string[] = [];
  for (const channel of channelPresets) {
    const genreIds = channel.preferredGenres.slice(0, 5);
    for (const concept of ['허스키한 목소리로 부르는 노래', '어두운 목소리로 부르는 노래', '숨소리 섞인 목소리로 부르는 노래']) {
      const opts = makeOptions({ channel, projectTitle: 'Audit2 DupSP', songCount: 6, genreIds, customConcept: concept } as Partial<GenerationOptions>) as GenerationOptions;
      let bp: { songs: Array<{ vocalText?: string; stylePrompt: string; warnings?: string[]; trackNo?: number }> };
      try {
        bp = generateLocalBlueprint(opts, genrePacks.filter(g => genreIds.includes(g.id)),
          moodPacks.filter(m => channel.preferredMoods.includes(m.id)),
          seasonPacks.find(s => s.id === opts.seasonId)) as never;
      } catch { continue; }
      for (const song of bp.songs) {
        songs++;
        const vt = song.vocalText ?? '';
        const sp = song.stylePrompt;
        for (const ph of PHRASES) {
          const inVt = vt.split(ph).length - 1;
          const inSp = sp.split(ph).length - 1;
          if (inVt >= 2) dupVocalText++;
          if (inSp >= 2) {
            dupStylePrompt++;
            if ((song.warnings ?? []).some(w => w.includes('중복된 절'))) warned++;
            if (samples.length < 5) samples.push(`  ${channel.id} "${concept}" 트랙 ${song.trackNo}\n     vocalText : ${vt}\n     경고 있음 : ${(song.warnings ?? []).some(w => w.includes('중복된 절'))}`);
          }
        }
      }
    }
  }
  console.warn = origWarn;
  console.log(`곡 ${songs}개`);
  console.log(`  vocalText에 onset 절이 2회 이상   : ${dupVocalText}`);
  console.log(`  최종 stylePrompt에 2회 이상 살아남음: ${dupStylePrompt} (그중 중복 경고를 받은 곡 ${warned})`);
  console.log(samples.join('\n'));
});
