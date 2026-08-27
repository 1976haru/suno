import { describe, expect, it } from 'vitest';
import { EN_CHILLHOP_CORE_GENRE_IDS, getGenreById, getCoreGenreIdsForArchetype } from '../src/data/genreLibrary';
import { GENRE_WORKSPACE_OWNERSHIP } from '../src/data/genreWorkspaceOwnership';
import { matchConceptRules } from '../src/data/conceptKeywords';
import { eraCanonPalettesForGenreId } from '../src/data/eraCanonPalettes';
import { eraBucketsForGenreId, eraNoteKoForGenreId } from '../src/data/eraBuckets';
import { suitablePresetsForArchetype } from '../src/core/vocalRecommender';
import { recommendConceptLocal } from '../src/core/conceptAgent';

const NEW_IDS = ['en-chill-house-emotional', 'en-chill-deep-house', 'en-lounge-house'] as const;
const EXISTING_HOUSE_IDS = [
  'en-deep-house-melodic', 'en-deep-house-organic', 'en-house-garage-swing',
  'en-deep-house-vocal-anthem', 'en-deep-house-tech-groove', 'en-deep-house-soulful'
] as const;

/** 매칭된 모든 규칙의 genreWeights를 합산한다 — core/conceptAgent.ts의 실제 동작과 같다. */
function genreWeightsFor(text: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const rule of matchConceptRules(text) as any[]) {
    for (const [id, weight] of Object.entries(rule.genreWeights ?? {})) {
      totals.set(id, (totals.get(id) ?? 0) + (weight as number));
    }
  }
  return totals;
}

describe('[지시문75 TASK A] 신설 3종 — 정의와 상호 구분', () => {
  it('en-chillhop 코어가 12종 → 15종이 된다', () => {
    expect(EN_CHILLHOP_CORE_GENRE_IDS).toHaveLength(15);
    for (const id of NEW_IDS) expect(EN_CHILLHOP_CORE_GENRE_IDS).toContain(id);
    expect(getCoreGenreIdsForArchetype('en-chillhop')).toHaveLength(15);
  });

  it('BPM 99~107 공백이 메워진다 — 이 지시문의 출발점', () => {
    // 기존 12종은 랩 62~98 / 하우스 108~128이라 99~107이 통째로 비어 있었다.
    const covers = (bpm: number, ids: readonly string[]) =>
      ids.some(id => {
        const { tempo } = getGenreById(id) as any;
        return tempo[0] <= bpm && bpm <= tempo[1];
      });
    const existing = EN_CHILLHOP_CORE_GENRE_IDS.filter(id => !(NEW_IDS as readonly string[]).includes(id));
    for (let bpm = 99; bpm <= 107; bpm += 1) {
      expect(covers(bpm, existing), `기존 12종이 ${bpm}을 덮으면 이 지시문의 전제가 틀린 것`).toBe(false);
      expect(covers(bpm, NEW_IDS), `${bpm} BPM`).toBe(true);
    }
  });

  it('moods가 기존 12종과 한 개도 겹치지 않는다 (§3.2-③)', () => {
    const existing = new Set(EN_CHILLHOP_CORE_GENRE_IDS
      .filter(id => !(NEW_IDS as readonly string[]).includes(id))
      .flatMap(id => (getGenreById(id) as any).moods as string[]));
    for (const id of NEW_IDS) {
      for (const mood of (getGenreById(id) as any).moods as string[]) {
        expect(existing.has(mood), `${id}: ${mood}`).toBe(false);
      }
    }
  });

  it('production에 클럽 계열 표현을 재사용하지 않는다 (§11)', () => {
    for (const id of NEW_IDS) {
      for (const clause of (getGenreById(id) as any).production as string[]) {
        expect(clause.toLowerCase(), `${id}: ${clause}`).not.toContain('club');
      }
    }
  });

  it('vocal 필드에 언어 단어를 쓰지 않는다 (§3.3) — 지시문 76이 일본 채널을 붙인다', () => {
    for (const id of NEW_IDS) {
      for (const clause of (getGenreById(id) as any).vocal as string[]) {
        expect(clause.toLowerCase(), `${id}: ${clause}`).not.toMatch(/\benglish\b|\bjapanese\b|\bkorean\b/);
      }
    }
  });

  it('Chill Deep House는 완전 인스트루멘탈이 아니다 (§3.2-②) — 가사 파이프라인과 충돌한다', () => {
    const vocal = (getGenreById('en-chill-deep-house') as any).vocal as string[];
    expect(vocal.length).toBeGreaterThan(0);
    expect(vocal.join(' ').toLowerCase()).not.toContain('no full lyric lead');
  });

  it('9종(기존 6 + 신설 3) 중 어느 두 장르도 rhythm/production/vocal/moods 네 축이 모두 겹치지 않는다 (§3.5)', () => {
    const ids = [...EXISTING_HOUSE_IDS, ...NEW_IDS];
    const axisWords = (id: string, axis: 'rhythm' | 'production' | 'vocal' | 'moods') =>
      new Set(((getGenreById(id) as any)[axis] as string[])
        .join(' ').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3));
    const overlap = (a: Set<string>, b: Set<string>) => {
      const shared = [...a].filter(w => b.has(w)).length;
      return shared / Math.max(1, Math.min(a.size, b.size));
    };
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const axes = (['rhythm', 'production', 'vocal', 'moods'] as const)
          .map(axis => overlap(axisWords(ids[i], axis), axisWords(ids[j], axis)));
        // 네 축이 전부 절반 넘게 겹치면 같은 장르를 두 번 쓴 것이다.
        expect(axes.every(score => score > 0.5), `${ids[i]} vs ${ids[j]}`).toBe(false);
      }
    }
  });
});

