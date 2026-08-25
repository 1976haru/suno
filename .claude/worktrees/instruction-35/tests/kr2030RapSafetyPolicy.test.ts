import { describe, expect, it } from 'vitest';
import { checkKr2030RapSafety } from '../src/core/kr2030RapSafetyPolicy';

/**
 * 지시문 35 (TASK D) — kr-2030-rap 채널 전용 안전 정책. 동요
 * 정책(krKidsPolicy.test.ts)과 같은 형태: 카테고리별 실측 없는 시작
 * 어휘 목록의 정확한 동작을 고정한다.
 */
describe('[지시문 35 TASK D] checkKr2030RapSafety', () => {
  it('flags violence/weapons/drugs/crime as blocking', () => {
    const result = checkKr2030RapSafety('I got a gun in my hand tonight');
    expect(result.blocking).toContain('violence-weapons-drugs-crime');
  });

  it('flags profanity as blocking', () => {
    const result = checkKr2030RapSafety("this shit is crazy, don't stop");
    expect(result.blocking).toContain('profanity-slurs');
  });

  it('flags group-bias slurs as blocking (Korean)', () => {
    const result = checkKr2030RapSafety('저 김치녀 이야기 하지마');
    expect(result.blocking).toContain('group-bias');
  });

  it('flags real artist/brand names as blocking', () => {
    const result = checkKr2030RapSafety('feeling like Drake tonight, rolling in a Gucci coat');
    expect(result.blocking).toContain('real-person-brand');
  });

  it('flags conspicuous consumption as advisory, not blocking', () => {
    const result = checkKr2030RapSafety('pulling up in a Lamborghini, stacks of cash on the seat');
    expect(result.blocking).toHaveLength(0);
    expect(result.advisory).toContain('conspicuous-consumption');
  });

  it('flags aggressive battle framing as advisory, not blocking', () => {
    const result = checkKr2030RapSafety("this is my diss track, catch these hands");
    expect(result.blocking).toHaveLength(0);
    expect(result.advisory).toContain('aggressive-battle-framing');
  });

  it('clean everyday-scene lyrics trigger neither blocking nor advisory', () => {
    const result = checkKr2030RapSafety('walking home through the city lights, headphones on, thinking about tomorrow');
    expect(result.blocking).toHaveLength(0);
    expect(result.advisory).toHaveLength(0);
  });
});
