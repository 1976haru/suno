import { describe, expect, it } from 'vitest';
import { directSetLocal } from '../src/core/setDirector';
import { userChoicesFromOptions } from '../src/core/userChoices';
import { channelPresets, makeOptions } from './fixtures';

/**
 * 지시문 24 (TASK A) — 재현 케이스. 하루가 실제로 막혔던 정확한 시나리오:
 * oldpop-lounge-main 채널 · "70년대 올드팝" 컨셉 · adult-contemporary/
 * healing-ballad/piano-ballad/retro-soul-pop 4종 직접 선택. Step2Plan.tsx:171
 * 이 호출하는 것과 정확히 같은 인자 순서(freeText, channel, songCount,
 * history, familyIds, vocalTone, breadthOverride, paletteFamilyOverride,
 * userChoicesFromOptions(opts))로 directSetLocal을 호출한다 — 재현이 아니라
 * 실제 프로덕션 호출 경로 그 자체.
 */
const channel = channelPresets.find(c => c.id === 'oldpop-lounge-main')!;
const USER_GENRE_IDS = ['adult-contemporary', 'healing-ballad', 'piano-ballad', 'retro-soul-pop'];

function buildChoices(listeningIntent?: 'long-listen-comfort' | 'balanced' | 'era-authentic') {
  const opts = makeOptions({
    channel,
    songCount: 18,
    genreIds: USER_GENRE_IDS,
    choiceProvenance: { genreIds: 'user' },
    ...(listeningIntent ? { listeningIntent } : {})
  });
  return { opts, choices: userChoicesFromOptions(opts) };
}

describe('지시문 24 TASK A — 인수 기준: 재현 케이스가 통과한다', () => {
  it('사용자 선택 4종이 checkUserChoicesPreservation을 throw 없이 통과하고 전부 설계에 쓰인다', () => {
    const { choices } = buildChoices();
    expect(choices.source.genreIds).toBe('user');
    expect(choices.genreIds).toEqual(USER_GENRE_IDS);

    let plan;
    expect(() => {
      plan = directSetLocal(
        '70년대 올드팝',
        channel,
        18,
        { recentGenreIds: [], recentHooks: [] },
        [],
        undefined,
        undefined,
        undefined,
        choices
      );
    }).not.toThrow();

    const genreAxis = plan!.allocations.find(a => a.axis === 'genre')!;
    const genreIdsUsed = Object.keys(genreAxis.counts);
    for (const id of USER_GENRE_IDS) {
      expect(genreIdsUsed, `${id} must be used`).toContain(id);
      expect(genreAxis.counts[id]).toBeGreaterThan(0);
    }
  });

  for (const intent of ['long-listen-comfort', 'balanced', 'era-authentic'] as const) {
    it(`청취 목적 "${intent}"에서도 사용자 선택 4종이 throw 없이 전부 반영된다`, () => {
      const { choices } = buildChoices(intent);
      let plan;
      expect(() => {
        plan = directSetLocal('70년대 올드팝', channel, 18, { recentGenreIds: [], recentHooks: [] }, [], undefined, undefined, undefined, choices);
      }).not.toThrow();
      const genreAxis = plan!.allocations.find(a => a.axis === 'genre')!;
      for (const id of USER_GENRE_IDS) {
        expect(Object.keys(genreAxis.counts), `${intent}: ${id} must be used`).toContain(id);
      }
    });
  }
});

describe('지시문 24 TASK A — era-unspecified 경로(실제 라이브 브라우저 재현): freeText가 시대를 감지시키지 않아도 사용자 선택 5종이 전부 살아남는다', () => {
  // 실제 라이브 검증에서 "70년대 올드팝"을 입력했음에도 interpretation이
  // "시대 — 감지 안 됨"으로 뜬 그 상태를 그대로 재현한다(freeText=''). 이
  // 시나리오에서만 발현된 2단계 결함: (1) conceptAgent.ts의
  // allocateGenreCounts 내부 enforceMinimumGenreCount가 1곡짜리 사용자 선택
  // 장르(chanson)를 다른 장르에 병합해 조용히 지웠고, (2) setDirector.ts의
  // capCompatibleFamilySongs가 mainFamilyId에 속하지 않는 "호환" 장르
  // 묶음(piano-ballad+chanson)의 합이 cap(5)을 넘는다는 이유로 그 중
  // 하나(piano-ballad)까지 통째로 삭제했다 — 둘 다 어떤 경고도 없었다.
  const genreIds = ['piano-ballad', 'healing-ballad', 'adult-contemporary', 'acoustic-pop', 'chanson'];
  it('freeText가 비어 있어 시대가 감지되지 않아도(eraConstraint.unspecified) 사용자 선택 5종이 전부 설계에 쓰인다', () => {
    const opts = makeOptions({ channel, songCount: 18, genreIds, choiceProvenance: { genreIds: 'user' } });
    const choices = userChoicesFromOptions(opts);
    let plan;
    expect(() => {
      plan = directSetLocal('', channel, 18, { recentGenreIds: [], recentHooks: [] }, [], undefined, undefined, undefined, choices);
    }).not.toThrow();
    const eraAxis = plan!.interpretation.axisCoverage.find(a => a.axis === 'era');
    expect(eraAxis?.detected).toBe(false);
    const genreAxis = plan!.allocations.find(a => a.axis === 'genre')!;
    const used = Object.keys(genreAxis.counts);
    for (const id of genreIds) {
      expect(used, `${id} must survive the era-unspecified path`).toContain(id);
      expect(genreAxis.counts[id]).toBeGreaterThan(0);
    }
    expect(Object.values(genreAxis.counts).reduce((a, b) => a + b, 0)).toBe(18);
  });
});

describe('지시문 24 TASK A-3 — 사용자가 2종만 선택했을 때 부족분 자동 보완', () => {
  it('2종 선택 시 나머지가 키워드 추론으로 보완되고, 사용자 선택 2종은 그대로 남는다', () => {
    const opts = makeOptions({
      channel,
      songCount: 18,
      genreIds: ['adult-contemporary', 'healing-ballad'],
      choiceProvenance: { genreIds: 'user' }
    });
    const choices = userChoicesFromOptions(opts);
    const plan = directSetLocal('70년대 올드팝', channel, 18, { recentGenreIds: [], recentHooks: [] }, [], undefined, undefined, undefined, choices);
    const genreAxis = plan.allocations.find(a => a.axis === 'genre')!;
    const used = Object.keys(genreAxis.counts);
    expect(used).toContain('adult-contemporary');
    expect(used).toContain('healing-ballad');
    expect(used.length).toBeGreaterThanOrEqual(4);
    expect(plan.interpretation.reasoningKo.some(line => line.includes('자동으로 보완'))).toBe(true);
  });
});
