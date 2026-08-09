import { describe, expect, it } from 'vitest';
import { evaluateDistinctChoiceGate } from '../src/core/distinctChoiceGate';
import { distinctChoicePolicyForWorkspace, safetyForbiddenRuleIdsForWorkspace } from '../src/data/distinctChoicePolicy';
import type { WorkspaceId } from '../src/types';
import {
  ALL_WORKSPACE_IDS,
  WORKSPACE_REPRESENTATIVE_ARCHETYPE,
  buildLegacyFreeTextSong,
  buildMissingSong,
  buildRuleSong
} from './distinctChoiceWorkspaceFixtures';

/**
 * 지시문 15 (TASK C, 필수 테스트 파일) — importInspection.ts:307의 "정보용
 * 처리"가 실제로 고쳐야 했던 정확한 버그 패턴을 일반화해서 막는다:
 * not-measured(구형 자유 문자열/ARRANGEMENT_NUANCE)는 어떤 워크스페이스,
 * 어떤 verified 상태에서도 절대 compliant로 세어지지 않는다. 그리고
 * verified 워크스페이스는 not-measured가 너무 많으면(maxNotMeasured 초과)
 * 실제로 막고, 미검증 워크스페이스는 not-measured가 아무리 많아도 절대
 * 막지 않는다.
 */

describe('[지시문 15 TASK C] not-measured은 어떤 워크스페이스에서도 compliant로 세어지지 않는다', () => {
  it.each(ALL_WORKSPACE_IDS)('%s — ARRANGEMENT_NUANCE(구조상 not-measured 유일 규칙)는 항상 not-measured, 절대 compliant 아님', workspaceId => {
    const policy = distinctChoicePolicyForWorkspace(workspaceId);
    const song = buildRuleSong(1, 'ARRANGEMENT_NUANCE', { compliant: true }); // compliant:true를 줘도 규칙 자체가 not-measured
    const result = evaluateDistinctChoiceGate([song], policy, {});
    expect(result.trackResults[0].status).toBe('not-measured');
    expect(result.trackResults[0].status).not.toBe('compliant');
    expect(result.compliantCount).toBe(0);
    expect(result.notMeasuredCount).toBe(1);
  });

  it.each(ALL_WORKSPACE_IDS)('%s — 구형 자유 문자열(ruleId 없음)도 not-measured로 분류되고 compliant로 세어지지 않는다', workspaceId => {
    const policy = distinctChoicePolicyForWorkspace(workspaceId);
    const song = buildLegacyFreeTextSong(1);
    const result = evaluateDistinctChoiceGate([song], policy, {});
    expect(result.trackResults[0].status).toBe('not-measured');
    expect(result.compliantCount).toBe(0);
  });

  it.each(ALL_WORKSPACE_IDS)('%s — distinctChoice 자체가 없는 곡은 missing으로 분류되고, not-measured/compliant 둘 다 아니다', workspaceId => {
    const policy = distinctChoicePolicyForWorkspace(workspaceId);
    const song = buildMissingSong(1);
    const result = evaluateDistinctChoiceGate([song], policy, {});
    expect(result.trackResults[0].status).toBe('missing');
    expect(result.missingCount).toBe(1);
    expect(result.notMeasuredCount).toBe(0);
  });

  it.each(ALL_WORKSPACE_IDS)('%s — complianceRate 계산에서 not-measured/missing은 분모에도 분자에도 들어가지 않는다', workspaceId => {
    const policy = distinctChoicePolicyForWorkspace(workspaceId);
    const rules = policy.allowedRuleIds;
    const compliantSong = buildRuleSong(1, rules[0], { compliant: true });
    const notMeasuredSong = buildRuleSong(2, 'ARRANGEMENT_NUANCE', { compliant: true });
    const missingSong = buildMissingSong(3);
    const result = evaluateDistinctChoiceGate([compliantSong, notMeasuredSong, missingSong], policy, {});
    // 측정 가능한 트랙(compliant+violated)이 1개뿐이고 그게 compliant이므로 100%다 —
    // not-measured 1개·missing 1개가 분모에 끼어들었다면 33%가 나왔을 것이다.
    expect(result.complianceRate).toBe(1);
    expect(result.compliantCount).toBe(1);
  });
});

describe('[지시문 15 TASK C] not-measured 상한(maxNotMeasured) — verified만 실제로 막는다', () => {
  it('senior-oldpop(verified:true) — not-measured가 상한(4)을 넘으면 나머지가 전부 compliant여도 thresholdBlocking:true', () => {
    const policy = distinctChoicePolicyForWorkspace('senior-oldpop');
    const forbidden = safetyForbiddenRuleIdsForWorkspace('senior-oldpop');
    expect(policy.maxNotMeasured).toBe(4);
    const rules = policy.allowedRuleIds;
    // 18곡: 5곡은 완전히 이행(compliant), 13곡은 not-measured — 상한(4)을 훌쩍 넘는다.
    const compliantSongs = Array.from({ length: 5 }, (_, i) => buildRuleSong(i + 1, rules[i % rules.length], { compliant: true }));
    const notMeasuredSongs = Array.from({ length: 13 }, (_, i) => buildRuleSong(i + 6, 'ARRANGEMENT_NUANCE', { compliant: true }));
    const result = evaluateDistinctChoiceGate([...compliantSongs, ...notMeasuredSongs], policy, { safetyForbiddenRuleIds: forbidden });
    expect(result.compliantCount).toBe(5);
    expect(result.complianceRate).toBe(1); // 측정 가능한 5곡은 전부 이행 — 이행률 자체는 100%
    expect(result.notMeasuredCount).toBe(13);
    expect(result.thresholdBlocking).toBe(true); // 그런데도 not-measured 과다로 막힌다
    expect(result.thresholdReasonKo).toMatch(/not-measured/);
  });

  const UNVERIFIED_WORKSPACES: WorkspaceId[] = ALL_WORKSPACE_IDS.filter(id => id !== 'senior-oldpop');

  it.each(UNVERIFIED_WORKSPACES)('%s(verified:false) — 18곡 전부 not-measured여도 절대 막지 않는다', workspaceId => {
    const policy = distinctChoicePolicyForWorkspace(workspaceId);
    const forbidden = safetyForbiddenRuleIdsForWorkspace(workspaceId);
    const archetype = WORKSPACE_REPRESENTATIVE_ARCHETYPE[workspaceId];
    const songs = Array.from({ length: 18 }, (_, i) => buildRuleSong(i + 1, 'ARRANGEMENT_NUANCE', { compliant: true }));
    void archetype;
    const result = evaluateDistinctChoiceGate(songs, policy, { safetyForbiddenRuleIds: forbidden, sameGenderVocalOnly: policy.sameGenderVocalOnly });
    expect(result.notMeasuredCount).toBe(18);
    expect(result.verified).toBe(false);
    expect(result.thresholdBlocking).toBe(false);
  });
});
