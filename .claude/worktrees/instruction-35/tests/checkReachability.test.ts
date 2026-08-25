import { describe, expect, it } from 'vitest';
import { checkReachabilityWithAllowlist } from '../scripts/checkReachability';
import { REACHABILITY_ALLOWLIST } from '../scripts/reachabilityAllowlist';

/**
 * 지시문 09 (TASK C-1) — "사유 없는 도달 불가는 실패다." 실제 앱 소스
 * 전체를 대상으로 돌려, 지금 도달 불가한 모든 파일이 allowlist에
 * 사유와 함께 등록돼 있는지 검증한다 — 새 모듈을 추가하고 배선을
 * 잊으면 이 테스트가 잡아낸다.
 */
describe('지시문 09 TASK C-1 — checkReachability allowlist', () => {
  it('실제 앱 소스 트리에서 사유 없는 도달 불가 파일이 0개다', () => {
    const { unreasoned } = checkReachabilityWithAllowlist();
    expect(unreasoned).toEqual([]);
  });

  it('allowlist의 모든 항목이 여전히 실제로 도달 불가하다 (배선 완료된 항목은 목록에서 지워야 함)', () => {
    const { staleAllowlistEntries } = checkReachabilityWithAllowlist();
    expect(staleAllowlistEntries, `배선 완료되어 allowlist에서 지워야 할 항목: ${staleAllowlistEntries.join(', ')}`).toEqual([]);
  });

  it('allowlist 항목은 전부 비어있지 않은 실제 사유 문자열을 갖는다', () => {
    for (const [file, reason] of Object.entries(REACHABILITY_ALLOWLIST)) {
      expect(reason.trim().length, `${file}의 사유가 비어 있음`).toBeGreaterThan(0);
    }
  });
});
