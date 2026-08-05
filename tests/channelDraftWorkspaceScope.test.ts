import { describe, expect, it } from 'vitest';
import { createDraftChannel } from '../src/utils/channelProfile';
import { findArchetypeMismatches, presetsForWorkspace } from '../src/hooks/useChannelManager';
import { getWorkspace } from '../src/data/workspaces';
import type { ChannelProfile } from '../src/types';

/**
 * v5.9 (TASK: workspace-scoped draft channels) — a third-party audit + a
 * verified read of the actual code found that createDraftChannel took no
 * workspace parameter at all, so BOTH useChannelManager call sites
 * (addQuickChannel, startNewProfile) always produced a 'senior-morning'
 * archetype channel no matter which workspace the user was actually in
 * (e.g. kr-kids). These tests exercise the real, exported functions against
 * real workspace/preset data — not mocks — the same way the rest of this
 * suite already tests createDraftChannel/normalizeChannel (see
 * channelProfileAudience.test.ts).
 */
describe('[v5.9] createDraftChannel is workspace-aware via an optional templateChannel', () => {
  it('no templateChannel (backward-compatible) still falls back to the old senior-morning/custom/english default', () => {
    const channel = createDraftChannel('오늘 만든 채널');
    expect(channel.archetype).toBe('senior-morning');
    expect(channel.market).toBe('custom');
    expect(channel.primaryLanguage).toBe('english');
    expect(channel.audience).toBe('seniors');
  });

  it('BEFORE this fix\'s equivalent: a draft created while in kr-kids workspace with no template still lands on senior-morning (documents the bug this task closes)', () => {
    const beforeFixChannel = createDraftChannel('키즈 채널');
    expect(beforeFixChannel.archetype).toBe('senior-morning');
    expect(getWorkspace('kr-kids').archetypeIds).not.toContain(beforeFixChannel.archetype);
  });

  it('AFTER the fix: passing kr-kids workspace\'s own real default preset as templateChannel clones its archetype/audience/market/defaultVocal/preferredGenres', () => {
    const krKidsDefault = presetsForWorkspace('kr-kids')[0];
    expect(krKidsDefault.archetype).toBe('kr-kids-song');

    const channel = createDraftChannel('우리 아이 채널', krKidsDefault);
    expect(channel.archetype).toBe('kr-kids-song');
    expect(channel.audience).toBe(krKidsDefault.audience);
    expect(channel.market).toBe(krKidsDefault.market);
    expect(channel.defaultVocal).toBe(krKidsDefault.defaultVocal);
    expect(channel.preferredGenres).toEqual(krKidsDefault.preferredGenres);
    // the new draft's own identity (name/id) must still be the caller's, not the template's
    expect(channel.name).toBe('우리 아이 채널');
    expect(channel.id).not.toBe(krKidsDefault.id);
    // and it must actually belong to kr-kids's own workspace scope now
    expect(getWorkspace('kr-kids').archetypeIds).toContain(channel.archetype);
  });

  it('works the same way for every other non-default workspace (kr-2030, jp-2030, jp-kids, kr-idol-male, kr-idol-female)', () => {
    const workspaceIds = ['kr-2030', 'jp-2030', 'jp-kids', 'kr-idol-male', 'kr-idol-female'] as const;
    for (const workspaceId of workspaceIds) {
      const defaultChannel = presetsForWorkspace(workspaceId)[0];
      const draft = createDraftChannel('New Channel', defaultChannel);
      expect(getWorkspace(workspaceId).archetypeIds).toContain(draft.archetype);
      expect(draft.market).toBe(defaultChannel.market);
      expect(draft.audience).toBe(defaultChannel.audience);
    }
  });

  it('startNewProfile-style call (no explicit name) still gets the default draft name alongside the workspace template', () => {
    const jpKidsDefault = presetsForWorkspace('jp-kids')[0];
    const channel = createDraftChannel(undefined, jpKidsDefault);
    expect(channel.name).toBe('New Playlist Channel');
    expect(channel.archetype).toBe('jp-kids-song');
  });
});

describe('[v5.9] findArchetypeMismatches — load-time warning for already-mis-saved channels', () => {
  function fakeCustomChannel(overrides: Partial<ChannelProfile>): ChannelProfile {
    return {
      id: overrides.id || 'custom-1',
      name: overrides.name || 'Custom Channel',
      market: 'custom',
      primaryLanguage: 'english',
      audience: 'seniors',
      promise: 'x',
      visualIdentity: 'x',
      defaultVocal: 'x',
      preferredGenres: [],
      preferredMoods: [],
      forbiddenCliches: [],
      seoKeywords: [],
      archetype: 'senior-morning',
      ...overrides
    };
  }

  it('flags a custom channel whose archetype is not in the given workspace\'s real archetypeIds (a pre-fix bug-created channel)', () => {
    const mismatched = fakeCustomChannel({ id: 'bad-1', name: '잘못 저장된 채널', archetype: 'senior-morning' });
    const result = findArchetypeMismatches('kr-kids', [mismatched]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('bad-1');
  });

  it('does not flag a channel whose archetype genuinely belongs to that workspace', () => {
    const valid = fakeCustomChannel({ id: 'good-1', archetype: 'kr-kids-song' });
    expect(findArchetypeMismatches('kr-kids', [valid])).toEqual([]);
  });

  it('never auto-fixes — returns the mismatched channel completely untouched (deliberate per task spec, a mismatch may be intentional)', () => {
    const mismatched = fakeCustomChannel({ id: 'deliberate-mix', archetype: 'kr-2030-pop', preferredGenres: ['acoustic-pop'] });
    const [result] = findArchetypeMismatches('kr-kids', [mismatched]);
    expect(result).toEqual(mismatched);
  });

  it('an empty custom-channel list never flags anything', () => {
    expect(findArchetypeMismatches('kr-kids', [])).toEqual([]);
  });

  it('real senior-oldpop workspace channels are never flagged against their own workspace (regression guard against false positives)', () => {
    const seniorPresets = presetsForWorkspace('senior-oldpop');
    expect(findArchetypeMismatches('senior-oldpop', seniorPresets)).toEqual([]);
  });
});

describe('[v5.9] save-time archetype validation predicate (the same check saveEditorProfile uses)', () => {
  it('senior-morning is not an allowed archetype for the kr-kids workspace (the exact case the bug report names)', () => {
    expect(getWorkspace('kr-kids').archetypeIds).not.toContain('senior-morning');
  });

  it('kr-kids-song IS allowed for kr-kids', () => {
    expect(getWorkspace('kr-kids').archetypeIds).toContain('kr-kids-song');
  });

  it('every workspace\'s own default preset archetype passes its own validation check (no workspace ships an inconsistent default)', () => {
    const workspaceIds = ['senior-oldpop', 'kr-2030', 'jp-2030', 'kr-kids', 'jp-kids', 'kr-idol-male', 'kr-idol-female'] as const;
    for (const workspaceId of workspaceIds) {
      const defaultChannel = presetsForWorkspace(workspaceId)[0];
      expect(getWorkspace(workspaceId).archetypeIds).toContain(defaultChannel.archetype);
    }
  });
});
