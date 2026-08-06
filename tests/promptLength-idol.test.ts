import { describe, expect, it } from 'vitest';
import { channelPresets } from '../src/data/presets';
import { workspaceForArchetype } from '../src/data/workspaces';
import { checkPromptLengthForChannels } from './fixtures';

// TASK (CI test-tier split) — see tests/promptLength.test.ts's comment for
// the full rationale. This file covers both idol workspaces (kr-idol-male,
// kr-idol-female) — kept together for the same small-channel-count reason
// as tests/promptLength-kids.test.ts.
const IDOL_CHANNELS = channelPresets.filter(channel => {
  const id = workspaceForArchetype(channel.archetype)?.id;
  return id === 'kr-idol-male' || id === 'kr-idol-female';
});

describe('[P0-1][idol] every generated stylePrompt fits Suno\'s 1,000-char style field', () => {
  it('30 songs x 3 languages x every season, kr-idol-male/kr-idol-female channels only, never exceeds SUNO_STYLE_LIMIT', () => {
    expect(IDOL_CHANNELS.length).toBeGreaterThan(0);
    const checked = checkPromptLengthForChannels(IDOL_CHANNELS);
    expect(checked).toBeGreaterThan(0);
  }, 30000);
});
