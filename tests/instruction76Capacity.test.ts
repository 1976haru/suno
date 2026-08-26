import { describe, expect, it } from 'vitest';
import {
  EN_CHILLHOP_BRIDGE_BAND_GENRE_IDS,
  EN_CHILLHOP_HOUSE_BAND_GENRE_IDS,
  EN_CHILLHOP_RAP_BAND_GENRE_IDS
} from '../src/data/genreLibrary';
import { allocateGenreCounts } from '../src/core/conceptAgent';
import { directSetLocal } from '../src/core/setDirector';
import { suitablePresetsForArchetype } from '../src/core/vocalRecommender';
import { channelPresets } from '../src/data/presets';
import { adultLyricThemes } from '../src/data/lyricThemes';
import { matchConceptRules } from '../src/data/conceptKeywords';

const SLOW_CONCEPTS: [string, string][] = [
  ['막차 놓친 밤', 'tokyo-night-headphones'],
  ['비 오는 밤 칠랩', 'headphones-down-low']
];
const FAST_CONCEPT: [string, string] = ['베이사이드 드라이브 딥하우스', 'harbour-line-house'];

function planFor(concept: string, channelId: string) {
  const channel = channelPresets.find(c => c.id === channelId)!;
  return directSetLocal(concept, channel, 12, { recentGenreIds: [], recentHooks: [] }) as any;
}
function counts(values: string[]): Map<string, number> {
  return values.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<string, number>());
}

describe('[지시문76 TASK A] 2대역 브리지', () => {
  it('브리지 3종은 지시문 75의 신설 3종이고 기존 두 대역 목록은 그대로다 (§10)', () => {
    expect([...EN_CHILLHOP_BRIDGE_BAND_GENRE_IDS]).toEqual([
      'en-chill-house-emotional', 'en-chill-deep-house', 'en-lounge-house'
    ]);
    expect(EN_CHILLHOP_RAP_BAND_GENRE_IDS).toHaveLength(6);
    expect(EN_CHILLHOP_HOUSE_BAND_GENRE_IDS).toHaveLength(6);
    // 브리지가 기존 두 목록 어디에도 들어가 있지 않아야 "소속을 바꾸지 않았다"가 성립한다.
    for (const id of EN_CHILLHOP_BRIDGE_BAND_GENRE_IDS) {
      expect(EN_CHILLHOP_RAP_BAND_GENRE_IDS as readonly string[]).not.toContain(id);
      expect(EN_CHILLHOP_HOUSE_BAND_GENRE_IDS as readonly string[]).not.toContain(id);
    }
  });

  it.each([...SLOW_CONCEPTS, FAST_CONCEPT])(
    '"%s" 12곡 세트 — 장르 8종 이상, 같은 장르 3곡 이상 없음 (§7·§9-7)',
    (concept, channelId) => {
      const slots: any[] = planFor(concept, channelId).slots;
      expect(slots).toHaveLength(12);
      const g = counts(slots.map(s => s.genreId));
      expect(g.size, `${concept}: 고유 장르`).toBeGreaterThanOrEqual(8);
      expect(Math.max(...g.values()), `${concept}: 최대 반복`).toBeLessThanOrEqual(2);
      expect(12 / g.size).toBeLessThanOrEqual(1.5);
    }
  );

  it('한 세트에 랩 대역과 하우스 대역이 함께 나오지 않는다 (§2.2·§10)', () => {
    for (const [concept, channelId] of [...SLOW_CONCEPTS, FAST_CONCEPT]) {
      const ids: string[] = (planFor(concept, channelId).slots as any[]).map(s => s.genreId);
      const hasRap = ids.some(id => (EN_CHILLHOP_RAP_BAND_GENRE_IDS as readonly string[]).includes(id));
      const hasHouse = ids.some(id => (EN_CHILLHOP_HOUSE_BAND_GENRE_IDS as readonly string[]).includes(id));
      expect(hasRap && hasHouse, `${concept}: 두 대역 혼재`).toBe(false);
    }
  });

  it('62 BPM과 128 BPM이 한 세트에 함께 나오지 않는다 (§7 회귀 금지)', () => {
    for (const [concept, channelId] of [...SLOW_CONCEPTS, FAST_CONCEPT]) {
      const tempos: number[] = (planFor(concept, channelId).slots as any[]).map(s => s.tempo);
      expect(Math.max(...tempos) - Math.min(...tempos), `${concept}: BPM 폭`).toBeLessThan(60);
    }
  });

  it('브리지가 세트를 지배하지 않는다 — 후보의 3/9인데 실제 배정은 그 이하 (§2.2)', () => {
    for (const [concept, channelId] of [...SLOW_CONCEPTS, FAST_CONCEPT]) {
      const ids: string[] = (planFor(concept, channelId).slots as any[]).map(s => s.genreId);
      const bridge = ids.filter(id => (EN_CHILLHOP_BRIDGE_BAND_GENRE_IDS as readonly string[]).includes(id)).length;
      expect(bridge / ids.length, `${concept}: 브리지 비중`).toBeLessThanOrEqual(3 / 9);
    }
  });
});

