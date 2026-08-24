import { describe, expect, it } from 'vitest';
import { ARCHETYPE_DEFAULT_AUDIENCE, VALID_ARCHETYPES, normalizeChannel, validateChannelProfile } from '../src/utils/channelProfile';
import type { ChannelArchetype } from '../src/types';

/**
 * 지시문 74 — VALID_ARCHETYPES(channelProfile.ts)는 types.ts의
 * ChannelArchetype 유니온과 손으로 동기화하는 표라, 유니온에만 멤버가 추가되고
 * 배열에는 빠지는 누락이 반복됐다('en-chillhop'가 그렇게 빠져 있었다 — 지시문
 * 71이 유니온과 ARCHETYPE_DEFAULT_AUDIENCE에는 추가했지만 이 배열에는 넣지
 * 않았다). 그 결과는 조용하지 않다: validateChannelProfile이 멀쩡한 아키타입을
 * "알 수 없는 archetype 값"으로 거부해 useChannelManager의 saveEditorProfile이
 * 저장 자체를 막는다.
 *
 * 타입은 런타임에 지워지므로 유니온을 직접 순회할 수는 없다. 대신
 * ARCHETYPE_DEFAULT_AUDIENCE를 대역으로 쓴다 — 그쪽은
 * `Record<ChannelArchetype, AgeGroup>`이라 컴파일러가 유니온 전수성을 강제한다
 * (멤버를 빠뜨리면 `npm run build`의 tsc가 실패한다). 즉 "유니온의 모든 멤버가
 * VALID_ARCHETYPES에 있는가"는 "Record의 모든 키가 VALID_ARCHETYPES에 있는가"와
 * 같다. (tsconfig.json의 include는 ["src"]뿐이라 tests/의 타입 표는 tsc가 보지
 * 않는다 — 그래서 대역은 반드시 src/ 안의 것이어야 한다.)
 */
describe('VALID_ARCHETYPES ↔ ChannelArchetype 유니온 동기화', () => {
  const unionMembers = Object.keys(ARCHETYPE_DEFAULT_AUDIENCE) as ChannelArchetype[];

  it('유니온의 모든 멤버가 VALID_ARCHETYPES에 있다', () => {
    const missing = unionMembers.filter(archetype => !VALID_ARCHETYPES.includes(archetype));
    expect(missing).toEqual([]);
  });

  it('VALID_ARCHETYPES에 유니온에 없는 값이 섞여 있지 않다', () => {
    const extra = VALID_ARCHETYPES.filter(archetype => !unionMembers.includes(archetype));
    expect(extra).toEqual([]);
  });

  it('중복 항목이 없다', () => {
    expect(new Set(VALID_ARCHETYPES).size).toBe(VALID_ARCHETYPES.length);
  });

  it('모든 아키타입이 validateChannelProfile을 통과한다 (누락 시 실제로 깨지는 지점)', () => {
    for (const archetype of unionMembers) {
      const channel = normalizeChannel({ id: `t-${archetype}`, name: archetype, archetype });
      const result = validateChannelProfile(channel);
      expect(result.errors.filter(error => error.includes('archetype'))).toEqual([]);
      expect(result.valid).toBe(true);
    }
  });

  it("'en-chillhop'가 실제로 포함돼 있다 (이번 누락의 회귀 고정)", () => {
    expect(VALID_ARCHETYPES).toContain('en-chillhop');
  });
});
