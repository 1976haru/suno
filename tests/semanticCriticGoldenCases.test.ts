import { describe, expect, it } from 'vitest';
import { GOLDEN_CASES, SEMANTIC_CRITIC_ALLOW_EXAMPLES } from '../src/data/goldenCases';

/**
 * 지시문 17 (TASK C-3/C-4) — SemanticCritic이 아직 provider-gated(연결된
 * 공급자 없음)라 실제로 리뷰를 돌려 재현할 수는 없다. 이 테스트는 "등록은
 * 됐는가"만 잠근다 — 진짜 공급자가 연결되면 이 5+5건을 실제로 review()에
 * 태워 severity/오탐 여부를 재현하는 테스트로 교체한다(§C-2 confidence
 * 임계값 가드와 함께).
 */

describe('[지시문 17 TASK C-4] golden case 등록 (오류 5건)', () => {
  const enGrammarCases = GOLDEN_CASES.filter(c => c.category === 'en-grammar');

  it('en-grammar 카테고리로 5건 등록됐다', () => {
    expect(enGrammarCases).toHaveLength(5);
  });

  it('전부 status: pending-checker다(SemanticCritic provider 미설정 — 재현 체커 없음을 정직하게 표시)', () => {
    for (const c of enGrammarCases) {
      expect(c.status).toBe('pending-checker');
    }
  });

  it('전부 severity: blocking으로 등록됐다(실제 문법 오류)', () => {
    for (const c of enGrammarCases) {
      expect(c.severity).toBe('blocking');
    }
  });

  it('id가 지시문 원문 5종과 정확히 일치한다', () => {
    expect(enGrammarCases.map(c => c.id).sort()).toEqual(
      ['en-article-uncountable', 'en-intransitive', 'en-preposition', 'en-relative-clause', 'en-verb-choice'].sort()
    );
  });
});

describe('[지시문 17 TASK C-4] golden case 등록 (정상 5건, 오탐 방지)', () => {
  it('SEMANTIC_CRITIC_ALLOW_EXAMPLES가 5건 등록됐다', () => {
    expect(SEMANTIC_CRITIC_ALLOW_EXAMPLES).toHaveLength(5);
  });

  it('모든 예문이 실제 문장·근거를 채워 뒀다(빈 값 없음)', () => {
    for (const example of SEMANTIC_CRITIC_ALLOW_EXAMPLES) {
      expect(example.sentence.trim().length).toBeGreaterThan(0);
      expect(example.reasonKo.trim().length).toBeGreaterThan(0);
    }
  });

  it('T4의 실제 "좋다고 판정된" 두 문장이 포함돼 있다(문장 스타일 훼손 방지용 회귀 잠금)', () => {
    const sentences = SEMANTIC_CRITIC_ALLOW_EXAMPLES.map(e => e.sentence);
    expect(sentences).toContain("You didn't say a thing, just moved your hand");
    expect(sentences).toContain('An inch across the wood, and let it rest');
  });

  it('오류 5건과 정상 5건의 id가 서로 겹치지 않는다', () => {
    const errorIds = new Set(GOLDEN_CASES.filter(c => c.category === 'en-grammar').map(c => c.id));
    const allowIds = new Set(SEMANTIC_CRITIC_ALLOW_EXAMPLES.map(e => e.id));
    for (const id of allowIds) {
      expect(errorIds.has(id)).toBe(false);
    }
  });
});
