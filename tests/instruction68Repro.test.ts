import { describe, it } from 'vitest';
import { buildLyricThemePlan } from '../src/core/lyricDiversityPlan';
import { hashSeed, seedForBlueprint } from '../src/core/lyricEngine';
import { channelPresets } from '../src/data/presets';

const ch: any = (channelPresets as any[]).find(c => c.id === 'showa-seventies');

// 실제 발행된 두 세트가 공통으로 가진 테마 시퀀스
const ACTUAL = [
  'showa70s-port-umbrella','showa70s-kissaten-letter','showa70s-record-shop',
  'showa70s-phone-booth-rain','showa70s-ferry-terminal','showa70s-onsen-lantern-town',
  'showa70s-matsuri-fireworks-riverside','showa70s-back-alley-izakaya',
  'showa70s-rooftop-laundry-line','showa70s-streetcar-tram-bell',
  'showa70s-riverside-bench-evening','showa70s-barber-shop-mirror',
  'showa70s-bathhouse-sento-towel','showa70s-countryside-grandmother-visit',
  'showa70s-lantern-paper-boat-river'
];

function probe(label: string, projectTitle: string, customConcept?: string) {
  const opts: any = { channel: ch, projectTitle, customConcept, songCount: 15, lyricLanguage: 'japanese' };
  const seed = hashSeed(seedForBlueprint(opts));
  const ids = buildLyricThemePlan(opts, seed);
  const match = ACTUAL.filter((id, i) => id === ids[i]).length;
  console.log(`${label} | projectTitle="${projectTitle}" | seed ${seed} | 실제 파일과 일치 ${match}/15`);
  console.log(`  ids: ${JSON.stringify(ids)}`);
  return ids;
}

describe('지시문 68 재현', () => {
  it('현재 상태 확인', () => {
    probe('Set Plan 상수', 'Set Plan');
    probe('컨셉 A', '친구와 즐거웠던 추억을 생각하며');
    probe('컨셉 B', '10월에 듣기좋은 노래');
  });
});
