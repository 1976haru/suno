import { describe, expect, it } from 'vitest';
import { checkArchetypeHardcoding } from '../scripts/checkArchetypeHardcoding';

/**
 * 지시문 15 (TASK D) — archetype 하드코딩 재발 방지 검사의 회귀 테스트.
 * "이 지시문이 만드는 신규 코드는 allowlist 에 올릴 수 없다" 원칙을
 * CI 뿐 아니라 일반 테스트 스위트에서도 즉시 잡는다.
 */
describe('[지시문 15 TASK D] archetype 하드코딩이 allowlist 총계를 넘지 않는다', () => {
  it('실측 총계가 allowlist 총계 이하다 (늘어날 수 없다)', () => {
    const result = checkArchetypeHardcoding();
    expect(result.actualTotal, `실측 ${result.actualTotal} > allowlist 총계 ${result.allowlistTotal}`).toBeLessThanOrEqual(result.allowlistTotal);
  });

  it('allowlist에 없는 파일에서 하드코딩이 발견되지 않는다', () => {
    const result = checkArchetypeHardcoding();
    expect(result.undeclaredFiles, JSON.stringify(result.undeclaredFiles)).toEqual([]);
  });

  it('allowlist 선언보다 실제가 많은 파일이 없다', () => {
    const result = checkArchetypeHardcoding();
    expect(result.overBudgetFiles, JSON.stringify(result.overBudgetFiles)).toEqual([]);
  });

  it('전체 통과 판정', () => {
    const result = checkArchetypeHardcoding();
    expect(result.passed).toBe(true);
  });
});
