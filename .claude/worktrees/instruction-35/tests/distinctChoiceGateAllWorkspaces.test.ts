import { describe, expect, it } from 'vitest';
import { evaluateDistinctChoiceGate } from '../src/core/distinctChoiceGate';
import { distinctChoicePolicyForWorkspace, safetyForbiddenRuleIdsForWorkspace } from '../src/data/distinctChoicePolicy';
import { scoreSongs } from '../src/core/quality';
import { channelPresets } from './fixtures';
import type { ChannelProfile, WorkspaceId } from '../src/types';
import {
  ALL_WORKSPACE_IDS,
  WORKSPACE_REPRESENTATIVE_ARCHETYPE,
  buildRuleSong,
  toFullSongIdea
} from './distinctChoiceWorkspaceFixtures';

/**
 * 지시문 15 (TASK C, 필수 테스트 파일) — "구조는 7개 워크스페이스 공통,
 * 차단 권한은 실측된 곳에만 준다"를 7개 전부에서 실측으로 증명한다.
 * senior-oldpop만 실제로 blocking(threshold/qualityScore 둘 다)할 수 있고,
 * 나머지 6개는 완전히 똑같이 나쁜 위반 패턴을 줘도 절대 blocking하지
 * 않는다는 것을 같은 코드 경로(core/distinctChoiceGate.ts,
 * core/quality.ts의 scoreSongs)로 확인한다.
 */

function channelFor(archetype: string): ChannelProfile {
  const channel = channelPresets.find(c => c.archetype === archetype);
  if (!channel) throw new Error(`no channel preset for archetype ${archetype}`);
  return channel;
}

/** 18곡, policy.allowedRuleIds를 돌려가며 전부 compliant 또는 전부 violated로 채운 fixture. */
function buildFixture(workspaceId: WorkspaceId, compliant: boolean) {
  const policy = distinctChoicePolicyForWorkspace(workspaceId);
  const archetype = WORKSPACE_REPRESENTATIVE_ARCHETYPE[workspaceId];
  const rules = policy.allowedRuleIds;
  const minimalSongs = Array.from({ length: 18 }, (_, i) => {
    const ruleId = rules[i % rules.length];
    return buildRuleSong(i + 1, ruleId, { compliant });
  });
  return minimalSongs.map(song => toFullSongIdea(song, archetype));
}

