import { describe, expect, it } from 'vitest';
import { ALWAYS_BLOCKING_VIOLATION_IDS, PROMPT_AXIS_POLICIES, promptAxisPolicyFor } from '../src/data/promptAxisPolicy';
import { workspaceDefinitions } from '../src/data/workspaces';
import { SINGLE_DECLARATION_AXES } from '../src/data/promptAxisLexicon';

const ALL_WORKSPACE_IDS = workspaceDefinitions.map(w => w.id);

/**
 * 지시문 16 (TASK C-3) — "7 워크스페이스 fixture 통과 7/7". 실제 워크스페이스
 * 목록(data/workspaces/index.ts)과 정책 레지스트리가 서로 어긋나지 않는지
 * 확인한다 — 7개 중 하나라도 정책이 없으면 그 워크스페이스는 조용히 아무
 * 규칙도 적용받지 못하게 된다.
 */
describe('[지시문 16 TASK C] PromptAxisPolicy — 7 워크스페이스 fixture', () => {
  it('실제 7개 워크스페이스 전부에 정책이 등록되어 있다', () => {
    for (const workspaceId of ALL_WORKSPACE_IDS) {
      const policy = promptAxisPolicyFor(workspaceId);
      expect(policy, `${workspaceId}에 정책이 없습니다`).toBeDefined();
      expect(policy.workspaceId).toBe(workspaceId);
    }
    expect(Object.keys(PROMPT_AXIS_POLICIES)).toHaveLength(ALL_WORKSPACE_IDS.length);
  });

  it('senior-oldpop만 verified: true — 실측 근거(20260808 팩)를 sourceKo에 명시한다', () => {
    const seniorPolicy = promptAxisPolicyFor('senior-oldpop');
    expect(seniorPolicy.verified).toBe(true);
    expect(seniorPolicy.sourceKo).toContain('20260808');
    expect(seniorPolicy.sourceKo).toContain('실측');

    const others = ALL_WORKSPACE_IDS.filter(id => id !== 'senior-oldpop');
    expect(others.length).toBeGreaterThan(0);
    for (const workspaceId of others) {
      expect(promptAxisPolicyFor(workspaceId).verified, `${workspaceId}는 미실측이어야 합니다`).toBe(false);
    }
  });

  it('모든 워크스페이스가 같은 단일 선언 축 목록을 쓴다 (인트로 모순 등은 워크스페이스별 취향이 아니라 구조적 오류)', () => {
    for (const workspaceId of ALL_WORKSPACE_IDS) {
      expect([...promptAxisPolicyFor(workspaceId).singleDeclarationAxes].sort()).toEqual([...SINGLE_DECLARATION_AXES].sort());
    }
  });

  it('명백한 오류 3종(리드 중복·중복 토큰·인트로 모순)이 always-blocking 목록에 있다', () => {
    expect([...ALWAYS_BLOCKING_VIOLATION_IDS].sort()).toEqual(['duplicate_token', 'intro_axis_contradiction', 'lead_vocal_axis_duplicate'].sort());
  });
});
