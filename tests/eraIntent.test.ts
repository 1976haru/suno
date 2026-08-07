import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { loadPackBlueprint } from '../scripts/audit';
import { deriveEraIntent, eraDeviantGenreIds, extractEraClaims, checkEraPromptAgainstIntent } from '../src/core/eraIntent';

/**
 * 지시문 10 (TASK A) — real fixture regression lock. Verifies the new
 * EraIntent machinery reproduces the directive's own §A-1 real measurement
 * (6/10/2 split, oldpop-soft-rock-am/motown-pop-soul/piano-ballad-70s as the
 * 3 era-deviant genres in a real "60년대" pack) against the actual uploaded
 * fixture — not a hand-built case.
 */
const FIXTURE_60S = path.resolve(__dirname, 'fixtures/realPack60s.json');

describe('지시문 10 TASK A — deriveEraIntent', () => {
  it('"60년대" 컨셉은 primary 1960s, secondary 1970s를 반환한다', () => {
    const intent = deriveEraIntent('60년대 올드팝 명곡');
    expect(intent).toBeDefined();
    expect(intent!.primary).toBe('1960s');
    expect(intent!.secondary).toBe('1970s');
    expect(intent!.primaryMinShare).toBeCloseTo(0.78);
    expect(intent!.secondaryMaxShare).toBeCloseTo(0.11);
  });

  it('시대 신호가 없는 컨셉은 undefined를 반환한다 (억지로 시대를 정하지 않는다)', () => {
    expect(deriveEraIntent('비 오는 날 창가에서 듣는 올드팝')).toBeUndefined();
  });

  it('"70년대" 컨셉은 primary 1970s를 반환한다', () => {
    const intent = deriveEraIntent('70년대 올드팝 명곡');
    expect(intent!.primary).toBe('1970s');
  });
});

describe('지시문 10 TASK A-3 — eraDeviantGenreIds', () => {
  it('60년대 EraIntent는 secondary(1970s) 장르는 후보 풀에 남기고(카운트 제한은 별도), 완전히 무관한 시대(1980s)만 제외한다', () => {
    // eraDeviantGenreIds is the CANDIDATE POOL filter — it drops genres whose
    // bucket is neither primary nor secondary nor timeless. The 1970s bucket
    // IS this intent's secondary (transitionAllowed, secondaryMaxShare 0.11),
    // so oldpop-soft-rock-am/motown-pop-soul/piano-ballad-70s stay eligible
    // here; batchPreallocation.ts's applyEraQuota wiring is what actually
    // CAPS their combined count to <=11% downstream — a real first version of
    // this test wrongly expected pool-level exclusion for the whole 1970s
    // bucket, which would have made "전환 최대 2곡 이하" structurally
    // impossible (0 available candidates instead of a capped few).
    const intent = deriveEraIntent('60년대 올드팝 명곡')!;
    const genreIds = ['oldpop-warm-morning-glow', 'oldpop-soft-rock-am', 'oldpop-motown-pop-soul', 'oldpop-piano-ballad-70s', 'oldpop-british-beat', 'oldpop-adult-contemporary-80s'];
    const { eligible, excluded } = eraDeviantGenreIds(intent, genreIds);
    expect(eligible.sort()).toEqual(['oldpop-british-beat', 'oldpop-motown-pop-soul', 'oldpop-piano-ballad-70s', 'oldpop-soft-rock-am', 'oldpop-warm-morning-glow'].sort());
    expect(excluded).toEqual(['oldpop-adult-contemporary-80s']);
  });

  it('탐색 슬롯으로 지정된, 완전히 무관한 시대의 장르는 예외로 후보 풀에 남는다', () => {
    const intent = deriveEraIntent('60년대 올드팝 명곡')!;
    const { eligible, excluded } = eraDeviantGenreIds(intent, ['oldpop-adult-contemporary-80s'], new Set(['oldpop-adult-contemporary-80s']));
    expect(eligible).toEqual(['oldpop-adult-contemporary-80s']);
    expect(excluded).toEqual([]);
  });

  it('장르 데이터에 시대 버킷이 없는(비-oldpop) 장르는 항상 후보로 남는다', () => {
    const intent = deriveEraIntent('60년대 올드팝 명곡')!;
    const { eligible, excluded } = eraDeviantGenreIds(intent, ['krkids-sleep-calm']);
    expect(eligible).toEqual(['krkids-sleep-calm']);
    expect(excluded).toEqual([]);
  });
});

describe('지시문 10 TASK A-4 — extractEraClaims / checkEraPromptAgainstIntent (real fixture)', () => {
  it('실제 60년대 팩 18곡의 stylePrompt 시대 표기가 지시문 §A-1 실측(6/10/2)과 일치한다', () => {
    const loaded = loadPackBlueprint(FIXTURE_60S, undefined);
    if (loaded.blocked) throw new Error('fixture blocked');
    const claimsPerSong = loaded.blueprint.songs.map(s => extractEraClaims(s.stylePrompt));
    const primaryOnly = claimsPerSong.filter(c => c.includes('1960s') && !c.includes('1970s')).length;
    const otherOnly = claimsPerSong.filter(c => c.includes('1970s') && !c.includes('1960s')).length;
    const mixed = claimsPerSong.filter(c => c.includes('1960s') && c.includes('1970s')).length;
    expect(primaryOnly).toBe(6);
    expect(otherOnly).toBe(10);
    expect(mixed).toBe(2);
  });

  it('checkEraPromptAgainstIntent가 real fixture에서 primaryBelowTarget/otherEraPureOverTarget을 모두 true로 잡는다 (실제 결함 재현)', () => {
    const loaded = loadPackBlueprint(FIXTURE_60S, undefined);
    if (loaded.blocked) throw new Error('fixture blocked');
    const intent = deriveEraIntent('60년대 올드팝 명곡')!;
    const result = checkEraPromptAgainstIntent(loaded.blueprint.songs, intent);
    expect(result.primaryBelowTarget).toBe(true);
    expect(result.otherEraPureOverTarget).toBe(true);
    expect(result.blockingOtherEraPureTrackNos.length).toBe(10);
  });

  it('탐색 슬롯으로 지정한 trackNo는 blockingOtherEraPureTrackNos에서 제외된다', () => {
    const loaded = loadPackBlueprint(FIXTURE_60S, undefined);
    if (loaded.blocked) throw new Error('fixture blocked');
    const intent = deriveEraIntent('60년대 올드팝 명곡')!;
    const withoutExemption = checkEraPromptAgainstIntent(loaded.blueprint.songs, intent);
    const exemptTrack = withoutExemption.blockingOtherEraPureTrackNos[0];
    const withExemption = checkEraPromptAgainstIntent(loaded.blueprint.songs, intent, new Set([exemptTrack]));
    expect(withExemption.blockingOtherEraPureTrackNos).not.toContain(exemptTrack);
    expect(withExemption.blockingOtherEraPureTrackNos.length).toBe(withoutExemption.blockingOtherEraPureTrackNos.length - 1);
  });
});
