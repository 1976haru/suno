import { describe, expect, it } from 'vitest';
import { axisLabelKoFor } from '../src/components/ExplorationLedgerPanel';
import { explorationPolicyFor } from '../src/data/explorationPolicies';

/**
 * v5.24 integration fix — real gap this closes: v5.24 added a second
 * exploration engine (core/explorationPolicyEngine.ts) for kr-kids/jp-kids/
 * kr-idol-male/kr-idol-female/kr-2030/jp-2030 that records into the SAME
 * ledger core/explorationSlots.ts's senior-oldpop-only engine already used,
 * but ExplorationLedgerPanel.tsx's own axis-label lookup (AXIS_LABEL_KO)
 * only ever covered the first engine's 7 fixed ids — a policy-engine
 * record's axis (e.g. 'axis-onomatopoeia') fell through to showing the raw
 * id. axisLabelKoFor checks both engines' own label sources.
 */
describe('[v5.24 integration] axisLabelKoFor', () => {
  it('resolves a senior-oldpop legacy axis id via AXIS_LABEL_KO', () => {
    expect(axisLabelKoFor('senior-oldpop', 'structure')).toBe('구조');
  });

  it('resolves a kr-kids policy axis id via its own labelKo', () => {
    const label = axisLabelKoFor('kr-kids', 'axis-onomatopoeia');
    expect(label).not.toBe('axis-onomatopoeia');
    expect(label).toBe(explorationPolicyFor('kr-kids').axes.find(a => a.id === 'axis-onomatopoeia')?.labelKo);
  });

  it('resolves a kr-idol-male policy axis id via its own labelKo', () => {
    const label = axisLabelKoFor('kr-idol-male', 'axis-part-split');
    expect(label).not.toBe('axis-part-split');
  });

  it('resolves a kr-2030 policy axis id via its own labelKo', () => {
    const label = axisLabelKoFor('kr-2030', 'axis-genre-blend');
    expect(label).not.toBe('axis-genre-blend');
  });

  it('falls back to the raw id when nothing matches in either engine (never throws)', () => {
    expect(axisLabelKoFor('kr-2030', 'nonexistent-axis')).toBe('nonexistent-axis');
  });
});

describe('[v5.24 integration] explorationPolicyFor(...).enabled covers every real workspace', () => {
  it('every workspace this app actually ships has an EXPLORATION_POLICIES entry (never crashes the tab-visibility check)', () => {
    const workspaceIds = ['senior-oldpop', 'kr-kids', 'jp-kids', 'kr-idol-male', 'kr-idol-female', 'kr-2030', 'jp-2030'] as const;
    for (const workspaceId of workspaceIds) {
      expect(() => explorationPolicyFor(workspaceId).enabled).not.toThrow();
      expect(explorationPolicyFor(workspaceId).enabled).toBe(true);
    }
  });
});
