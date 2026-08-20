import { describe, expect, it } from 'vitest';
import { channelPresets } from '../src/data/presets';
import { workspaceForArchetype } from '../src/data/workspaces';
import { checkPromptLengthForChannels } from './fixtures';

// TASK (CI test-tier split) — see tests/promptLength.test.ts's comment for
// the full rationale. This file covers only the kr-2030 workspace's
// channels (archetype 'kr-2030-pop').
const KR2030_CHANNELS = channelPresets.filter(
  channel => workspaceForArchetype(channel.archetype)?.id === 'kr-2030'
);

describe('[P0-1][kr-2030] every generated stylePrompt fits Suno\'s 1,000-char style field', () => {
  it('30 songs x 3 languages x every season, kr-2030 channels only, never exceeds SUNO_STYLE_LIMIT', () => {
    expect(KR2030_CHANNELS.length).toBeGreaterThan(0);
    const checked = checkPromptLengthForChannels(KR2030_CHANNELS);
    expect(checked).toBeGreaterThan(0);
    // 지시문 53 (TASK A) — kr-2030-rap 채널 신설로 3채널 -> 4채널(+33%
    // 작업량). 단독 실행 시 11초대로 여유 있으나 전체 스위트 동시 실행
    // 시(리소스 경합) 30초를 넘겨 promptLength-idol.test.ts와 같은
    // 60초로 올린다(idol도 채널 다수라 같은 티어).
  }, 60000);
});