describe.each(ALL_WORKSPACE_IDS)('[지시문 15 TASK C] distinctChoice gate — %s', workspaceId => {
  const policy = distinctChoicePolicyForWorkspace(workspaceId);
  const forbidden = safetyForbiddenRuleIdsForWorkspace(workspaceId);

  it('전부 위반인 18곡 fixture는 실제로 violatedCount=18, complianceRate=0을 낸다(같은 판정 코드가 실제로 동작함)', () => {
    const songs = buildFixture(workspaceId, false);
    const result = evaluateDistinctChoiceGate(songs, policy, { safetyForbiddenRuleIds: forbidden, sameGenderVocalOnly: policy.sameGenderVocalOnly });
    expect(result.violatedCount).toBe(18);
    expect(result.complianceRate).toBe(0);
  });

  it('전부 이행인 18곡 fixture는 실제로 compliantCount=18, complianceRate=1을 낸다', () => {
    const songs = buildFixture(workspaceId, true);
    const result = evaluateDistinctChoiceGate(songs, policy, { safetyForbiddenRuleIds: forbidden, sameGenderVocalOnly: policy.sameGenderVocalOnly });
    expect(result.compliantCount).toBe(18);
    expect(result.complianceRate).toBe(1);
  });

  if (workspaceId === 'senior-oldpop') {
    it('senior-oldpop(verified:true) — 전부 위반이면 실제로 thresholdBlocking:true', () => {
      const songs = buildFixture(workspaceId, false);
      const result = evaluateDistinctChoiceGate(songs, policy, { safetyForbiddenRuleIds: forbidden });
      expect(result.verified).toBe(true);
      expect(result.thresholdBlocking).toBe(true);
      expect(result.thresholdReasonKo).toBeTruthy();
    });

    it('senior-oldpop — 전부 이행이면 thresholdBlocking:false(항상 막는 게 아니라 실제로 통과도 한다)', () => {
      const songs = buildFixture(workspaceId, true);
      const result = evaluateDistinctChoiceGate(songs, policy, { safetyForbiddenRuleIds: forbidden });
      expect(result.thresholdBlocking).toBe(false);
    });
  } else {
    it(`${workspaceId}(verified:false) — 전부 위반이어도 thresholdBlocking은 항상 false다(advisory 전용)`, () => {
      const songs = buildFixture(workspaceId, false);
      const result = evaluateDistinctChoiceGate(songs, policy, { safetyForbiddenRuleIds: forbidden, sameGenderVocalOnly: policy.sameGenderVocalOnly });
      expect(result.verified).toBe(false);
      expect(result.violatedCount).toBe(18); // 위반은 실제로 계산된다 — 숨기지 않는다
      expect(result.thresholdBlocking).toBe(false); // 그런데도 절대 막지 않는다
    });
  }

  it('qualityScore — verified 위반만 감점되고, 미검증 위반은 경고만 붙고 점수는 그대로다', () => {
    const archetype = WORKSPACE_REPRESENTATIVE_ARCHETYPE[workspaceId];
    const channel = channelFor(archetype);
    // 같은 곡(가사·스타일프롬프트 등 나머지 필드 전부 동일)에서 distinctChoice
    // 판정 결과만 다르게 만들어 델타를 잰다 — "전부 위반 fixture" vs "전부
    // 이행 fixture"를 통째로 비교하면 규칙별로 달라지는 다른 축(구조 점수 등)
    // 차이가 섞여 distinctChoice 자체의 기여만 분리할 수 없기 때문이다.
    const violatedSongs = buildFixture(workspaceId, false);
    const strippedSongs = violatedSongs.map(song => ({ ...song, distinctChoice: undefined, distinctChoiceRuleId: undefined, distinctChoiceParams: undefined }));
    const scoredWithRule = scoreSongs(violatedSongs, channel, 'english');
    const scoredWithoutRule = scoreSongs(strippedSongs, channel, 'english');
    const deltas = scoredWithRule.map((song, i) => song.qualityScore - scoredWithoutRule[i].qualityScore);
    if (workspaceId === 'senior-oldpop') {
      // verified — 위반이 있는 트랙마다 실제로 감점이 들어가야 한다.
      expect(deltas.every(delta => delta < 0)).toBe(true);
    } else {
      // 미검증 — 위반이 실제로 계산돼도(위 테스트로 이미 확인) qualityScore
      // 델타는 항상 0이어야 한다(§B-2 "advisory 전용, 절대 qualityScore에
      // 반영하지 않는다").
      expect(deltas.every(delta => delta === 0)).toBe(true);
    }
  });
});

describe('[지시문 15 TASK C] 안전 제약 — verified와 무관하게 항상 실제로 감점된다', () => {
  const SAFETY_TARGET_WORKSPACES: WorkspaceId[] = ['kr-kids', 'jp-kids', 'kr-idol-male', 'kr-idol-female'];

  it.each(SAFETY_TARGET_WORKSPACES)('%s — safetyForbiddenRuleIds에 있는 규칙을 쓰면 qualityScore가 실제로 감점된다(verified:false여도)', workspaceId => {
    const policy = distinctChoicePolicyForWorkspace(workspaceId);
    const forbidden = safetyForbiddenRuleIdsForWorkspace(workspaceId);
    expect(forbidden.length).toBeGreaterThan(0);
    const archetype = WORKSPACE_REPRESENTATIVE_ARCHETYPE[workspaceId];
    const channel = channelFor(archetype);
    const forbiddenRuleId = forbidden[0];
    const song = toFullSongIdea(buildRuleSong(1, forbiddenRuleId, { compliant: true }), archetype);
    const stripped = { ...song, distinctChoice: undefined, distinctChoiceRuleId: undefined, distinctChoiceParams: undefined };

    // 게이트 자체가 안전 위반을 실제로 잡는지 먼저 확인(§B-2).
    const gateResult = evaluateDistinctChoiceGate([song], policy, { safetyForbiddenRuleIds: forbidden, sameGenderVocalOnly: policy.sameGenderVocalOnly });
    expect(gateResult.safetyBlocking).toBe(true);
    expect(policy.verified).toBe(false); // 이 4개 워크스페이스는 전부 미검증인데도

    const scoredWith = scoreSongs([song], channel, 'english')[0];
    const scoredWithout = scoreSongs([stripped], channel, 'english')[0];
    expect(scoredWith.qualityScore).toBeLessThan(scoredWithout.qualityScore);
  });
});
