import { describe, expect, it } from 'vitest';
import { checkVersion } from '../scripts/checkVersion';

/**
 * 지시문 18 (TASK B-3) — 버전 문자열 단일 출처 검사의 회귀 테스트.
 * "package.json 5.14.0 / 실제 작업 v5.24 ← 불일치"가 다시 조용히
 * 벌어지는 것을 CI뿐 아니라 일반 테스트 스위트에서도 즉시 잡는다.
 */
describe('[지시문 18 TASK B-3] 버전 문자열 단일 출처', () => {
  it('package.json version이 유효한 semver다', () => {
    const result = checkVersion();
    expect(result.isValidSemver, `"${result.packageVersion}"이 유효한 semver가 아님`).toBe(true);
  });

  it('package.json version이 0.NN.P 체계를 따른다(1.0.0 승격 조건을 실제로 달성하기 전까지)', () => {
    const result = checkVersion();
    expect(result.isZeroXScheme, `"${result.packageVersion}"이 0.NN.P 체계를 벗어남`).toBe(true);
  });

  it('docs/CHANGELOG.md 최상단 항목이 package.json version과 정확히 일치한다', () => {
    const result = checkVersion();
    expect(result.changelogTopVersion).toBe(result.packageVersion);
  });

  it('전체 통과 판정', () => {
    const result = checkVersion();
    expect(result.reasonsKo, JSON.stringify(result.reasonsKo)).toEqual([]);
    expect(result.passed).toBe(true);
  });
});
