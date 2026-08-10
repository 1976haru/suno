import { describe, expect, it } from 'vitest';
import { computeWorkspaceReadiness } from '../src/core/workspaceReadiness';
import { workspaceDefinitions } from '../src/data/workspaces';

/**
 * 지시문 28 (TASK B) — 워크스페이스 선택 화면의 "준비 상태" 배지가 실제로
 * 계산하는 값의 회귀 테스트. 차단이 아니라 표시용이므로 여기서 검증하는
 * 것은 "숫자가 실측과 일치하는가"이지 "임계값을 넘겨야 통과인가"가 아니다.
 */
describe('지시문 28 TASK B — computeWorkspaceReadiness', () => {
  it('5개 축을 전부 반환한다', () => {
    const senior = workspaceDefinitions.find(w => w.id === 'senior-oldpop')!;
    const readiness = computeWorkspaceReadiness(senior, 0);
    expect(readiness.total).toBe(5);
    expect(readiness.items.map(i => i.id)).toEqual([
      'genre-pool', 'money-chord-pool', 'lyric-theme-pool', 'audience-profile', 'verified-packs'
    ]);
  });

  it('실전 검증 세트 수는 호출자가 넘긴 값을 그대로 반영한다(차단 없음, 표시만)', () => {
    const senior = workspaceDefinitions.find(w => w.id === 'senior-oldpop')!;
    const zero = computeWorkspaceReadiness(senior, 0);
    expect(zero.items.find(i => i.id === 'verified-packs')!.ok).toBe(false);
    const some = computeWorkspaceReadiness(senior, 6);
    expect(some.items.find(i => i.id === 'verified-packs')!.ok).toBe(true);
    expect(some.items.find(i => i.id === 'verified-packs')!.detailKo).toBe('6세트');
  });

  it('프리셋 채널이 없는 아키타입(christmas/lofi-study)은 senior-oldpop의 최악값 판정에서 제외된다', () => {
    // showa-cafe(프리셋 있음, 실측 3종)가 이 워크스페이스의 진짜 최소 장르 풀이다 —
    // christmas/lofi-study(프리셋 자체가 없어 0종)가 최소값을 끌어내리면 안 된다.
    const senior = workspaceDefinitions.find(w => w.id === 'senior-oldpop')!;
    const readiness = computeWorkspaceReadiness(senior, 0);
    const genrePool = readiness.items.find(i => i.id === 'genre-pool')!;
    expect(genrePool.detailKo).not.toContain('0종');
  });

  it('kr-2030/jp-2030/kr-kids/jp-kids/kr-idol-*는 장르·머니코드·lyricTheme·audienceProfile 4축을 통과한다(지시문 27/12/23이 이미 채운 것)', () => {
    const singleArchetypeIds = ['kr-2030', 'jp-2030', 'kr-kids', 'jp-kids', 'kr-idol-male', 'kr-idol-female'];
    for (const id of singleArchetypeIds) {
      const ws = workspaceDefinitions.find(w => w.id === id)!;
      const readiness = computeWorkspaceReadiness(ws, 0);
      const nonPackItems = readiness.items.filter(i => i.id !== 'verified-packs');
      expect(nonPackItems.every(i => i.ok), `${id}: ${JSON.stringify(nonPackItems)}`).toBe(true);
    }
  });

  it('모든 워크스페이스가 실전 검증 0세트일 때는 항상 fail(정직한 미검증 표시)', () => {
    for (const ws of workspaceDefinitions) {
      const readiness = computeWorkspaceReadiness(ws, 0);
      expect(readiness.items.find(i => i.id === 'verified-packs')!.ok).toBe(false);
    }
  });
});
