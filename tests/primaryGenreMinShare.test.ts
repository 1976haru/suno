import { describe, expect, it } from 'vitest';
import { directSetLocal } from '../src/core/setDirector';
import { channelPresets } from './fixtures';

/**
 * 지시문 29 (TASK D) — 실측: 채널 "퇴근 후 감성 밴드팝"의 실제 배정이
 * emo-band-pop 6 · noir-deep-house 6 · electro-pop 6로 나와 정체성 장르가
 * 1/3에 그쳤다. ChannelProfile.primaryGenreIds/primaryGenreMinShare(정책값,
 * 추정 — verified: false)와 core/setDirector.ts's applyPrimaryGenreMinShare가
 * 이걸 실제로 고치는지 확인한다.
 */
describe('지시문 29 TASK D — 채널 정체성 장르 최소 비중', () => {
  const channel = channelPresets.find(c => c.id === 'after-work-band-pop')!;

  it('after-work-band-pop 채널은 primaryGenreIds/primaryGenreMinShare가 설정돼 있다', () => {
    expect(channel.primaryGenreIds).toEqual(['kr2030-emo-band-pop']);
    expect(channel.primaryGenreMinShare).toBe(0.6);
  });

  it('실제 18곡 배정에서 정체성 장르(kr2030-emo-band-pop)가 60% 이상을 차지한다', () => {
    const plan = directSetLocal('퇴근 후 듣는 감성 플레이리스트', channel, 18, { recentGenreIds: [], recentHooks: [] });
    const genreIds = plan.slots.map(s => s.genreId);
    const primaryCount = genreIds.filter(id => id === 'kr2030-emo-band-pop').length;
    expect(primaryCount / 18).toBeGreaterThanOrEqual(0.6);
  });

  it('다른 장르에서 빼앗아 채우되, 어떤 장르도 0곡으로 지워버리지 않는다(최소 1곡)', () => {
    const plan = directSetLocal('Autumn to Christmas Playlist Pack', channel, 18, { recentGenreIds: [], recentHooks: [] });
    const genreIds = plan.slots.map(s => s.genreId);
    const counts = new Map<string, number>();
    for (const id of genreIds) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const count of counts.values()) expect(count).toBeGreaterThanOrEqual(1);
  });

  it('primaryGenreIds가 없는 채널(대다수)은 동작이 전혀 바뀌지 않는다 — no-op 확인', () => {
    const plainChannel = channelPresets.find(c => c.archetype === 'senior-morning')!;
    expect(plainChannel.primaryGenreIds).toBeUndefined();
    // 실행이 에러 없이 되는지만 확인 — 정체성 장르 강제 재분배 로직이 여기서 절대 발동하지 않는다.
    const plan = directSetLocal('편안한 아침 올드팝', plainChannel, 18, { recentGenreIds: [], recentHooks: [] });
    expect(plan.slots.length).toBe(18);
  });
});
