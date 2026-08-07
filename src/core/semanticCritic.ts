/**
 * 지시문 11 (TASK C) — "SemanticCritic, optional/provider-gated". 실측
 * 확인(core/musicGenerationProvider.ts의 자체 doc comment와 동일한 조사):
 * 이 앱은 임의의 외부 LLM을 호출하는 실제 연결을 어디에도 갖고 있지 않다
 * (grep 결과 없음, providers/index.ts의 실제 텍스트 생성 공급자들은 사용자가
 * 명시적으로 브릿지/직접 입력한 응답을 파싱할 뿐 이 앱이 능동적으로 "이
 * 가사를 비평해줘" 같은 새 호출을 만들지 않는다). 그런 호출을 이 세션에서
 * 새로 만들면 미승인/불법 엔드포인트를 부르거나 성공을 지어내는 것 중
 * 하나가 된다 — 이 세션 전체가 지켜온 "미구현은 정직하게 미구현으로 둔다"는
 * 원칙과 정면으로 충돌한다.
 *
 * 그래서 이 모듈은 core/musicGenerationProvider.ts와 정확히 같은 모양의
 * 패턴이다: 실제로 올바른 계약(인터페이스) + 모든 메서드가 "설정되지 않음"을
 * 정직하게 던지는 기본 구현. 진짜 공급자가 언젠가 연결되면 이 계약 그대로
 * 꽂을 자리다 — 지금은 아무것도 없다고 조용히 속이지 않는다.
 *
 * "confidence >= 0.9 미만은 무시" 임계값은 이 지시문 자신이 제안한 값이며
 * 실측으로 검증된 값이 아니다 — core/seniorOldpopPolicy.ts의
 * SLOT_PLAN_LEDGER_POLICY와 동일한 원칙으로 SEMANTIC_CRITIC_POLICY에
 * unvalidated로 명시해 둔다.
 *
 * "전체 통과 팩을 다시 쓰지 않는다" — 이 모듈은 의도적으로 "팩 전체를
 * 재작성하라"는 함수를 아예 제공하지 않는다. filterSemanticCriticFindings는
 * 개별 트랙 finding만 신뢰 임계값으로 걸러낼 뿐, 어떤 함수도 여러 곡을 한
 * 번에 재작성 대상으로 묶지 않는다 — 그 경계를 생략이 아니라 설계로 강제한다.
 */

export interface SemanticCriticFinding {
  trackNo: number;
  issueKo: string;
  /** 0..1. 이 값 자체를 이 모듈이 계산하지 않는다 — 실제 공급자가 채워 넣는 값. */
  confidence: number;
}

export interface SemanticCriticRequest {
  packId: string;
  songs: readonly { trackNo: number; title: string; lyrics: string }[];
}

export interface SemanticCritic {
  readonly id: string;
  /** True only when a real, usable connection is actually configured — never assumed true by construction. */
  isConfigured(): boolean;
  review(request: SemanticCriticRequest): Promise<SemanticCriticFinding[]>;
}

export class SemanticCriticUnavailableError extends Error {
  constructor(method: string) {
    super(`SemanticCritic가 설정되지 않았습니다 (${method}) — 이 앱에는 실제 LLM 비평 공급자 연결이 없습니다.`);
    this.name = 'SemanticCriticUnavailableError';
  }
}

/** core/musicGenerationProvider.ts의 UnavailableMusicGenerationProvider와 동일한 패턴 — 모든 메서드가 정직하게 거부한다. */
export class UnavailableSemanticCritic implements SemanticCritic {
  readonly id = 'unavailable';

  isConfigured(): boolean {
    return false;
  }
  async review(): Promise<SemanticCriticFinding[]> {
    throw new SemanticCriticUnavailableError('review');
  }
}

/** 실제로 설정된 공급자가 없으므로 항상 UnavailableSemanticCritic — 미래에 진짜 연결이 생기면 이 자리에 꽂는다. */
export function resolveSemanticCritic(): SemanticCritic {
  return new UnavailableSemanticCritic();
}

/**
 * §0 실측 수치가 아니라 이 지시문이 제안한 추정치 — 검증 전까지 unvalidated.
 */
export const SEMANTIC_CRITIC_POLICY = {
  /** 이 미만인 finding은 신뢰할 수 없다고 보고 무시한다. */
  minConfidence: 0.9
} as const;

/**
 * 순수 함수 — confidence 임계값 아래인 finding을 걸러낸다. "전체 통과 팩을
 * 재작성하지 않는다"는 이 함수의 반환 형태 자체로 강제된다: 트랙별 finding
 * 목록만 돌려줄 뿐, 팩 전체를 재작성 대상으로 묶는 어떤 집계도 하지 않는다.
 */
export function filterSemanticCriticFindings(findings: readonly SemanticCriticFinding[]): SemanticCriticFinding[] {
  return findings.filter(finding => finding.confidence >= SEMANTIC_CRITIC_POLICY.minConfidence);
}