describe('[지시문76 TASK A] allocateGenreCounts 옵션', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  it('기본값은 예전 그대로다 — 순위 가중 + 1곡짜리 정리 (다른 워크스페이스 회귀 금지)', () => {
    const out = allocateGenreCounts(ids, 12);
    expect(out.reduce((s, x) => s + x.songCount, 0)).toBe(12);
    // 앞쪽에 몰리고 뒤쪽이 탈락하는 기존 동작.
    expect(out.length).toBeLessThanOrEqual(5);
  });

  it('evenSpread + keepSingletons면 8장르에 2,2,2,2,1,1,1,1로 나뉜다 (§7 1.5회)', () => {
    const out = allocateGenreCounts(ids, 12, [], { evenSpread: true, keepSingletons: true });
    expect(out).toHaveLength(8);
    expect(out.reduce((s, x) => s + x.songCount, 0)).toBe(12);
    expect(Math.max(...out.map(x => x.songCount))).toBe(2);
  });
});

describe('[지시문76 TASK B] 보컬 프리셋', () => {
  it('en-chillhop 12종 이상 · forKids 0종 (§7)', () => {
    const ps = suitablePresetsForArchetype('en-chillhop') as any[];
    expect(ps.length).toBeGreaterThanOrEqual(12);
    expect(ps.filter(p => p.forKids)).toHaveLength(0);
  });

  it('다른 아키타입 수는 그대로다 (§7 회귀 금지)', () => {
    expect(suitablePresetsForArchetype('oldpop-lounge')).toHaveLength(6);
    expect(suitablePresetsForArchetype('kr-2030-pop')).toHaveLength(7);
    expect(suitablePresetsForArchetype('kr-kids-song')).toHaveLength(10);
  });

  it('smoky-jazz-male은 넣지 않았다 — 프롬프트의 라운지 마이크 표지가 보컬 바닥과 부딪힌다 (§3.2)', () => {
    const ids = (suitablePresetsForArchetype('en-chillhop') as any[]).map(p => p.id);
    expect(ids).not.toContain('smoky-jazz-male');
    expect(ids).toContain('husky-jazz-female');
  });

  it('12곡 세트의 곡별 보컬 서술이 전부 다르다 (§7 "반복 1.0회 이하")', () => {
    for (const [concept, channelId] of [...SLOW_CONCEPTS, FAST_CONCEPT]) {
      const texts = (planFor(concept, channelId).slots as any[]).map(s => String(s.vocalText));
      expect(new Set(texts).size, `${concept}: 고유 보컬 서술`).toBe(12);
    }
  });
});

describe('[지시문76 TASK C] 일본 시장 채널 2종', () => {
  const en = (channelPresets as any[]).filter(c => c.archetype === 'en-chillhop');

  it('en-chillhop 채널 5개 · market=japan 2개 (§7)', () => {
    expect(en).toHaveLength(5);
    expect(en.filter(c => c.market === 'japan')).toHaveLength(2);
  });

  it('일본 채널의 primaryLanguage는 english다 (§4.2·§10)', () => {
    for (const c of en.filter(c => c.market === 'japan')) {
      expect(c.primaryLanguage, c.id).toBe('english');
    }
  });

  it('애니메이션·게임 작품 모방 금지가 forbiddenCliches에 있다 (§4.2)', () => {
    for (const c of en.filter(c => c.market === 'japan')) {
      const joined = c.forbiddenCliches.join(' | ');
      expect(joined, c.id).toMatch(/anime|game/i);
      expect(joined, c.id).toContain('signature hook of an existing song');
    }
  });

  it('두 채널의 preferredGenres가 서로 다른 대역으로 기운다 (§4.1)', () => {
    const tokyo = en.find(c => c.id === 'tokyo-night-headphones')!;
    const harbour = en.find(c => c.id === 'harbour-line-house')!;
    const rap = (id: string) => (EN_CHILLHOP_RAP_BAND_GENRE_IDS as readonly string[]).includes(id);
    const house = (id: string) => (EN_CHILLHOP_HOUSE_BAND_GENRE_IDS as readonly string[]).includes(id);
    expect(tokyo.preferredGenres.filter(rap).length).toBeGreaterThan(tokyo.preferredGenres.filter(house).length);
    expect(harbour.preferredGenres.filter(house).length).toBeGreaterThan(harbour.preferredGenres.filter(rap).length);
  });

  it('기존 채널 3종은 그대로다 (§10)', () => {
    const before = en.find(c => c.id === 'after-hours-deep-house')!;
    expect(before.market).toBe('global');
    expect(before.preferredGenres).toEqual(['en-deep-house-melodic', 'en-deep-house-organic', 'en-house-garage-swing', 'alt-rnb']);
  });
});

