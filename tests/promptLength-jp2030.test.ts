import { describe, expect, it } from 'vitest';
import { channelPresets } from '../src/data/presets';
import { workspaceForArchetype } from '../src/data/workspaces';
import { checkPromptLengthForChannels } from './fixtures';

// TASK (CI test-tier split) — see tests/promptLength.test.ts's comment for
// the full rationale. This file covers only the jp-2030 workspace's
// channels (archetype 'jp-2030-pop').
const JP2030_CHANNELS = channelPresets.filter(
  channel => workspaceForArchetype(channel.archetype)?.id === 'jp-2030'
);

describe('[P0-1][jp-2030] every generated stylePrompt fits Suno\'s 1,000-char style field', () => {
  it('30 songs x 3 languages x every season, jp-2030 channels only, never exceeds SUNO_STYLE_LIMIT', () => {
    expect(JP2030_CHANNELS.length).toBeGreaterThan(0);
    const checked = checkPromptLengthForChannels(JP2030_CHANNELS);
    expect(checked).toBeGreaterThan(0);
  }, 30000);
});
