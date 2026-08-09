import { describe, expect, it } from 'vitest';
import { matchesLedgerScope } from '../src/core/workspaceScope';
import { resolveArchetypeForChannel, resolveWorkspaceIdForChannel } from '../src/core/channelWorkspaceResolution';
import { channelPresets } from './fixtures';

/**
 * 지시문 14 (TASK C) — matchesLedgerScope is the one real behavior change
 * every avoid-list ledger's scoped read (recentSituations/usedHooks/
 * recentLyricLines/recentFingerprints/etc.) now goes through; the ledgers
 * themselves stay untestable IndexedDB CRUD in this Node vitest environment
 * (see tests/lyricLineLedger.test.ts's own doc comment), so this file tests
 * the shared predicate directly instead.
 */
describe('[지시문 14 TASK C] matchesLedgerScope', () => {
  const record = { workspaceId: 'kr-2030' as const, channelId: 'after-work-band-pop' };

  it('workspace scope matches by workspaceId, regardless of channelId', () => {
    expect(matchesLedgerScope(record, { workspaceId: 'kr-2030' })).toBe(true);
    expect(matchesLedgerScope(record, { workspaceId: 'senior-oldpop' })).toBe(false);
  });

  it('channel scope matches by channelId, regardless of workspaceId — the diagnostic/display carve-out (지시문 14 §C-2)', () => {
    expect(matchesLedgerScope(record, { channelId: 'after-work-band-pop' })).toBe(true);
    expect(matchesLedgerScope(record, { channelId: 'some-other-channel' })).toBe(false);
  });

  it('a record with no workspaceId at all defaults to senior-oldpop for workspace-scope matching (same default scopeFilter already used)', () => {
    const untagged = { channelId: 'good-morning-memory-radio' };
    expect(matchesLedgerScope(untagged, { workspaceId: 'senior-oldpop' })).toBe(true);
    expect(matchesLedgerScope(untagged, { workspaceId: 'kr-2030' })).toBe(false);
  });

  it("a record explicitly tagged 'unknown' (지시문 14 TASK C-3's migration fallback) never matches any real workspace scope", () => {
    const unresolved = { workspaceId: 'unknown' as const, channelId: 'oldpoplounge' };
    expect(matchesLedgerScope(unresolved, { workspaceId: 'senior-oldpop' })).toBe(false);
    expect(matchesLedgerScope(unresolved, { workspaceId: 'kr-2030' })).toBe(false);
    // still reachable via its own real channelId, for diagnostic/display purposes.
    expect(matchesLedgerScope(unresolved, { channelId: 'oldpoplounge' })).toBe(true);
  });
});

describe('[지시문 14 TASK C-3 / TASK D] resolveArchetypeForChannel / resolveWorkspaceIdForChannel', () => {
  it('resolves a built-in preset channelId to its real archetype, no storage read needed', () => {
    const preset = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
    expect(resolveArchetypeForChannel('good-morning-memory-radio')).toBe(preset.archetype);
  });

  it('resolves a built-in preset channelId all the way to its owning workspace', () => {
    expect(resolveWorkspaceIdForChannel('good-morning-memory-radio')).toBe('senior-oldpop');
    expect(resolveWorkspaceIdForChannel('after-work-band-pop')).toBe('kr-2030');
  });

  it('returns undefined for an unknown channelId (e.g. a custom channel this Node environment has no localStorage to check) rather than guessing', () => {
    expect(resolveArchetypeForChannel('oldpoplounge')).toBeUndefined();
    expect(resolveWorkspaceIdForChannel('oldpoplounge')).toBeUndefined();
  });
});
