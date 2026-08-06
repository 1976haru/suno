import { describe, expect, it } from 'vitest';
import { channelPresets } from '../src/data/presets';
import { workspaceForArchetype } from '../src/data/workspaces';
import { checkPromptLengthForChannels } from './fixtures';

// TASK (CI test-tier split) — see tests/promptLength.test.ts's comment for
// the full rationale. This file covers both kids workspaces (kr-kids,
// archetype 'kr-kids-song'; jp-kids, archetype 'jp-kids-song') — kept
// together rather than as 2 more files since each workspace only has 3
// channels and the combined set is still small relative to senior-oldpop's.
const KIDS_CHANNELS = channelPresets.filter(channel => {
  const id = workspaceForArchetype(channel.archetype)?.id;
  return id === 'kr-kids' || id === 'jp-kids';
});

describe('[P0-1][kids] every generated stylePrompt fits Suno\'s 1,000-char style field', () => {
  it('30 songs x 3 languages x every season, kr-kids/jp-kids channels only, never exceeds SUNO_STYLE_LIMIT', () => {
    expect(KIDS_CHANNELS.length).toBeGreaterThan(0);
    const checked = checkPromptLengthForChannels(KIDS_CHANNELS);
    expect(checked).toBeGreaterThan(0);
  // v5.17 (TASK D) — same "genuine timeout, not a logic bug" class
  // vitest.config.ts's own S4 comment already documents — see
  // tests/promptLength-idol.test.ts's identical fix for the full reasoning.
  }, 60000);
});
