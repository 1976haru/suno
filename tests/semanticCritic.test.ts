import { describe, expect, it } from 'vitest';
import {
  UnavailableSemanticCritic, SemanticCriticUnavailableError, resolveSemanticCritic,
  filterSemanticCriticFindings, SEMANTIC_CRITIC_POLICY, type SemanticCriticFinding
} from '../src/core/semanticCritic';

/**
 * 지시문 11 (TASK C, required test file) — core/musicGenerationProvider.ts와
 * 동일한 원칙: 실제 공급자가 없으므로 모든 메서드가 정직하게 거부해야 한다.
 * filterSemanticCriticFindings는 지시문이 명시한 confidence >= 0.9 임계값을
 * 실제로 적용하는지, 그리고 "전체 팩 재작성" 같은 걸 만들지 않는다는 설계
 * 경계가 실제로 지켜지는지 검증한다.
 */

describe('[지시문 11 TASK C] UnavailableSemanticCritic — 정직한 거부', () => {
  it('isConfigured는 항상 false다', () => {
    expect(new UnavailableSemanticCritic().isConfigured()).toBe(false);
  });

  it('review는 SemanticCriticUnavailableError를 던진다', async () => {
    const critic = new UnavailableSemanticCritic();
    await expect(critic.review({ packId: 'p1', songs: [] })).rejects.toThrow(SemanticCriticUnavailableError);
  });

  it('resolveSemanticCritic은 항상 사용 가능한(정직하게 미설정인) critic을 돌려준다', () => {
    const critic = resolveSemanticCritic();
    expect(critic).toBeDefined();
    expect(critic.isConfigured()).toBe(false);
  });
});

describe('[지시문 11 TASK C] filterSemanticCriticFindings — confidence >= 0.9 임계값 실제 적용', () => {
  it('0.9 이상인 finding만 통과한다', () => {
    const findings: SemanticCriticFinding[] = [
      { trackNo: 1, issueKo: '높은 신뢰도', confidence: 0.95 },
      { trackNo: 2, issueKo: '낮은 신뢰도', confidence: 0.5 }
    ];
    const result = filterSemanticCriticFindings(findings);
    expect(result.map(f => f.trackNo)).toEqual([1]);
  });

  it('정확히 임계값(0.9)인 finding은 통과한다 (경계값 포함)', () => {
    const findings: SemanticCriticFinding[] = [{ trackNo: 1, issueKo: '경계값', confidence: SEMANTIC_CRITIC_POLICY.minConfidence }];
    expect(filterSemanticCriticFindings(findings)).toHaveLength(1);
  });

  it('빈 findings는 빈 배열을 반환한다 (전체 팩을 대상으로 한 어떤 집계도 하지 않음)', () => {
    expect(filterSemanticCriticFindings([])).toEqual([]);
  });
});

describe('[지시문 11 TASK C] 정책 레지스트리 — 미검증 추정치임을 명시', () => {
  it('SEMANTIC_CRITIC_POLICY.minConfidence는 지시문이 제안한 0.9다', () => {
    expect(SEMANTIC_CRITIC_POLICY.minConfidence).toBe(0.9);
  });
});
