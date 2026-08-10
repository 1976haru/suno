import { describe, expect, it } from 'vitest';
import { extractEraConstraint } from '../src/core/constraints';
import { directSetLocal } from '../src/core/setDirector';
import { channelPresets } from './fixtures';

/**
 * 지시문 29 (TASK E) — 실측(70년대 세트, 두 번 반복): "70년대 비틀즈의 향수"
 * 컨셉이 british-beat(1950s-60s 장르) 9곡으로 나왔다. 원인: 아티스트 키워드
 * ("비틀즈")가 연대 숫자와 같은 정규식(ERA_1950_60_PATTERN)에 섞여 있어서,
 * freeText에 "70년대"가 명시돼 있어도 "비틀즈"라는 단어 하나가 1950s-60s를
 * 같이 걸었고, 코드 순서상 그 버킷이 먼저 검사돼 primary를 차지했다
 * (지시문 01 SCENE_ERA §6 "명시 시대 > 참조 시대"가 요구한 순서와 반대).
 */
describe('지시문 29 TASK E — 명시 시대가 아티스트 연상 시대를 이긴다', () => {
  it('"70년대 비틀즈의 향수" — 1970s가 primary, 1950s-60s는 좁은 상한(0.17)의 adjacent', () => {
    const era = extractEraConstraint('70년대 비틀즈의 향수', ['mid-1960s British beat pop']);
    expect(era.primary).toBe('1970s');
    expect(era.coPrimary).toBeUndefined();
    const beatAdjacent = era.adjacent.find(a => a.era === '1950s-60s');
    expect(beatAdjacent).toBeDefined();
    expect(beatAdjacent!.maxShare).toBeLessThan(0.25);
  });

  it('아티스트 참조 eraTag를 안 넘겨도(freeText 자체의 "비틀즈" 단어만으로도) 동일하게 1970s가 이긴다', () => {
    const era = extractEraConstraint('70년대 비틀즈의 향수');
    expect(era.primary).toBe('1970s');
  });

  it('명시 시대가 없으면(예: "비틀즈 느낌 플레이리스트") 아티스트 연상 시대가 그대로 primary — 기존 동작 유지', () => {
    const era = extractEraConstraint('비틀즈 느낌 플레이리스트', ['mid-1960s British beat pop']);
    expect(era.primary).toBe('1950s-60s');
  });

  it('진짜 복합 명시("60년대70년대")는 여전히 co-primary로 남는다 — 아티스트 충돌 강등 로직과 다른 경로', () => {
    const era = extractEraConstraint('60년대70년대 감성을 느낄 수 있는 올드팝');
    expect(era.primary).toBe('1950s-60s');
    expect(era.coPrimary).toBe('1970s');
  });

  it('카펜터스(1970s 키워드)가 80년대 명시 컨셉과 충돌해도 같은 원칙이 적용된다', () => {
    const era = extractEraConstraint('80년대 카펜터스 감성 발라드');
    expect(era.primary).toBe('1980s');
    const carpenterAdjacent = era.adjacent.find(a => a.era === '1970s');
    expect(carpenterAdjacent).toBeDefined();
    expect(carpenterAdjacent!.maxShare).toBeLessThanOrEqual(0.25);
  });

  it('실제 genrePlan 재현 — oldpop-lounge에서 "70년대 비틀즈의 향수" 18곡 중 1950s-60s 장르가 3곡 이하, 1970s 장르가 과반', () => {
    const channel = channelPresets.find(c => c.id === 'oldpop-lounge-main') ?? channelPresets.find(c => c.archetype === 'oldpop-lounge')!;
    const plan = directSetLocal('70년대 비틀즈의 향수', channel, 18, { recentGenreIds: [], recentHooks: [] });
    const genreIds = plan.slots.map(s => s.genreId).filter((id): id is string => Boolean(id));
    expect(genreIds.length).toBe(18);
    // britishBeat/doowop 등 1950s-60s 계열 장르 이름 패턴으로 대략 판별
    const legacy1950s60sIds = genreIds.filter(id => /british-beat|doowop|girl-group|brill-building/.test(id));
    expect(legacy1950s60sIds.length).toBeLessThanOrEqual(4);
  });
});
