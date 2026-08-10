import { extractEraConstraint } from './constraints';
import { CONCEPT_COMPATIBILITY_BY_ARCHETYPE } from '../data/conceptCompatibility';
import { ERA_LABEL, type EraBucket } from '../data/eraExclusions';
import type { ChannelProfile } from '../types';

/**
 * 지시문 32 (§1) — "채널 데이터가 이 시대를 표현할 수 있는가"와 "이 컨셉을
 * 이 채널에서 애초에 시도해야 하는가"는 다른 질문이다. scripts/
 * checkGateContract.ts의 GATE_DATA_CONTRACTS(지시문 12)는 전자만 답한다 —
 * "채널 X는 시대 Y를 78% 이상 채울 수 있는가"를 실제 genre 데이터로
 * 검증한다. 이 모듈은 후자를 답한다: 애초에 senior-oldpop 워크스페이스의
 * "60년대 올드팝" 같은 대표 컨셉이 lofi-study/kids/city-night처럼 전혀 다른
 * 정체성의 채널에 시험되는 것 자체가 조합 설계 오류인지, 아니면 정당한
 * 재해석(cross-style)인지, 정말 그 채널에서 시도돼선 안 되는지(unsupported)를
 * 판정한다. supported만 GATE_DATA_CONTRACTS의 실제 결핍 판정을 그대로
 * blocking으로 남긴다.
 */
export type ConceptCompatibility = 'supported' | 'cross-style' | 'unsupported';

export interface ConceptCompatibilityResult {
  compatibility: ConceptCompatibility;
  reasonKo: string;
  /** unsupported일 때만 채워진다 — 실제 존재하는 대안 채널 id (지어낸 장르/채널 아님). */
  suggestedChannelIds?: string[];
}

const RANK: Record<ConceptCompatibility, number> = { supported: 0, 'cross-style': 1, unsupported: 2 };

function checkBucket(bucket: EraBucket, channel: ChannelProfile): ConceptCompatibilityResult {
  const data = channel.archetype ? CONCEPT_COMPATIBILITY_BY_ARCHETYPE[channel.archetype] : undefined;
  if (!data) {
    return { compatibility: 'supported', reasonKo: `아키타입 '${channel.archetype ?? '(없음)'}'에 대한 시대 호환성 데이터 없음 — 기본 허용(제약을 지어내지 않음)` };
  }
  if (data.supportedEraBuckets.includes(bucket)) {
    return { compatibility: 'supported', reasonKo: `${ERA_LABEL[bucket]}는 이 채널의 실측 주력 시대(${data.sourceKo})` };
  }
  if (data.crossStyleEraBuckets.includes(bucket)) {
    return { compatibility: 'cross-style', reasonKo: `${ERA_LABEL[bucket]}는 이 채널의 주력 시대는 아니지만 재해석으로 선택 가능 — ${data.sourceKo}` };
  }
  return {
    compatibility: 'unsupported',
    reasonKo: `이 채널(${channel.archetype})은 ${ERA_LABEL[bucket]}를 표현할 근거가 없음 — ${data.sourceKo}`,
    suggestedChannelIds: data.suggestedChannelIds
  };
}

/**
 * concept 텍스트가 특정 시대를 지목하지 않으면(era.unspecified) 언제나
 * supported — 시대 충돌 자체가 성립하지 않는다. 지목했으면(복합 연대 포함,
 * coPrimary) 관련된 모든 버킷 중 가장 나쁜 판정(unsupported > cross-style >
 * supported)을 채택한다 — 복합 컨셉("60~70년대")의 절반만 되는 채널을
 * "지원함"으로 조용히 넘기지 않는다.
 */
export function checkConceptCompatibility(concept: string, channel: ChannelProfile): ConceptCompatibilityResult {
  const era = extractEraConstraint(concept);
  if (era.unspecified) {
    return { compatibility: 'supported', reasonKo: '컨셉에 특정 시대 신호가 없음 — 시대 조합 충돌 없음' };
  }
  const buckets: EraBucket[] = era.coPrimary ? [era.primary, era.coPrimary] : [era.primary];
  const results = buckets.map(bucket => checkBucket(bucket, channel));
  return results.reduce((worst, current) => (RANK[current.compatibility] > RANK[worst.compatibility] ? current : worst));
}
