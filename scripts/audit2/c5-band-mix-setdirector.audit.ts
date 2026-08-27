/** §10-6 후속 — setDirector(directSetLocal, Step2Plan 경로)로 뽑을 때의 대역 혼재 */
import { it } from 'vitest';
import { channelPresets } from '../../src/data/presets';
import { directSetLocal } from '../../src/core/setDirector';

it('band mix via setDirector', () => {
  const origWarn = console.warn;
  console.warn = () => {};
  const rows: string[] = [];
  let sets = 0;
  let wide = 0;
  for (const channel of channelPresets.filter(c => c.archetype === 'en-chillhop')) {
    for (const freeText of ['늦은 밤 헤드폰', '비 오는 저녁', '주말 오후 드라이브', '창밖의 불빛', '조용한 새벽']) {
      let plan: { slots: Array<{ tempo: number; effectiveGenreIds: string[] }> };
      try { plan = directSetLocal(freeText, channel, 12, { recentGenreIds: [], recentHooks: [] }) as never; } catch (e) { rows.push(`ERR ${channel.id} ${String(e).slice(0, 80)}`); continue; }
      const tempos = plan.slots.map(s => s.tempo).sort((a, b) => a - b);
      const lo = tempos[0];
      const hi = tempos[tempos.length - 1];
      const ids = plan.slots.map(s => s.effectiveGenreIds[0]);
      const distinct = new Set(ids).size;
      const maxRepeat = Math.max(...[...new Set(ids)].map(g => ids.filter(x => x === g).length));
      sets++;
      const bad = lo <= 70 && hi >= 120;
      if (bad) wide++;
      rows.push(`${bad ? 'XX' : 'OK'} ${channel.id.padEnd(24)} "${freeText}"  BPM ${lo}~${hi} (폭 ${hi - lo})  고유 장르 ${distinct}종  최대 반복 ${maxRepeat}곡`);
    }
  }
  console.warn = origWarn;
  console.log(rows.join('\n'));
  console.log(`\n세트 ${sets}개 중 대역 혼재(<=70 & >=120) ${wide}개`);
});
