import { describe, expect, it } from 'vitest';
import type { WorkspaceId } from '../src/types';
import { EXPLORATION_POLICIES } from '../src/data/explorationPolicies';
import {
  buildPolicyExplorationInstructionLines,
  explorationAxisForPolicySequence,
  selectPolicyExplorationTrackNos
} from '../src/core/explorationPolicyEngine';
import { buildIdolPartPatternSet, distinctPatternCount } from '../src/core/idolPartPattern';
import { buildClaudeCodeInstruction } from '../src/core/claudeCodeBridge';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { makeOptions, testMoods, testSeason } from './fixtures';
import { channelPresets, genrePacks } from '../src/data/presets';

const POLICY_WORKSPACES: WorkspaceId[] = ['kr-kids', 'jp-kids', 'kr-idol-male', 'kr-idol-female', 'kr-2030', 'jp-2030'];

/**
 * v5.24 (TASK A/B/C/D) — coverage for the policy-driven exploration engine
 * that every workspace EXCEPT senior-oldpop now uses (senior-oldpop's own
 * behavior stays covered by tests/explorationSlots.test.ts, unchanged).
 */
describe('[v5.24] senior-oldpop stays on the legacy engine, never the policy one', () => {
  it('the policy engine reports senior-oldpop disabled (it is handled by core/explorationSlots.ts instead)', () => {
    const plan = selectPolicyExplorationTrackNos(18, 'senior-oldpop', 0);
    expect(plan.enabled).toBe(false);
    expect(plan.reason).toBe('not-enabled-for-workspace');
  });

  it('data/explorationPolicies.ts still documents a senior-oldpop entry for the §8 "7종" completeness count', () => {
    expect(EXPLORATION_POLICIES['senior-oldpop'].legacyEngine).toBe(true);
    expect(Object.keys(EXPLORATION_POLICIES)).toHaveLength(7);
  });
});

describe('[v5.24 TASK B/C/D] every non-senior workspace gets real, distinct slots', () => {
  it.each(POLICY_WORKSPACES)('%s: 18-song set gets enabled slots, all past track 3', workspaceId => {
    const plan = selectPolicyExplorationTrackNos(18, workspaceId, 0);
    expect(plan.enabled).toBe(true);
    expect(plan.trackNos.length).toBeGreaterThan(0);
    expect(plan.trackNos.every(n => n > 3)).toBe(true);
    expect(new Set(plan.trackNos).size).toBe(plan.trackNos.length);
  });

  it('kids: exactly 2 slots (spec §2-5)', () => {
    expect(selectPolicyExplorationTrackNos(18, 'kr-kids', 0).trackNos).toHaveLength(2);
    expect(selectPolicyExplorationTrackNos(18, 'jp-kids', 0).trackNos).toHaveLength(2);
  });

  it('K-pop: exactly 3 slots (spec §3-4)', () => {
    expect(selectPolicyExplorationTrackNos(18, 'kr-idol-male', 0).trackNos).toHaveLength(3);
    expect(selectPolicyExplorationTrackNos(18, 'kr-idol-female', 0).trackNos).toHaveLength(3);
  });

  it('2030: exactly 4 slots (spec §4-4)', () => {
    expect(selectPolicyExplorationTrackNos(18, 'kr-2030', 0).trackNos).toHaveLength(4);
    expect(selectPolicyExplorationTrackNos(18, 'jp-2030', 0).trackNos).toHaveLength(4);
  });

  it.each(POLICY_WORKSPACES)('%s: a too-small set gets no slots at all', workspaceId => {
    const plan = selectPolicyExplorationTrackNos(4, workspaceId, 0);
    expect(plan.enabled).toBe(false);
    expect(plan.reason).toBe('set-too-small');
  });
});

describe('[v5.24] axis rotation per workspace — never the same axis set reused across workspaces', () => {
  it('kids/kpop/2030 each rotate through their OWN axis count, not a shared one', () => {
    expect(EXPLORATION_POLICIES['kr-kids'].axes).toHaveLength(4);
    expect(EXPLORATION_POLICIES['kr-idol-male'].axes).toHaveLength(6);
    expect(EXPLORATION_POLICIES['kr-2030'].axes).toHaveLength(8);
  });

  it('rotation cycles through all axes uniquely then repeats', () => {
    const policy = EXPLORATION_POLICIES['kr-2030'];
    const axes = Array.from({ length: 8 }, (_, i) => explorationAxisForPolicySequence(policy, i)?.id);
    expect(new Set(axes).size).toBe(8);
    expect(explorationAxisForPolicySequence(policy, 8)?.id).toBe(explorationAxisForPolicySequence(policy, 0)?.id);
  });
});