describe('[지시문76 TASK D] 테마 풀 70개', () => {
  const en = (adultLyricThemes as any[]).filter(t => (t.suitedArchetypes ?? []).includes('en-chillhop'));
  const showa = (adultLyricThemes as any[]).filter(t => (t.suitedArchetypes ?? []).includes('showa-70s'));

  it('70개 · frameId 누락 0개 (§7)', () => {
    expect(en).toHaveLength(70);
    expect(en.filter(t => !t.frameId)).toHaveLength(0);
  });

  it('한 프레임에 7개 이상 몰리지 않는다 (§7)', () => {
    const m = counts(en.map(t => String(t.frameId)));
    expect(Math.max(...m.values())).toBeLessThanOrEqual(7);
  });

  it('새 프레임을 만들지 않았다 — 12개 그대로 (§5.2)', () => {
    expect(new Set(en.map(t => t.frameId)).size).toBe(12);
  });

  it('신규 24개는 전부 일본 접두어를 갖고 기존 46개는 손대지 않았다 (§10 "추가만 한다")', () => {
    expect(en.filter(t => t.id.startsWith('enchillhop-jp-'))).toHaveLength(24);
    expect(en.filter(t => !t.id.startsWith('enchillhop-jp-'))).toHaveLength(46);
  });

  it('showa-70s 36개는 변동 없고 장면이 겹치지 않는다 (§7 회귀 금지)', () => {
    expect(showa).toHaveLength(36);
    const showaScenes = new Set(showa.map(t => String(t.scene)));
    for (const t of en.filter(x => x.id.startsWith('enchillhop-jp-'))) {
      expect(showaScenes.has(String(t.scene)), t.id).toBe(false);
    }
  });

  it('테마 id가 전부 고유하다', () => {
    expect(new Set(en.map(t => t.id)).size).toBe(70);
  });
});

describe('[지시문76 TASK E] 일본 도시 컨셉 규칙', () => {
  const NEW_RULE_IDS = [
    'enchillhop-jp-city-night', 'enchillhop-jp-last-train', 'enchillhop-jp-convenience-night',
    'enchillhop-jp-shopping-arcade', 'enchillhop-jp-bayside-drive', 'enchillhop-jp-karaoke-night'
  ];

  it.each([
    ['일본 도시', 'enchillhop-jp-city-night'],
    ['막차', 'enchillhop-jp-last-train'],
    ['편의점', 'enchillhop-jp-convenience-night'],
    ['상점가', 'enchillhop-jp-shopping-arcade'],
    ['베이사이드', 'enchillhop-jp-bayside-drive'],
    ['노래방', 'enchillhop-jp-karaoke-night']
  ])('"%s" → %s', (query, ruleId) => {
    expect((matchConceptRules(query) as any[]).map(r => r.id)).toContain(ruleId);
  });

  it('6종 전부 archetypeScope가 en-chillhop 단독이다 (§6)', () => {
    for (const id of NEW_RULE_IDS) {
      const rule = (matchConceptRules('일본 도시 막차 편의점 상점가 베이사이드 노래방') as any[]).find(r => r.id === id);
      expect(rule, id).toBeTruthy();
      expect(rule.archetypeScope, id).toEqual(['en-chillhop']);
    }
  });

  it('"도쿄" 단독은 다른 워크스페이스 규칙을 뺏지 않는다 (§6 "다른 워크스페이스로 새지 않는지")', () => {
    const ids = (matchConceptRules('도쿄') as any[]).map(r => r.id);
    expect(ids).toContain('jp2030-citypop');
    for (const id of NEW_RULE_IDS) expect(ids).not.toContain(id);
  });
});