describe('[지시문75 TASK B] 컨셉 지목 — 신설 3종', () => {
  it.each([
    ['칠 하우스', 'en-chill-house-emotional'],
    ['chill house', 'en-chill-house-emotional'],
    ['감성 하우스', 'en-chill-house-emotional'],
    ['이모셔널 하우스', 'en-chill-house-emotional'],
    ['칠 딥하우스', 'en-chill-deep-house'],
    ['chill deep house', 'en-chill-deep-house'],
    ['라운지 하우스', 'en-lounge-house'],
    ['lounge house', 'en-lounge-house']
  ])('"%s" → %s가 최고 가중치', (query, expected) => {
    const totals = [...genreWeightsFor(query).entries()].sort((a, b) => b[1] - a[1]);
    expect(totals[0][0], query).toBe(expected);
  });

  it('"딥하우스"/"deep house"에는 신설 3종이 섞이지 않는다 (§4.2)', () => {
    for (const query of ['딥하우스', 'deep house']) {
      const ids = [...genreWeightsFor(query).keys()];
      for (const id of NEW_IDS) expect(ids, `${query} → ${id}`).not.toContain(id);
    }
  });

  it('"칠 딥하우스"는 포괄어 규칙에도 함께 걸리지만 신설 장르가 이긴다 (§4.2 예외)', () => {
    const ruleIds = (matchConceptRules('칠 딥하우스') as any[]).map(r => r.id);
    expect(ruleIds).toContain('enchillhop-deep-house');
    expect(ruleIds).toContain('enchillhop-chill-deep-house');
    const totals = genreWeightsFor('칠 딥하우스');
    expect(totals.get('en-chill-deep-house')!).toBeGreaterThan(totals.get('en-deep-house-melodic')!);
  });

  it.each(['감성적인 노래', '라운지에서 쉬며', '우리 집 house', 'a house with a garden'])(
    '오탐 없음 — "%s"는 신설 3종을 지목하지 않는다',
    query => {
      const ids = [...genreWeightsFor(query).keys()];
      for (const id of NEW_IDS) expect(ids, query).not.toContain(id);
    }
  );

  it('단독 "하우스"/"house"/"감성"/"라운지"는 신설 장르를 지목하지 않는다 (§4.1)', () => {
    for (const query of ['하우스', 'house', '감성', '라운지']) {
      const ids = [...genreWeightsFor(query).keys()];
      for (const id of NEW_IDS) expect(ids, query).not.toContain(id);
    }
  });
});

