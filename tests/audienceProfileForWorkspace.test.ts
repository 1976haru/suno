import { describe, expect, it } from 'vitest';
import { audienceProfileForChannelArchetype, SENIOR_AUDIENCE_PROFILE, audienceProfileForAgeGroup } from '../src/data/audienceProfiles';
import { channelPresets } from '../src/data/presets';

/**
 * v5.7 (TASK B) — real audit finding (docs/v56-report.md §1):
 * WorkspaceDefinition.defaultAudienceProfileId had zero real callers, so
 * kr-2030/jp-2030/kr-idol-male/kr-idol-female all silently generated
 * against the generic `general` profile instead of their own real one.
 * This confirms the fix: each workspace's channel now resolves to its own
 * distinct profile, and senior-oldpop's resolution is an exact no-op.
 */
function channelByArchetype(archetype: string) {
  const channel = channelPresets.find(c => c.archetype === archetype);
  if (!channel) throw new Error(`no fixture channel preset with archetype ${archetype}`);
  return channel;
}

describe('audienceProfileForChannelArchetype', () => {
  it('is a strict no-op for senior-oldpop', () => {
    const channel = channelByArchetype('senior-morning');
    const resolved = audienceProfileForChannelArchetype(channel.archetype, channel.audience);
    expect(resolved).toBe(SENIOR_AUDIENCE_PROFILE);
    expect(resolved).toBe(audienceProfileForAgeGroup('seniors'));
  });

  it('resolves kr-2030 to its own profile, not general', () => {
    const channel = channelByArchetype('kr-2030-pop');
    const resolved = audienceProfileForChannelArchetype(channel.archetype, channel.audience);
    expect(resolved.id).toBe('kr-2030-emotional');
    expect(resolved.id).not.toBe('general');
  });

  it('resolves jp-2030 to its own profile, not general', () => {
    const channel = channelByArchetype('jp-2030-pop');
    const resolved = audienceProfileForChannelArchetype(channel.archetype, channel.audience);
    expect(resolved.id).toBe('jp-2030-melodic');
    expect(resolved.id).not.toBe('general');
  });

  it('resolves kr-idol-male to its own profile, not general', () => {
    const channel = channelByArchetype('kr-idol-male');
    const resolved = audienceProfileForChannelArchetype(channel.archetype, channel.audience);
    expect(resolved.id).toBe('kr-idol-male');
    expect(resolved.id).not.toBe('general');
  });

  it('resolves kr-idol-female to its own profile, not general', () => {
    const channel = channelByArchetype('kr-idol-female');
    const resolved = audienceProfileForChannelArchetype(channel.archetype, channel.audience);
    expect(resolved.id).toBe('kr-idol-female');
    expect(resolved.id).not.toBe('general');
  });

  it('falls back to the age-group resolver for an unrecognized archetype', () => {
    const resolved = audienceProfileForChannelArchetype(undefined, 'general');
    expect(resolved).toBe(audienceProfileForAgeGroup('general'));
  });

  it('the four target workspaces each resolve to a distinct profile', () => {
    const ids = new Set(
      ['kr-2030-pop', 'jp-2030-pop', 'kr-idol-male', 'kr-idol-female'].map(archetype =>
        audienceProfileForChannelArchetype(channelByArchetype(archetype).archetype, 'general').id
      )
    );
    expect(ids.size).toBe(4);
  });
});