describe('[v5.24 TASK B §2-4] kids instruction text NEVER says "실패해도"', () => {
  it.each(['kr-kids', 'jp-kids'] as WorkspaceId[])('%s: across every axis in rotation', workspaceId => {
    const policy = EXPLORATION_POLICIES[workspaceId];
    for (let seq = 0; seq < policy.axes.length; seq++) {
      const plan = selectPolicyExplorationTrackNos(18, workspaceId, seq);
      const lines = buildPolicyExplorationInstructionLines(plan).join('\n');
      expect(lines).not.toContain('실패해도');
      expect(lines).toContain(policy.closingLineKo);
    }
  });

  it('kids frozen list has at least 7 items and includes the safety-policy line', () => {
    expect(EXPLORATION_POLICIES['kr-kids'].frozen.length).toBeGreaterThanOrEqual(7);
    expect(EXPLORATION_POLICIES['kr-kids'].frozen.some(line => line.includes('안전 정책'))).toBe(true);
  });
});

describe('[v5.24 TASK C §3-3] K-pop exploration keeps the gender quota — same-gender-only wording', () => {
  it('kr-idol-male instruction states the fixed-male-vocal constraint', () => {
    const plan = selectPolicyExplorationTrackNos(18, 'kr-idol-male', 0);
    const lines = buildPolicyExplorationInstructionLines(plan).join('\n');
    expect(lines).toContain('남성 보컬');
    expect(lines).toContain('고정');
  });

  it('kr-idol-female instruction states the fixed-female-vocal constraint', () => {
    const plan = selectPolicyExplorationTrackNos(18, 'kr-idol-female', 0);
    const lines = buildPolicyExplorationInstructionLines(plan).join('\n');
    expect(lines).toContain('여성 보컬');
    expect(lines).toContain('고정');
  });
});

describe('[v5.24 TASK C §3-5] idol part-pattern set — 8+ distinct patterns, max 3 repeats', () => {
  it('an 18-song set uses at least 8 distinct patterns', () => {
    const patterns = buildIdolPartPatternSet(18, 42);
    expect(patterns).toHaveLength(18);
    expect(distinctPatternCount(patterns)).toBeGreaterThanOrEqual(8);
  });

  it('no pattern repeats more than 3 times', () => {
    const patterns = buildIdolPartPatternSet(18, 7);
    const counts = new Map<string, number>();
    for (const p of patterns) counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(3);
  });

  it('is deterministic for the same seed', () => {
    const a = buildIdolPartPatternSet(18, 99).map(p => p.id);
    const b = buildIdolPartPatternSet(18, 99).map(p => p.id);
    expect(a).toEqual(b);
  });
});

describe('[v5.24 TASK E] distinctChoice wording differs per workspace inside the real instruction', () => {
  function instructionFor(archetype: string) {
    const channel = channelPresets.find(c => c.archetype === archetype);
    if (!channel) throw new Error(`no fixture channel for archetype ${archetype}`);
    const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
    const opts = makeOptions({ channel, songCount: 18 });
    const slots = preallocateSongSlots(opts, genres, undefined);
    return buildClaudeCodeInstruction(opts, genres, testMoods, testSeason, undefined, slots, false);
  }

  it('kr-kids-song: asks for "kidsAction", not a novelty-framed question', () => {
    const instruction = instructionFor('kr-kids-song');
    expect(instruction).toContain('kidsAction');
  });

  it('kr-idol-male: asks for the part-pattern description', () => {
    const instruction = instructionFor('kr-idol-male');
    expect(instruction).toContain('파트 배분 패턴');
  });

  it('kr-2030-pop: uses the bolder "정전이 없습니다" framing', () => {
    const instruction = instructionFor('kr-2030-pop');
    expect(instruction).toContain('정전이 없습니다');
  });

  it('senior-morning (senior-oldpop workspace): keeps the pre-v5.24 wording exactly', () => {
    const instruction = instructionFor('senior-morning');
    expect(instruction).toContain('같은 시도를 두 곡 이상에 쓰지 마십시오');
  });
});

describe('[v5.24 TASK G] set-completeness advisory block is present but non-blocking', () => {
  it('kr-2030-pop instruction includes the contrast/yielding/last-track suggestions', () => {
    const channel = channelPresets.find(c => c.archetype === 'kr-2030-pop')!;
    const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
    const opts = makeOptions({ channel, songCount: 18 });
    const slots = preallocateSongSlots(opts, genres, undefined);
    const instruction = buildClaudeCodeInstruction(opts, genres, testMoods, testSeason, undefined, slots, false);
    expect(instruction).toContain('대비를 만드십시오');
    expect(instruction).toContain('제안, 강제 아님');
    expect(instruction).toContain('여운을 남기며');
  });

  it('K-pop instruction has no forced story-thread suggestion (spec §7-1 "없어도 됨")', () => {
    const channel = channelPresets.find(c => c.archetype === 'kr-idol-male')!;
    const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
    const opts = makeOptions({ channel, songCount: 18 });
    const slots = preallocateSongSlots(opts, genres, undefined);
    const instruction = buildClaudeCodeInstruction(opts, genres, testMoods, testSeason, undefined, slots, false);
    expect(instruction).not.toContain('이야기 하나를 둘 수 있습니다');
  });
});
