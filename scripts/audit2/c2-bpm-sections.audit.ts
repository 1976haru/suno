/** §10-5 — 지시문 74 TASK A의 BPM 구간별 섹션 하한이 실제 생성물에 적용되는가 */
import { it } from 'vitest';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../../src/data/presets';
import { generateLocalBlueprint } from '../../src/core/localGenerator';
import { minTotalSectionsForBpm } from '../../src/core/bpmLengthControl';
import { makeOptions } from '../../tests/fixtures';
import type { GenerationOptions } from '../../src/types';

const SECTION_MARK = /^\[([^\]]+)\]/gm;
// [female vocal] / [male vocal] 등 보컬 지시 태그는 섹션이 아니다.
const NOT_A_SECTION = /vocal\]?$|^female|^male|^duet|^mixed/i;

it('bpm section floor', () => {
  const origWarn = console.warn;
  console.warn = () => {};
  const rows: string[] = [];
  const byBand = new Map<string, { n: number; viol: number; minSeen: number; maxSeen: number }>();
  let total = 0;
  let violations = 0;

  for (const channel of channelPresets) {
    const genreIds = channel.preferredGenres.slice(0, 5);
    const opts = makeOptions({ channel, projectTitle: 'Audit2 BPM', songCount: 12, genreIds } as Partial<GenerationOptions>) as GenerationOptions;
    let bp: { songs: Array<Record<string, unknown>> };
    try {
      bp = generateLocalBlueprint(
        opts,
        genrePacks.filter(g => genreIds.includes(g.id)),
        moodPacks.filter(m => channel.preferredMoods.includes(m.id)),
        seasonPacks.find(s => s.id === opts.seasonId)
      ) as never;
    } catch {
      continue;
    }
    for (const song of bp.songs) {
      const bpm = Number(song.bpm ?? 0);
      const lyrics = String(song.lyrics ?? '');
      const marks = [...lyrics.matchAll(SECTION_MARK)].map(m => m[1].trim());
      const sections = marks.filter(m => !NOT_A_SECTION.test(m)).length;
      const floor = minTotalSectionsForBpm(bpm);
      if (!floor) continue;
      total++;
      const band = bpm <= 110 ? '96-110(>=9)' : bpm <= 125 ? '111-125(>=11)' : '126+(>=13)';
      const e = byBand.get(band) ?? { n: 0, viol: 0, minSeen: 99, maxSeen: 0 };
      e.n++;
      e.minSeen = Math.min(e.minSeen, sections);
      e.maxSeen = Math.max(e.maxSeen, sections);
      if (sections < floor) {
        e.viol++;
        violations++;
        if (rows.length < 12) rows.push(`  ${channel.id} 트랙 ${song.trackNo} BPM ${bpm} 섹션 ${sections} < 하한 ${floor}  [${marks.join(' > ')}]`);
      }
      byBand.set(band, e);
    }
  }
  console.warn = origWarn;
  console.log(`BPM 96 이상 곡 ${total}개 중 섹션 하한 미달 ${violations}개`);
  for (const [band, e] of byBand) console.log(`  ${band.padEnd(15)} ${e.n}곡  미달 ${e.viol}  실측 섹션 ${e.minSeen}~${e.maxSeen}`);
  console.log(rows.join('\n'));
});
