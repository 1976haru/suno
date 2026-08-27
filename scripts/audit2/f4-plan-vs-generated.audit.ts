/** 유형 F — Step2Plan의 "18곡 계획" 표(plan.slots)와, [설계 적용]을 누르지 않고 생성했을 때의 실제 배정 대조 */
import { it } from 'vitest';
import { channelPresets, genrePacks } from '../../src/data/presets';
import { directSetLocal } from '../../src/core/setDirector';
import { preallocateSongSlots } from '../../src/core/batchPreallocation';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

it('plan table vs generated', () => {
  const origWarn = console.warn;
  console.warn = () => {};
  const rows: string[] = [];
  let sets = 0;
  let genreMismatchTracks = 0;
  let tempoMismatchTracks = 0;
  let vocalMismatchTracks = 0;
  let totalTracks = 0;

  for (const channel of channelPresets) {
    const freeText = '늦은 밤에 듣는 노래';
    const songCount = 12;
    // Step2Plan 화면이 표로 보여주는 것 (freeText = customConcept || projectTitle)
    let plan: { slots: Array<{ trackNo: number; genreId?: string; tempo: number; vocalType?: string; structureTemplate?: string }> };
    try { plan = directSetLocal(freeText, channel, songCount, { recentGenreIds: [], recentHooks: [] }) as never; } catch { continue; }

    // [설계 적용]을 누르지 않은 상태로 Step3이 실제로 부르는 것
    const opts = makeOptions({ channel, projectTitle: freeText, songCount, genreIds: channel.preferredGenres, customConcept: freeText } as Partial<GenerationOptions>) as GenerationOptions;
    let slots: Array<{ trackNo: number; effectiveGenreIds: string[]; tempo: number; vocalType?: string }>;
    try { slots = preallocateSongSlots(opts, genrePacks.filter(g => channel.preferredGenres.includes(g.id))) as never; } catch { continue; }

    sets++;
    let g = 0, t = 0, v = 0;
    for (let i = 0; i < Math.min(plan.slots.length, slots.length); i++) {
      totalTracks++;
      if ((plan.slots[i].genreId ?? '') !== (slots[i].effectiveGenreIds?.[0] ?? '')) { g++; genreMismatchTracks++; }
      if (plan.slots[i].tempo !== slots[i].tempo) { t++; tempoMismatchTracks++; }
      if ((plan.slots[i].vocalType ?? '') !== (slots[i].vocalType ?? '')) { v++; vocalMismatchTracks++; }
    }
    const planGenres = new Set(plan.slots.map(s => s.genreId));
    const genGenres = new Set(slots.map(s => s.effectiveGenreIds?.[0]));
    rows.push(`${channel.id.padEnd(28)} 장르 불일치 ${String(g).padStart(2)}/12  BPM ${String(t).padStart(2)}/12  보컬 ${String(v).padStart(2)}/12   표의 장르 ${planGenres.size}종 → 실제 ${genGenres.size}종`);
  }
  console.warn = origWarn;
  console.log(rows.join('\n'));
  console.log(`\n채널 ${sets}개 / 트랙 ${totalTracks}개`);
  console.log(`  표의 장르와 실제 배정이 다른 트랙 : ${genreMismatchTracks} (${(genreMismatchTracks / totalTracks * 100).toFixed(1)}%)`);
  console.log(`  표의 BPM과 실제가 다른 트랙       : ${tempoMismatchTracks} (${(tempoMismatchTracks / totalTracks * 100).toFixed(1)}%)`);
  console.log(`  표의 보컬과 실제가 다른 트랙      : ${vocalMismatchTracks} (${(vocalMismatchTracks / totalTracks * 100).toFixed(1)}%)`);
});
