import { describe, expect, it } from 'vitest';
import { computeAgentComparisonStats, MIN_SETS_FOR_AGENT_COMPARISON } from '../src/core/agentComparison';
import type { SavedPackMeta } from '../src/types';
import type { RatingRecord } from '../src/core/ratingLedger';

/**
 * 지시문 18 (TASK C-3) — "자동 판정 금지" 원칙을 여기서 실측으로 확인한다:
 * 반환 타입에 "더 낫다" 류의 파생 필드가 없고, 표본 미달 시 sampleSufficient만
 * false가 될 뿐 수치 자체는 여전히 실측값 그대로 반환된다(UI가 숨기는 것이지
 * 이 함수가 판정하는 게 아니다).
 */

function pack(overrides: Partial<SavedPackMeta>): SavedPackMeta {
  return {
    id: `pack-${Math.random()}`,
    name: 'test',
    savedAt: new Date().toISOString(),
    isAutosave: false,
    channelId: 'ch1',
    channelName: 'Channel 1',
    projectTitle: 'Test',
    songCount: 18,
    avgQualityScore: 70,
    ...overrides
  } as SavedPackMeta;
}

function rating(overrides: Partial<RatingRecord>): RatingRecord {
  return {
    songId: `song-${Math.random()}`,
    packId: 'pack-1',
    rating: 'good',
    ratedAt: new Date().toISOString(),
    attributes: { genreId: 'g1', eraTag: 'e1', arcPhase: 'a1', bpm: 90, vocalType: 'male', channelId: 'ch1' },
    ...overrides
  } as RatingRecord;
}

describe('[지시문 18 TASK C-3] computeAgentComparisonStats', () => {
  it('생성 에이전트별로 세트 수·곡 수·qualityScore 평균을 실측 집계한다', () => {
    const packs = [
      pack({ generatedBy: 'claude-code', songCount: 18, avgQualityScore: 60 }),
      pack({ generatedBy: 'claude-code', songCount: 18, avgQualityScore: 70 }),
      pack({ generatedBy: 'claude-code', songCount: 18, avgQualityScore: 80 }),
      pack({ generatedBy: 'codex', songCount: 18, avgQualityScore: 50 })
    ];
    const stats = computeAgentComparisonStats(packs, []);
    const claude = stats.find(s => s.generatedBy === 'claude-code')!;
    expect(claude.setCount).toBe(3);
    expect(claude.songCount).toBe(54);
    expect(claude.avgQualityScore).toBe(70);
    const codex = stats.find(s => s.generatedBy === 'codex')!;
    expect(codex.setCount).toBe(1);
    expect(codex.avgQualityScore).toBe(50);
  });

  it('generatedBy가 없는 팩은 "other"로 집계된다(빈 값으로 사라지지 않는다)', () => {
    const packs = [pack({ generatedBy: undefined })];
    const stats = computeAgentComparisonStats(packs, []);
    expect(stats.find(s => s.generatedBy === 'other')).toBeDefined();
  });

  it(`세트 ${MIN_SETS_FOR_AGENT_COMPARISON}개 미만이면 sampleSufficient:false다`, () => {
    const packs = [pack({ generatedBy: 'fable-5' }), pack({ generatedBy: 'fable-5' })];
    const stats = computeAgentComparisonStats(packs, []);
    const fable = stats.find(s => s.generatedBy === 'fable-5')!;
    expect(fable.setCount).toBe(2);
    expect(fable.sampleSufficient).toBe(false);
  });

  it(`세트 ${MIN_SETS_FOR_AGENT_COMPARISON}개 이상이면 sampleSufficient:true다`, () => {
    const packs = Array.from({ length: MIN_SETS_FOR_AGENT_COMPARISON }, () => pack({ generatedBy: 'codex' }));
    const stats = computeAgentComparisonStats(packs, []);
    expect(stats.find(s => s.generatedBy === 'codex')!.sampleSufficient).toBe(true);
  });

  it('평가(good/bad)를 generatedBy로 정확히 집계한다', () => {
    const packs = [pack({ generatedBy: 'claude-code' })];
    const ratings = [
      rating({ generatedBy: 'claude-code', rating: 'good' }),
      rating({ generatedBy: 'claude-code', rating: 'good' }),
      rating({ generatedBy: 'claude-code', rating: 'bad' }),
      rating({ generatedBy: 'codex', rating: 'bad' }) // 다른 에이전트 — claude-code 집계에 섞이면 안 된다
    ];
    const stats = computeAgentComparisonStats(packs, ratings);
    const claude = stats.find(s => s.generatedBy === 'claude-code')!;
    expect(claude.ratedSongCount).toBe(3);
    expect(claude.goodPct).toBe(67);
    expect(claude.badPct).toBe(33);
  });

  it('generatedBy 없는 평가 기록(이 필드가 생기기 전)은 집계에서 제외된다 — 억지로 other에 몰아넣지 않는다', () => {
    const packs = [pack({ generatedBy: 'claude-code' })];
    const ratings = [rating({ generatedBy: undefined })];
    const stats = computeAgentComparisonStats(packs, ratings);
    const claude = stats.find(s => s.generatedBy === 'claude-code')!;
    expect(claude.ratedSongCount).toBe(0);
  });

  it('반환값에 우열을 나타내는 필드가 없다 — 앱이 자동 판정하지 않는다', () => {
    const packs = [pack({ generatedBy: 'claude-code' }), pack({ generatedBy: 'codex' })];
    const stats = computeAgentComparisonStats(packs, []);
    for (const stat of stats) {
      expect(Object.keys(stat)).not.toContain('winner');
      expect(Object.keys(stat)).not.toContain('better');
      expect(Object.keys(stat)).not.toContain('rank');
      expect(Object.keys(stat).sort()).toEqual(
        ['avgQualityScore', 'badPct', 'generatedBy', 'goodPct', 'ratedSongCount', 'sampleSufficient', 'setCount', 'songCount'].sort()
      );
    }
  });
});
