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
    // 지시문 35 (TASK C) — kr-2030-rap 채널 추가로 3 -> 4채널, 워크로드
    // ~33% 증가. 단독 실행은 12초 내외지만 전체 스위트 병렬 실행 시
    // 30000ms를 초과해 타임아웃(실측 확인) — kids/idol과 같은 60000ms로
    // 상향. 검사 내용은 그대로, 여유만 늘린다.
  }, 60000);
});
