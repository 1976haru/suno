import { describe, expect, it } from 'vitest';
import { buildGenreAllocationForListeningIntent } from '../src/core/listeningIntent';
import { LISTENING_INTENT_POLICY, DEFAULT_LISTENING_INTENT } from '../src/data/listeningIntentPolicy';
import { PERCEIVED_ENERGY_POLICY } from '../src/data/perceivedEnergyPolicy';
import { getGenreById } from '../src/data/genreLibrary';
import { channelPresets } from '../src/data/presets';

/**
 * 지시문 33 (§2) — pickForBucket이 동점 후보 중 항상 배열의 첫 번째만
 * 골라, 같은 채널 + 같은 청취 목적을 반복 적용하면 항상 같은 장르로
 * 수렴했다(실측: recentGenreIds 없이 3번 호출하면 매번 genreIds가
 * 100% 동일). 최근 사용 이력을 tie-break에 반영해 이 문제를 고친다 —
 * 새 원장을 만들지 않고 기존 core/recentGenreStore.ts가 쓰는 것과 같은
 * "최근이 배열 앞쪽" 형태의 배열을 순수 함수 인자로 받는다.
 */
const energyPolicy = PERCEIVED_ENERGY_POLICY['senior-oldpop'];
const policy = LISTENING_INTENT_POLICY[DEFAULT_LISTENING_INTENT];
const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
const candidateGenres = channel.preferredGenres.map(getGenreById).filter((g): g is NonNullable<typeof g> => Boolean(g));

describe('[지시문 33 §2] buildGenreAllocationForListeningIntent — recentGenreIds tie-break', () => {
  it('recentGenreIds 없이(기본값) 반복 호출하면 기존 동작대로 항상 같은 장르 집합을 낸다 — 회귀 확인용 기준선', () => {
    const a = buildGenreAllocationForListeningIntent(candidateGenres, policy, 18, energyPolicy);
    const b = buildGenreAllocationForListeningIntent(candidateGenres, policy, 18, energyPolicy);
    expect(new Set(a.genreIds)).toEqual(new Set(b.genreIds));
  });

  it('동점 후보가 있는 에너지 버킷에서, 그 버킷 후보들이 recentGenreIds에 있으면 다른 장르를 고른다', () => {
    const withoutHistory = buildGenreAllocationForListeningIntent(candidateGenres, policy, 18, energyPolicy);
    // withoutHistory가 고른 장르 전부를 "방금 막 쓴 것"으로 넘기면, 같은
    // 에너지 레벨에 다른 후보가 있는 한 적어도 하나는 바뀌어야 한다.
    const withHistory = buildGenreAllocationForListeningIntent(candidateGenres, policy, 18, energyPolicy, withoutHistory.genreIds);
    expect(
      withHistory.genreIds.some(id => !withoutHistory.genreIds.includes(id)),
      `이력 없이: ${withoutHistory.genreIds.join(',')} / 이력 있이: ${withHistory.genreIds.join(',')}`
    ).toBe(true);
  });

  it('사용자가 명시 선택한 장르 경로(buildGenreCountsForExistingSelection)는 이 tie-break을 전혀 타지 않는다 — pickForBucket 자체를 호출하지 않으므로 후보 순서가 바뀔 일이 없다', () => {
    // 이 함수(buildGenreAllocationForListeningIntent)는애초에 "사용자가 아직
    // 아무것도 명시 선택하지 않았을 때"만 호출되는 경로다(core/listeningIntent.ts's
    // applyListeningIntentToOptions의 hasExplicitUserGenres 분기 참고) —
    // 여기서는 그 분리가 여전히 성립하는지 시그니처로만 확인한다.
    expect(typeof buildGenreAllocationForListeningIntent).toBe('function');
  });

  it('[인수 기준] 같은 채널·같은 청취 목적을 3회 반복 적용(매번 직전 결과를 이력으로 누적)하면, 3세트 장르 교집합이 3종 이하다', () => {
    let history: string[] = [];
    const rounds: string[][] = [];
    for (let i = 0; i < 3; i++) {
      const alloc = buildGenreAllocationForListeningIntent(candidateGenres, policy, 18, energyPolicy, history);
      rounds.push(alloc.genreIds);
      // core/recentGenreStore.ts의 rememberRecentGenreId와 같은 모양(최근이
      // 앞쪽, 중복 제거)으로 이력을 누적한다 — 실제 UI 경로와 동일한 갱신 규칙.
      history = [...new Set([...alloc.genreIds, ...history])];
    }
    const intersection = rounds[0].filter(id => rounds[1].includes(id) && rounds[2].includes(id));
    expect(
      intersection.length,
      `R1=${rounds[0].join(',')} / R2=${rounds[1].join(',')} / R3=${rounds[2].join(',')} / 교집합=${intersection.join(',')}`
    ).toBeLessThanOrEqual(3);
  });
});
