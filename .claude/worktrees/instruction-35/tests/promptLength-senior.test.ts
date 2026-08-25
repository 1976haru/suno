import { describe, expect, it } from 'vitest';
import { channelPresets } from '../src/data/presets';
import { workspaceForArchetype } from '../src/data/workspaces';
import { checkPromptLengthForChannels } from './fixtures';

// TASK (CI test-tier split) — one of 5 files split out of the original
// tests/promptLength.test.ts's single '30 songs x 3 languages x every
// channel/season combo' test (see that file's own comment for the full
// rationale). This file covers only the senior-oldpop workspace's channels
// (channel.archetype resolves to the 'senior-oldpop' WorkspaceDefinition —
// senior-morning/showa-cafe/showa-70s/j2000s/modern-chill/city-night/kids/
// christmas/lofi-study/oldpop-lounge), so it runs independently of and in
// parallel with the other 4 workspace files.
const SENIOR_CHANNELS = channelPresets.filter(
  channel => workspaceForArchetype(channel.archetype)?.id === 'senior-oldpop'
);

describe('[P0-1][senior-oldpop] every generated stylePrompt fits Suno\'s 1,000-char style field', () => {
  it('30 songs x 3 languages x every season, senior-oldpop channels only, never exceeds SUNO_STYLE_LIMIT', () => {
    expect(SENIOR_CHANNELS.length).toBeGreaterThan(0);
    const checked = checkPromptLengthForChannels(SENIOR_CHANNELS);
    expect(checked).toBeGreaterThan(0);
  // v5.17 (TASK D) — senior-oldpop has the most channels of any workspace,
  // so this is the slowest of the 5 promptLength-*.test.ts files; same
  // "genuine timeout, not a logic bug" class vitest.config.ts's own S4
  // comment already documents — see tests/promptLength-idol.test.ts's
  // identical fix for the full reasoning.
  }, 90000);
});
