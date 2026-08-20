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
    // 지시문 55 — 단독 실행 시 10초대로 여유 있으나 전체 스위트 동시 실행 시
    // (리소스 경합) 30초를 넘겨 간헐적으로 실패한다(지시문54가 kr2030에서
    // 겪은 것과 같은 클래스 — 이 지시문의 변경과는 무관, git stash로 재현
    // 확인). promptLength-idol.test.ts/kr2030.test.ts와 같은 60초로 올린다.
  }, 60000);
});
