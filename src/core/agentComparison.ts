import type { PackGeneratedBy, SavedPackMeta } from '../types';
import type { RatingRecord } from './ratingLedger';

/**
 * 지시문 18 (TASK C-3) — "생성 에이전트별 실측" 집계. 순수 함수 — IndexedDB를
 * 직접 읽지 않는다(호출부가 listPacks()/getRatings()로 미리 가져온 값을
 * 넘긴다, 이 파일의 다른 core/*Store.ts 관례와 동일).
 *
 * "자동 판정 금지 — 앱이 우열을 결론내지 않는다"를 이 파일의 반환 타입
 * 자체로 강제한다: AgentComparisonStat에는 순수 실측값만 있고, "더 낫다"
 * 류의 파생 필드가 없다. sampleSufficient만 UI에 "표본 부족이라 비교로
 * 제시하지 말라"는 신호를 준다 — 그 자체가 판정은 아니다.
 */
export const MIN_SETS_FOR_AGENT_COMPARISON = 3;

export interface AgentComparisonStat {
  generatedBy: PackGeneratedBy;
  setCount: number;
  songCount: number;
  avgQualityScore: number;
  ratedSongCount: number;
  goodPct: number;
  badPct: number;
  /** setCount >= MIN_SETS_FOR_AGENT_COMPARISON일 때만 true — 미만이면 UI가 수치를 비교로 보여주지 않는다. */
  sampleSufficient: boolean;
}

export function computeAgentComparisonStats(packs: SavedPackMeta[], ratings: RatingRecord[]): AgentComparisonStat[] {
  const packsByAgent = new Map<PackGeneratedBy, SavedPackMeta[]>();
  for (const pack of packs) {
    const key = pack.generatedBy ?? 'other';
    const list = packsByAgent.get(key) ?? [];
    list.push(pack);
    packsByAgent.set(key, list);
  }

  // RatingRecord.generatedBy가 없는(이 필드가 생기기 전에 채점된) 기록은
  // 조용히 'other'로 몰아넣지 않고 집계에서 제외한다 — 잘못된 귀속보다
  // 미집계가 정직하다.
  const ratingsByAgent = new Map<PackGeneratedBy, RatingRecord[]>();
  for (const record of ratings) {
    if (!record.generatedBy) continue;
    const list = ratingsByAgent.get(record.generatedBy) ?? [];
    list.push(record);
    ratingsByAgent.set(record.generatedBy, list);
  }

  const results: AgentComparisonStat[] = [];
  for (const [generatedBy, agentPacks] of packsByAgent) {
    const songCount = agentPacks.reduce((sum, pack) => sum + pack.songCount, 0);
    const avgQualityScore = agentPacks.length
      ? Math.round(agentPacks.reduce((sum, pack) => sum + pack.avgQualityScore, 0) / agentPacks.length)
      : 0;
    const agentRatings = ratingsByAgent.get(generatedBy) ?? [];
    const good = agentRatings.filter(r => r.rating === 'good').length;
    const bad = agentRatings.filter(r => r.rating === 'bad').length;
    results.push({
      generatedBy,
      setCount: agentPacks.length,
      songCount,
      avgQualityScore,
      ratedSongCount: agentRatings.length,
      goodPct: agentRatings.length ? Math.round((good / agentRatings.length) * 100) : 0,
      badPct: agentRatings.length ? Math.round((bad / agentRatings.length) * 100) : 0,
      sampleSufficient: agentPacks.length >= MIN_SETS_FOR_AGENT_COMPARISON
    });
  }
  return results.sort((a, b) => b.setCount - a.setCount);
}