describe('[지시문75 TASK C] 감정 서사 라우팅', () => {
  it.each(['고백', '이별', '재회'])('"%s"가 en-chill-house-emotional에 가중치를 준다', concept => {
    const totals = genreWeightsFor(concept);
    expect(totals.get('en-chill-house-emotional')).toBeGreaterThan(0);
    expect(totals.get('en-deep-house-melodic')).toBeGreaterThan(0);
  });

  it('세 컨셉 모두 vocal-anthem보다 chill-house-emotional을 앞세운다 — §5의 목적', () => {
    for (const concept of ['고백', '이별', '재회']) {
      const totals = genreWeightsFor(concept);
      const anthem = totals.get('en-deep-house-vocal-anthem') ?? 0;
      expect(totals.get('en-chill-house-emotional')!, concept).toBeGreaterThan(anthem);
    }
  });
});

describe('[지시문75 TASK D] 등록', () => {
  it('워크스페이스 소유가 en-chillhop으로 잡힌다', () => {
    for (const id of NEW_IDS) expect(GENRE_WORKSPACE_OWNERSHIP[id], id).toEqual(['en-chillhop']);
  });

  it('3종 모두 팔레트를 받는다 — canon-chill-lounge-house (§3.4)', () => {
    for (const id of NEW_IDS) {
      const palettes = eraCanonPalettesForGenreId(id);
      expect(palettes.length, id).toBeGreaterThan(0);
      expect(palettes.map(p => p.id), id).toContain('canon-chill-lounge-house');
    }
  });

  it('클럽 팔레트에는 붙이지 않았다 — productionTraits가 정의와 부딪힌다 (§3.4 판단)', () => {
    for (const id of NEW_IDS) {
      expect(eraCanonPalettesForGenreId(id).map(p => p.id), id).not.toContain('canon-deep-house-club');
    }
  });

  it('eraBuckets/eraNoteKo가 부여돼 있다', () => {
    for (const id of NEW_IDS) {
      expect(eraBucketsForGenreId(id), id).toEqual(['2010s', '2020s']);
      expect(eraNoteKoForGenreId(id), id).toBeTruthy();
    }
  });

  it('다른 아키타입의 보컬 프리셋 수는 그대로다 (§8 회귀 금지)', () => {
    // 지시문 76 (TASK B)이 en-chillhop만 8 → 12로 늘렸다(주 3회 운영에서
    // 장르보다 보컬이 먼저 병목이 된다는 §1.3 실측). 나머지 셋은 그때도
    // 회귀 금지선이라 여기서 계속 고정한다.
    // 지시문 78 — 성인 아키타입의 수치는 그 지시문이 **의도적으로** 올렸다
    // (belted/dark 축이 전 워크스페이스 0종이던 실측의 수정, §6.2 "아키타입별
    // 8종 이상"). 동요 10종은 78의 회귀 금지선이기도 하므로 그대로 고정한다.
    expect(suitablePresetsForArchetype('oldpop-lounge')).toHaveLength(12);
    expect(suitablePresetsForArchetype('kr-2030-pop')).toHaveLength(16);
    expect(suitablePresetsForArchetype('kr-kids-song')).toHaveLength(10);
  });

  it('컨셉 "칠 하우스"가 실제 추천에서 신설 장르로 배분된다 — 도달 가능성', () => {
    const rec: any = recommendConceptLocal('칠 하우스', 'en-chillhop', undefined, 0, 12);
    const alloc = rec.recommendations[0].genreAllocation as { genreId: string; songCount: number }[];
    const picked = alloc.map(a => a.genreId);
    expect(picked).toContain('en-chill-house-emotional');
    expect(alloc.reduce((sum, a) => sum + a.songCount, 0)).toBe(12);
  });
});
