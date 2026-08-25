import { describe, expect, it } from 'vitest';
import { partitionArchetypeChoicesByWorkspace } from '../src/utils/channelArchetype';
import { getWorkspace } from '../src/data/workspaces';

/**
 * TASK: Step1 archetype cards filtered by workspace — Step1Channel.tsx's
 * archetypeChoices grid used to show every archetype from every workspace
 * unconditionally (a kr-kids user saw senior-oldpop's 10+ cards too, and
 * could pick one that useChannelManager's saveEditorProfile, v5.9 TASK §3,
 * would then reject only at save time). partitionArchetypeChoicesByWorkspace
 * is the pure predicate Step1Channel.tsx now uses to build its default
 * "this workspace's own cards" view plus the collapsed "다른 유형 보기"
 * section for everything else. Tested here against real getWorkspace() data
 * — this codebase's tests are vitest logic-level, not DOM-rendering (see
 * tests/channelDraftWorkspaceScope.test.ts's own presetsForWorkspace/
 * findArchetypeMismatches tests for the same pattern).
 */
describe('partitionArchetypeChoicesByWorkspace', () => {
  const choices = [
    { id: 'senior-morning', label: 'Senior Morning' },
    { id: 'oldpop-lounge', label: 'Oldpop Lounge' },
    { id: 'kr-kids-song', label: 'KR Kids' },
    { id: 'jp-kids-song', label: 'JP Kids' },
    { id: 'kr-idol-male', label: 'KR Idol Male' },
    { id: 'kr-idol-female', label: 'KR Idol Female' }
  ];

  it('splits choices into inWorkspace/other using the given archetypeIds list', () => {
    const { inWorkspace, other } = partitionArchetypeChoicesByWorkspace(choices, ['kr-kids-song']);
    expect(inWorkspace.map(c => c.id)).toEqual(['kr-kids-song']);
    expect(other.map(c => c.id)).toEqual([
      'senior-morning', 'oldpop-lounge', 'jp-kids-song', 'kr-idol-male', 'kr-idol-female'
    ]);
  });

  it('preserves the original relative order within each bucket', () => {
    const { inWorkspace } = partitionArchetypeChoicesByWorkspace(choices, ['kr-idol-female', 'senior-morning']);
    expect(inWorkspace.map(c => c.id)).toEqual(['senior-morning', 'kr-idol-female']);
  });

  it('an empty archetypeIds list puts everything in "other"', () => {
    const { inWorkspace, other } = partitionArchetypeChoicesByWorkspace(choices, []);
    expect(inWorkspace).toEqual([]);
    expect(other).toHaveLength(choices.length);
  });

  it('an archetypeIds list matching every choice puts everything in "inWorkspace"', () => {
    const allIds = choices.map(c => c.id);
    const { inWorkspace, other } = partitionArchetypeChoicesByWorkspace(choices, allIds);
    expect(inWorkspace).toHaveLength(choices.length);
    expect(other).toEqual([]);
  });

  it('real kr-kids workspace archetypeIds only keeps the kr-kids-song card', () => {
    const { inWorkspace, other } = partitionArchetypeChoicesByWorkspace(choices, getWorkspace('kr-kids').archetypeIds);
    expect(inWorkspace.map(c => c.id)).toEqual(['kr-kids-song']);
    expect(other.map(c => c.id)).toContain('senior-morning');
    expect(other.map(c => c.id)).toContain('kr-idol-male');
  });

  it('real senior-oldpop workspace archetypeIds keeps senior-morning and oldpop-lounge but pushes the 4 new archetypes to "other"', () => {
    const { inWorkspace, other } = partitionArchetypeChoicesByWorkspace(choices, getWorkspace('senior-oldpop').archetypeIds);
    expect(inWorkspace.map(c => c.id).sort()).toEqual(['oldpop-lounge', 'senior-morning']);
    expect(other.map(c => c.id).sort()).toEqual(['jp-kids-song', 'kr-idol-female', 'kr-idol-male', 'kr-kids-song']);
  });

  it('real kr-idol-male/kr-idol-female workspaces each only surface their own card by default', () => {
    expect(partitionArchetypeChoicesByWorkspace(choices, getWorkspace('kr-idol-male').archetypeIds).inWorkspace.map(c => c.id)).toEqual(['kr-idol-male']);
    expect(partitionArchetypeChoicesByWorkspace(choices, getWorkspace('kr-idol-female').archetypeIds).inWorkspace.map(c => c.id)).toEqual(['kr-idol-female']);
  });
});
